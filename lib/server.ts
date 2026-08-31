import { env } from "cloudflare:workers";
import { currentUser, sameOrigin } from "./auth";
import { upgradeSchema } from "./upgrade-schema";
import { validateCivicInput, COORDINATION } from "./civic";
import {
  classify,
  deriveContext,
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
  return (await currentUser(request)).id;
}
export async function checkMutation(request: Request) {
  sameOrigin(request);
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
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "A JSON request is required.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "The request body is missing.");
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16000) {
      await reader.cancel();
      throw new HttpError(413, "This request is too large.");
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
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
    await env.DB.batch(upgradeSchema.map((sql) => env.DB.prepare(sql)));
    await seed();
    await seedUpgrade();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO complaint_registry (report_id,ward,due_at,photo_approved) SELECT id,CASE WHEN is_demo=1 THEN 'Demo Ward 01 · Bengaluru' ELSE 'Unverified locality' END,created_at+259200000,CASE WHEN is_demo=1 THEN 1 ELSE 0 END FROM reports`,
    ).run();
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
    .prepare(
      "SELECT r.id,g.owner_id AS owner FROM reports r LEFT JOIN complaint_registry g ON g.report_id=r.id WHERE r.request_id=?",
    )
    .bind(data.requestId)
    .first<{ id: string; owner: string | null }>();
  if (existing) {
    if (existing.owner !== owner)
      throw new HttpError(
        409,
        "Submission identifier already used. Reload the form.",
      );
    return findReport(existing.id);
  }
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
  const suggested = classify(data.description);
  const category =
    body.category && CATEGORIES.includes(body.category as Category)
      ? (body.category as Category)
      : suggested;
  if (suggested === "Internet & mobile network" && category !== suggested)
    throw new HttpError(
      400,
      "For a network complaint, select Internet & mobile network and your provider.",
    );
  let civic;
  try {
    civic = validateCivicInput(body, category);
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
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
          civic.title,
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
          `INSERT INTO complaint_registry (report_id,owner_id,ward,provider,due_at,coordination,photo_approved) VALUES (?,?,?,?,?,?,0)`,
        )
        .bind(
          id,
          owner,
          civic.ward,
          civic.provider,
          now + 72 * 3600000,
          civic.provider ? "Not yet contacted" : "Not required",
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
      .prepare(
        "SELECT r.id,g.owner_id AS owner FROM reports r LEFT JOIN complaint_registry g ON g.report_id=r.id WHERE r.request_id=?",
      )
      .bind(data.requestId)
      .first<{ id: string; owner: string | null }>();
    if (saved && saved.owner === owner) return findReport(saved.id);
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
  const db = await database();
  const registry = await db
    .prepare("SELECT * FROM complaint_registry WHERE report_id=?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!registry)
    throw new HttpError(404, "Complaint register entry not found.");
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
  const field = (key: string, column: string, max: number) => {
    const value =
      body[key] === undefined ? String(registry[column] ?? "") : body[key];
    if (typeof value !== "string" || value.trim().length > max)
      throw new HttpError(400, `Invalid ${key}.`);
    return value.trim();
  };
  const assignee = field("assignee", "assignee", 80),
    ward = field("ward", "ward", 120),
    providerTicket = field("providerTicket", "provider_ticket", 100),
    coordination = field("coordination", "coordination", 80),
    clarification = field("clarification", "clarification", 1500);
  const dueAt =
    body.dueAt === undefined ? (registry.due_at as number | null) : body.dueAt;
  if (
    dueAt !== null &&
    (typeof dueAt !== "number" ||
      !Number.isFinite(dueAt) ||
      dueAt < 0 ||
      dueAt > Date.now() + 366 * 86400000)
  )
    throw new HttpError(
      400,
      "Choose a valid target date within the next year.",
    );
  if (!COORDINATION.includes(coordination))
    throw new HttpError(400, "Select a valid provider coordination stage.");
  if (!registry.provider && coordination !== "Not required")
    throw new HttpError(
      400,
      "This complaint has no selected network service provider.",
    );
  if (category === "Internet & mobile network" && !registry.provider)
    throw new HttpError(
      400,
      "A network complaint must have a provider selected by its reporter. Request clarification rather than assigning an unknown provider.",
    );
  if (registry.provider && coordination === "Not required")
    throw new HttpError(
      400,
      "Keep a coordination stage for this service-provider complaint.",
    );
  if (body.escalated !== undefined && typeof body.escalated !== "boolean")
    throw new HttpError(400, "Choose a valid escalation state.");
  const escalated =
    body.escalated === undefined
      ? Number(registry.escalated)
      : body.escalated
        ? 1
        : 0;
  const metadataChanged =
    assignee !== registry.assignee ||
    ward !== registry.ward ||
    dueAt !== registry.due_at ||
    providerTicket !== registry.provider_ticket ||
    coordination !== registry.coordination ||
    clarification !== registry.clarification ||
    escalated !== registry.escalated;
  if (
    department !== report.department &&
    report.department !== "Unassigned" &&
    note.length < 12
  )
    throw new HttpError(
      400,
      "Record a transfer reason of at least 12 characters.",
    );
  if (metadataChanged && note.length < 12)
    throw new HttpError(
      400,
      "Add an action-taken note of at least 12 characters for the register changes.",
    );
  if (clarification && ["Resolved", "Closed"].includes(status))
    throw new HttpError(
      400,
      "Clear the clarification request before resolving the complaint.",
    );
  let contributedPhoto: string | null = null;
  const review = body.photoReview;
  if (review) {
    if (
      !["approve", "reject"].includes(String(review)) ||
      typeof body.pendingPhotoId !== "string"
    )
      throw new HttpError(400, "Choose a valid photo review action.");
    const pending = await db
      .prepare(
        "SELECT photo_key AS photoKey FROM complaint_photos WHERE id=? AND report_id=? AND status='pending'",
      )
      .bind(body.pendingPhotoId, id)
      .first<{ photoKey: string }>();
    if (!pending || (review === "approve" && report.photoKey))
      throw new HttpError(
        409,
        "This photograph was already reviewed or a photo is now attached.",
      );
    if (review === "approve") contributedPhoto = pending.photoKey;
  }
  const approveOriginal =
    body.approvePhoto === true && !!report.photoKey && !registry.photo_approved;
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
  if (!changed && !note && !metadataChanged && !review && !approveOriginal)
    throw new HttpError(400, "Change a field or add an update before saving.");
  const changes = [
    status !== report.status ? `${report.status} → ${status}` : "",
    department !== report.department ? `Department: ${department}` : "",
    category !== report.category ? `Category confirmed: ${category}` : "",
    priority !== report.priority ? `Staff priority: ${priority}` : "",
    assignee !== registry.assignee ? "Responsible official updated." : "",
    ward !== registry.ward ? `Locality / ward: ${ward}` : "",
    dueAt !== registry.due_at
      ? `Response target: ${dueAt ? new Date(dueAt).toISOString() : "Not set"} (demo target)`
      : "",
    coordination !== registry.coordination
      ? `Provider coordination: ${coordination}`
      : "",
    providerTicket !== registry.provider_ticket
      ? `Provider reference: ${providerTicket || "Not set"}`
      : "",
    clarification !== registry.clarification
      ? `Clarification: ${clarification || "Completed"}`
      : "",
    escalated !== registry.escalated
      ? escalated
        ? "Escalated for supervisory review."
        : "Escalation cleared."
      : "",
    review
      ? `Citizen-contributed photograph ${review === "approve" ? "approved" : "not approved"}.`
      : "",
    approveOriginal
      ? "Complaint photograph approved for the locality map."
      : "",
  ].filter(Boolean);
  const now = Date.now(),
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
      : ["Resolved", "Closed"].includes(report.status) && status === "Verified"
        ? "Report reopened"
        : changed || metadataChanged || review || approveOriginal
          ? "Workflow updated"
          : "Note added";
  const publicNote =
    changes.join(" · ") +
    (!privateNote && note ? (changes.length ? "\n\n" : "") + note : "");
  const statements = [
    db
      .prepare(
        `INSERT INTO report_events (id,report_id,kind,note,actor,visibility,created_at,photo_key) SELECT ?,id,?,?,coalesce((SELECT name || ' (' || username || ')' FROM portal_users WHERE id=?),'Operations team'),?,?,? FROM reports WHERE id=? AND revision=?`,
      )
      .bind(
        eventId,
        kind,
        !changed &&
          !metadataChanged &&
          !review &&
          !approveOriginal &&
          privateNote
          ? note
          : publicNote,
        owner,
        !changed &&
          !metadataChanged &&
          !review &&
          !approveOriginal &&
          privateNote
          ? "internal"
          : "public",
        now,
        photoKey,
        id,
        report.revision,
      ),
  ];
  if (
    (changed || metadataChanged || review || approveOriginal) &&
    privateNote &&
    note
  )
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
        `UPDATE complaint_registry SET ward=?,assignee=?,due_at=?,provider_ticket=?,coordination=?,clarification=?,escalated=?,photo_approved=CASE WHEN ?=1 THEN 1 ELSE photo_approved END WHERE report_id=? AND EXISTS(SELECT 1 FROM report_events WHERE id=?)`,
      )
      .bind(
        ward,
        assignee,
        dueAt,
        providerTicket,
        coordination,
        clarification,
        escalated,
        approveOriginal || contributedPhoto ? 1 : 0,
        id,
        eventId,
      ),
  );
  if (review)
    statements.push(
      db
        .prepare(
          `UPDATE complaint_photos SET status=?,reviewed_at=? WHERE id=? AND report_id=? AND status='pending' AND EXISTS(SELECT 1 FROM report_events WHERE id=?)`,
        )
        .bind(
          review === "approve" ? "approved" : "rejected",
          now,
          body.pendingPhotoId,
          id,
          eventId,
        ),
    );
  statements.push(
    db
      .prepare(
        `UPDATE reports SET status=?,category=?,priority=?,department=?,updated_at=?,resolved_at=?,photo_key=coalesce(?,photo_key),revision=revision+1 WHERE id=? AND revision=?`,
      )
      .bind(
        status,
        category,
        priority,
        department,
        now,
        ["Resolved", "Closed"].includes(status)
          ? (report.resolvedAt ?? now)
          : null,
        contributedPhoto,
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
async function seedUpgrade() {
  const now = Date.now();
  const rows = [
    {
      id: "TE-1013",
      title: "Broadband disruption around Market Road",
      description:
        "Illustrative network complaint: several homes report intermittent broadband. This is a fictional scenario, not a verified provider outage.",
      provider: "Airtel",
      status: "Assigned",
      hours: 95,
      coordination: "Awaiting provider response",
      ticket: "DEMO-NET-1013",
      clarification: "",
      escalated: 1,
    },
    {
      id: "TE-1014",
      title: "Weak mobile signal near the bus stop",
      description:
        "Demonstration only: mobile calls keep dropping near the bus stop. Please coordinate a coverage check; no real provider has been contacted.",
      provider: "Jio",
      status: "In progress",
      hours: 20,
      coordination: "Provider action in progress",
      ticket: "DEMO-NET-1014",
      clarification: "",
      escalated: 0,
    },
    {
      id: "TE-1015",
      title: "Internet unavailable along School Lane",
      description:
        "Fictional demonstration of an internet service complaint. The affected stretch and times need clarification before provider coordination.",
      provider: "BSNL",
      status: "Reported",
      hours: 5,
      coordination: "Not yet contacted",
      ticket: "",
      clarification:
        "Please identify the affected stretch and the time the disruption began.",
      escalated: 0,
    },
    {
      id: "TE-1016",
      title: "Local fibre line service interruption",
      description:
        "Illustrative complaint for an independent fibre service provider. The municipality records the provider reference and follows up manually.",
      provider: "Demo Local Fibre",
      status: "Verified",
      hours: 8,
      coordination: "Not yet contacted",
      ticket: "",
      clarification: "",
      escalated: 0,
    },
  ];
  const statements = [];
  for (const [index, r] of rows.entries()) {
    const time = now - r.hours * 3600000,
      lat = 12.9716 + index * 0.001,
      lng = 77.5946 + index * 0.001;
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO reports (id,request_id,title,description,category,status,priority,department,location_text,latitude,longitude,accuracy,location_source,photo_key,is_demo,created_at,updated_at,resolved_at,revision,context) VALUES (?,?,?,?,'Internet & mobile network',?,'Medium','Telecom Coordination',?,?,?,NULL,'demo',NULL,1,?,?,NULL,0,?)`,
      ).bind(
        r.id,
        "demo-upgrade-" + r.id,
        r.title,
        r.description,
        r.status,
        index === 2
          ? "School Lane · Demo Bengaluru"
          : "Market Road · Demo Bengaluru",
        lat,
        lng,
        time,
        time,
        JSON.stringify(deriveContext(r.description, lat, lng, "demo")),
      ),
    );
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO complaint_registry (report_id,ward,provider,assignee,due_at,provider_ticket,coordination,clarification,escalated,photo_approved) VALUES (?,'Demo Ward 01 · Bengaluru',?,'Demo telecom desk',?,?,?,?,?,1)`,
      ).bind(
        r.id,
        r.provider,
        time + 72 * 3600000,
        r.ticket,
        r.coordination,
        r.clarification,
        r.escalated,
      ),
    );
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO report_events (id,report_id,kind,note,actor,visibility,created_at) VALUES (?,?,'Demonstration case registered','Fictional provider coordination example. No actual provider contact occurred.','Demo municipal desk','public',?)`,
      ).bind("seed-upgrade-" + r.id, r.id, time),
    );
  }
  await env.DB.batch(statements);
}
