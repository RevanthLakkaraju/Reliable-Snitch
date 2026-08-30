import { env } from "cloudflare:workers";
import { sessionActor } from "./demo-session";
import {
  classify,
  deriveContext,
  titleFromDescription,
  validateReport,
  validateTransition,
  STATUSES,
  CATEGORIES,
  DEPARTMENTS,
  PRIORITIES,
  type Report,
  type ReportEvent,
  type Status,
  type Category,
  type Priority,
  type Department,
} from "./domain";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function actor(request: Request) {
  if (import.meta.env.DEV && !env.DEMO_SESSION_SECRET) return "local-demo-operator";
  if (!env.DEMO_SESSION_SECRET || !env.DEMO_ACCESS_CODE_HASH)
    throw new HttpError(503, "Team access is not configured yet.");
  const id = await sessionActor(request.headers.get("cookie"), env.DEMO_SESSION_SECRET);
  if (id) return id;
  throw new HttpError(
    401,
    "Open your team invitation link to use this demonstration portal.",
  );
}
export async function checkMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "This request must come from the portal.");
  await actor(request);
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function parseBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") ?? 0) > 16000)
    throw new HttpError(413, "This request is too large.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new HttpError(400, "The request must be a JSON object.");
  return body as Record<string, unknown>;
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  console.error("Reliable Snitch request failed", error);
  return json(
    {
      error:
        "Something went wrong while saving or loading. Please retry; your existing reports are safe.",
    },
    500,
  );
}
let schemaReady = false;
export async function database() {
  if (!schemaReady) {
    await env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY NOT NULL,request_id TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,status TEXT NOT NULL,priority TEXT NOT NULL,department TEXT NOT NULL,location_text TEXT NOT NULL,latitude REAL,longitude REAL,accuracy REAL,location_source TEXT NOT NULL,photo_key TEXT,is_demo INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,resolved_at INTEGER,revision INTEGER NOT NULL DEFAULT 0,context TEXT NOT NULL)`,
      ),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS report_events (id TEXT PRIMARY KEY NOT NULL,report_id TEXT NOT NULL REFERENCES reports(id),kind TEXT NOT NULL,note TEXT NOT NULL,actor TEXT NOT NULL,visibility TEXT NOT NULL,created_at INTEGER NOT NULL,photo_key TEXT)`,
      ),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS uploads (key TEXT PRIMARY KEY NOT NULL,owner TEXT NOT NULL,content_type TEXT NOT NULL,size INTEGER NOT NULL,created_at INTEGER NOT NULL)`,
      ),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS idx_reports_updated ON reports(updated_at)",
      ),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)",
      ),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS idx_events_report_date ON report_events(report_id,created_at)",
      ),
    ]);
    const columns = await env.DB.prepare(
      "PRAGMA table_info(report_events)",
    ).all<{ name: string }>();
    if (!columns.results.some((c) => c.name === "photo_key"))
      await env.DB.prepare(
        "ALTER TABLE report_events ADD COLUMN photo_key TEXT",
      ).run();
    await seed();
    schemaReady = true;
  }
  return env.DB;
}
const selectReport = `SELECT id,title,description,category,status,priority,department,location_text AS locationText,latitude,longitude,accuracy,location_source AS locationSource,photo_key AS photoKey,is_demo AS isDemo,created_at AS createdAt,updated_at AS updatedAt,resolved_at AS resolvedAt,revision,context FROM reports`;
function decode(row: Record<string, unknown>): Report {
  return {
    ...row,
    isDemo: !!row.isDemo,
    context: JSON.parse(row.context as string),
  } as unknown as Report;
}
export async function listReports() {
  const db = await database();
  const result = await db
    .prepare(selectReport + " ORDER BY created_at DESC LIMIT 1000")
    .all();
  return result.results.map(decode);
}
export async function findReport(id: string) {
  const db = await database();
  const row = await db
    .prepare(selectReport + " WHERE id=?")
    .bind(id)
    .first();
  return row ? decode(row) : null;
}
export async function reportEvents(id?: string, publicOnly = false) {
  const db = await database();
  const where = id
    ? " WHERE report_id=?" + (publicOnly ? " AND visibility='public'" : "")
    : publicOnly
      ? " WHERE visibility='public'"
      : "";
  const query = db.prepare(
    `SELECT id,report_id AS reportId,kind,note,actor,visibility,created_at AS createdAt,photo_key AS photoKey FROM report_events${where} ORDER BY created_at DESC LIMIT 100`,
  );
  const result = await (id ? query.bind(id) : query).all();
  return result.results as unknown as ReportEvent[];
}
export async function createReport(
  body: Record<string, unknown>,
  owner: string,
) {
  let data;
  try {
    data = validateReport(body);
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
  const db = await database();
  const existing = await db
    .prepare("SELECT id FROM reports WHERE request_id=?")
    .bind(data.requestId)
    .first<{ id: string }>();
  if (existing) return findReport(existing.id);
  if (data.photoKey) {
    const upload = await db
      .prepare("SELECT owner FROM uploads WHERE key=?")
      .bind(data.photoKey)
      .first<{ owner: string }>();
    if (!upload || upload.owner !== owner)
      throw new HttpError(
        400,
        "The photo was not uploaded by this signed-in user. Please attach it again.",
      );
  }
  const id =
    "TE-" + crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const now = Date.now();
  const category = classify(data.description);
  const context = deriveContext(
    data.description,
    data.latitude,
    data.longitude,
    data.locationSource,
  );
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO reports (id,request_id,title,description,category,status,priority,department,location_text,latitude,longitude,accuracy,location_source,photo_key,is_demo,created_at,updated_at,resolved_at,revision,context) VALUES (?,?,?,?,?,'Reported','Unassessed','Unassigned',?,?,?,?,?,?,?, ?,?,NULL,0,?)`,
        )
        .bind(
          id,
          data.requestId,
          titleFromDescription(data.description),
          data.description,
          category,
          data.locationText,
          data.latitude,
          data.longitude,
          data.accuracy,
          data.locationSource,
          data.photoKey,
          data.locationSource === "demo" ? 1 : 0,
          now,
          now,
          JSON.stringify(context),
        ),
      db
        .prepare(
          `INSERT INTO report_events (id,report_id,kind,note,actor,visibility,created_at) VALUES (?,?, 'Report received',?,'Citizen','public',?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          "Report received and awaiting staff verification. Category is a description-based suggestion.",
          now,
        ),
    ]);
  } catch (error) {
    const saved = await db
      .prepare("SELECT id FROM reports WHERE request_id=?")
      .bind(data.requestId)
      .first<{ id: string }>();
    if (saved) return findReport(saved.id);
    throw error;
  }
  return findReport(id);
}
export async function updateReport(
  id: string,
  body: Record<string, unknown>,
  owner: string,
) {
  const report = await findReport(id);
  if (!report) throw new HttpError(404, "Report not found.");
  if (!Number.isInteger(body.revision) || body.revision !== report.revision)
    throw new HttpError(
      409,
      "This report changed in another session. Reload its details before saving.",
    );
  const status = (body.status ?? report.status) as Status,
    category = (body.category ?? report.category) as Category,
    priority = (body.priority ?? report.priority) as Priority,
    department = (body.department ?? report.department) as Department;
  if (
    !STATUSES.includes(status) ||
    !CATEGORIES.includes(category) ||
    !PRIORITIES.includes(priority) ||
    !DEPARTMENTS.includes(department)
  )
    throw new HttpError(
      400,
      "Choose a valid status, category, priority, and department.",
    );
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 2000)
    throw new HttpError(400, "Keep the update below 2,000 characters.");
  try {
    validateTransition(report.status, status, department, note);
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
  if (
    ["Assigned", "In progress", "Resolved"].includes(status) &&
    department === "Unassigned"
  )
    throw new HttpError(
      400,
      "An active or resolved report must have an assigned department.",
    );
  const changed =
    status !== report.status ||
    category !== report.category ||
    priority !== report.priority ||
    department !== report.department;
  if (!changed && !note)
    throw new HttpError(400, "Change a field or add an update before saving.");
  const changes = [
    status !== report.status ? `${report.status} → ${status}` : "",
    department !== report.department ? `Department: ${department}` : "",
    category !== report.category ? `Category confirmed: ${category}` : "",
    priority !== report.priority ? `Staff priority: ${priority}` : "",
  ].filter(Boolean);
  const now = Date.now(),
    db = await database(),
    eventId = crypto.randomUUID();
  const photoKey =
    typeof body.resolutionPhotoKey === "string"
      ? body.resolutionPhotoKey
      : null;
  if (photoKey) {
    if (status !== "Resolved")
      throw new HttpError(
        400,
        "Resolution evidence can only be attached when resolving a report.",
      );
    const upload = await db
      .prepare("SELECT owner FROM uploads WHERE key=?")
      .bind(photoKey)
      .first<{ owner: string }>();
    if (!upload || upload.owner !== owner)
      throw new HttpError(400, "Please upload the resolution photo again.");
  }
  const privateNote = body.visibility === "internal";
  if (status === "Resolved" && privateNote)
    throw new HttpError(
      400,
      "A resolution summary must be visible in the citizen tracker.",
    );
  // Insert the event only for the expected revision. A D1 batch is atomic, so
  // the event and row update cannot diverge under concurrent edits.
  const kind =
    status !== report.status && status === "Resolved"
      ? "Resolution recorded"
      : report.status === "Resolved" && status !== report.status
        ? "Report reopened"
        : changed
          ? "Workflow updated"
          : "Note added";
  const publicNote =
    changes.join(" · ") +
    (!privateNote && note ? (changes.length ? "\n\n" : "") + note : "");
  const statements = [
    db
      .prepare(
        `INSERT INTO report_events (id,report_id,kind,note,actor,visibility,created_at,photo_key) SELECT ?,id,?,?,'Operations team',?,?,? FROM reports WHERE id=? AND revision=?`,
      )
      .bind(
        eventId,
        kind,
        !changed && privateNote ? note : publicNote,
        !changed && privateNote ? "internal" : "public",
        now,
        photoKey,
        id,
        report.revision,
      ),
  ];
  if (changed && privateNote && note)
    statements.push(
      db
        .prepare(
          `INSERT INTO report_events (id,report_id,kind,note,actor,visibility,created_at) SELECT ?,id,'Note added',?,'Operations team','internal',? FROM reports WHERE id=? AND revision=?`,
        )
        .bind(crypto.randomUUID(), note, now, id, report.revision),
    );
  statements.push(
    db
      .prepare(
        `UPDATE reports SET status=?,category=?,priority=?,department=?,updated_at=?,resolved_at=?,revision=revision+1 WHERE id=? AND revision=?`,
      )
      .bind(
        status,
        category,
        priority,
        department,
        now,
        status === "Resolved" ? (report.resolvedAt ?? now) : null,
        id,
        report.revision,
      ),
  );
  const results = await db.batch(statements);
  if (!results[results.length - 1].meta.changes)
    throw new HttpError(
      409,
      "Another update was saved first. Reload the report and try again.",
    );
  return findReport(id);
}
async function seed() {
  const now = Date.now();
  const samples: [
    string,
    string,
    string,
    Status,
    Department,
    Priority,
    number,
    number,
    number,
  ][] = [
    [
      "1001",
      "Damaged road near the market",
      "A large pothole is blocking part of the road near the market entrance. Please inspect this stretch.",
      "In progress",
      "Public Works",
      "High",
      12.9721,
      77.5953,
      30,
    ],
    [
      "1002",
      "Streetlights out on School Lane",
      "Several streetlights are not working along the entire school lane. The pavement is difficult to see in the evening.",
      "Assigned",
      "Electrical Services",
      "Medium",
      12.9765,
      77.6004,
      19,
    ],
    [
      "1003",
      "Overflowing bins beside the bus stop",
      "The garbage bins beside the bus stop are overflowing. Waste is spilling onto the walking area.",
      "Reported",
      "Unassigned",
      "Unassessed",
      12.9672,
      77.5954,
      3,
    ],
    [
      "1004",
      "Standing water at the junction",
      "Water is collecting around a blocked drain at the junction after rain. The footpath is partly blocked.",
      "Verified",
      "Water & Drainage",
      "Medium",
      12.9693,
      77.6009,
      8,
    ],
    [
      "1005",
      "Fallen branch across Lake Walk",
      "A large tree branch is blocking the walking path at the lake. People have to walk around it.",
      "In progress",
      "Parks & Horticulture",
      "High",
      12.9638,
      77.5887,
      23,
    ],
    [
      "1006",
      "Uneven paving near the crossing",
      "Several pavement tiles are loose near the pedestrian crossing. This could be a trip hazard.",
      "Reported",
      "Unassigned",
      "Unassessed",
      12.9741,
      77.5904,
      1,
    ],
    [
      "1007",
      "Leaking pipe on the service road",
      "A water pipe is leaking continuously onto the service road near the hospital entrance.",
      "In progress",
      "Water & Drainage",
      "Medium",
      12.9714,
      77.5931,
      42,
    ],
    [
      "1008",
      "Waste collection missed on Park Street",
      "Garbage has not been collected from the public bins on Park Street.",
      "Assigned",
      "Sanitation",
      "Low",
      12.9782,
      77.5946,
      26,
    ],
    [
      "1009",
      "Repaired streetlight on Market Road",
      "A broken streetlight near the market has been reported for maintenance.",
      "Resolved",
      "Electrical Services",
      "Low",
      12.9709,
      77.5964,
      74,
    ],
    [
      "1010",
      "Cleared drain near the public garden",
      "The garden-side drain was clogged with leaves and waste.",
      "Resolved",
      "Water & Drainage",
      "Medium",
      12.9654,
      77.5998,
      98,
    ],
    [
      "1011",
      "Footpath repaired outside the library",
      "A damaged section of pavement outside the library needed repair.",
      "Resolved",
      "Public Works",
      "Medium",
      12.9754,
      77.5981,
      120,
    ],
    [
      "1012",
      "Public bins emptied at Lake Walk",
      "Waste bins along the lake path needed collection and cleaning.",
      "Resolved",
      "Sanitation",
      "Low",
      12.9632,
      77.5894,
      67,
    ],
  ];
  const statements = [];
  for (const [
    suffix,
    title,
    description,
    status,
    department,
    priority,
    latitude,
    longitude,
    hours,
  ] of samples) {
    const id = "TE-" + suffix,
      created = now - hours * 3600000,
      updated =
        status === "Resolved"
          ? created + 20 * 3600000
          : created + Math.min(hours - 0.5, 4) * 3600000;
    const category = classify(description);
    const context = deriveContext(description, latitude, longitude, "demo");
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO reports (id,request_id,title,description,category,status,priority,department,location_text,latitude,longitude,accuracy,location_source,photo_key,is_demo,created_at,updated_at,resolved_at,revision,context) VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,'demo',NULL,1,?,?,?,0,?)`,
      ).bind(
        id,
        "demo-" + suffix,
        title,
        description,
        category,
        status,
        priority,
        department,
        title.includes("Lake")
          ? "Lake Walk · Demo South"
          : title.includes("School")
            ? "School Lane · Demo East"
            : "Central district · Demo area",
        latitude,
        longitude,
        created,
        updated,
        status === "Resolved" ? updated : null,
        JSON.stringify(context),
      ),
    );
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO report_events (id,report_id,kind,note,actor,visibility,created_at) VALUES (?,?, 'Report received','Illustrative report created for the demonstration.','Demo citizen','public',?)`,
      ).bind("seed-" + suffix, id, created),
    );
    if (status !== "Reported")
      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO report_events (id,report_id,kind,note,actor,visibility,created_at) VALUES (?,?,?,?,'Demo operations','public',?)`,
        ).bind(
          "seed-update-" + suffix,
          id,
          status === "Resolved" ? "Resolution recorded" : "Workflow updated",
          status === "Resolved"
            ? "Demonstration resolution: work completed and site checked. No real municipal action took place."
            : `Demonstration status: ${status}. Responsible department: ${department}.`,
          updated,
        ),
      );
  }
  await env.DB.batch(statements);
}
