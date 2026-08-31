import { requireRole } from "@/lib/auth";
import {
  checkMutation,
  json,
  apiError,
  database,
  findReport,
  parseBody,
  HttpError,
} from "@/lib/server";
import { registry, presentReport } from "@/lib/complaints";
import { demoPhoto } from "@/lib/demo-corpus";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await checkMutation(request);
    const user = await requireRole(request, "citizen"),
      { id } = await params,
      body = await parseBody(request),
      db = await database();
    const report = await findReport(id);
    if (!report) throw new HttpError(404, "Complaint not found.");
    const info = await registry(id),
      now = Date.now();
    if (body.action === "support") {
      if (typeof body.supported !== "boolean")
        throw new HttpError(400, "Choose whether you are affected.");
      if (body.supported)
        await db
          .prepare(
            "INSERT OR IGNORE INTO complaint_supports (report_id,user_id,created_at) VALUES (?,?,?)",
          )
          .bind(id, user.id, now)
          .run();
      else
        await db
          .prepare(
            "DELETE FROM complaint_supports WHERE report_id=? AND user_id=?",
          )
          .bind(id, user.id)
          .run();
    } else if (body.action === "photo") {
      if (
        report.photoKey ||
        (report.isDemo && demoPhoto(id)) ||
        ["Resolved", "Closed"].includes(report.status)
      )
        throw new HttpError(
          409,
          "This complaint already has a photo or is resolved.",
        );
      const key = typeof body.photoKey === "string" ? body.photoKey : "";
      const upload = await db
        .prepare("SELECT key FROM uploads WHERE key=? AND owner=?")
        .bind(key, user.id)
        .first();
      if (!upload)
        throw new HttpError(400, "Upload your photo before contributing it.");
      const pending = await db
        .prepare(
          "SELECT id FROM complaint_photos WHERE report_id=? AND status='pending'",
        )
        .bind(id)
        .first();
      if (pending)
        throw new HttpError(
          409,
          "A photo is already awaiting municipal review.",
        );
      try {
        const saved = await db
          .prepare(
            `INSERT INTO complaint_photos (id,report_id,user_id,photo_key,status,created_at) SELECT ?,id,?,?,'pending',? FROM reports WHERE id=? AND photo_key IS NULL AND status NOT IN ('Resolved','Closed')`,
          )
          .bind(crypto.randomUUID(), user.id, key, now, id)
          .run();
        if (!saved.meta.changes)
          throw new HttpError(
            409,
            "The complaint changed. Refresh and check its photo.",
          );
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(
          409,
          "Another photo was submitted first. Refresh the complaint.",
        );
      }
    } else {
      if (info?.ownerId !== user.id)
        throw new HttpError(
          403,
          "Only the original complainant can reply, confirm or request reopening.",
        );
      if (body.revision !== report.revision)
        throw new HttpError(
          409,
          "The complaint changed. Refresh before replying.",
        );
      const note = typeof body.note === "string" ? body.note.trim() : "";
      let status = report.status,
        kind = "";
      if (body.action === "reply") {
        if (!info.clarification)
          throw new HttpError(400, "No clarification is currently requested.");
        kind = "Citizen clarification received";
      } else if (body.action === "reopen") {
        if (!["Resolved", "Closed"].includes(status))
          throw new HttpError(
            400,
            "Only a resolved complaint can be reopened.",
          );
        status = "Verified";
        kind = "Citizen requested reopening";
      } else if (body.action === "confirm") {
        if (status !== "Resolved")
          throw new HttpError(
            400,
            "The complaint must be resolved before confirmation.",
          );
        status = "Closed";
        kind = "Resolution confirmed by citizen";
      } else throw new HttpError(400, "Unknown citizen action.");
      if (body.action !== "confirm" && (note.length < 12 || note.length > 2000))
        throw new HttpError(
          400,
          "Explain your request in 12–2,000 characters.",
        );
      const eventId = crypto.randomUUID();
      const result = await db.batch([
        db
          .prepare(
            `INSERT INTO report_events (id,report_id,kind,note,actor,visibility,created_at) SELECT ?,id,?,?,'Complainant','public',? FROM reports WHERE id=? AND revision=?`,
          )
          .bind(
            eventId,
            kind,
            body.action === "confirm"
              ? "The complainant confirmed that the issue is resolved."
              : note,
            now,
            id,
            report.revision,
          ),
        db
          .prepare(
            `UPDATE complaint_registry SET clarification='' WHERE report_id=? AND EXISTS(SELECT 1 FROM report_events WHERE id=?)`,
          )
          .bind(id, eventId),
        db
          .prepare(
            `UPDATE reports SET status=?,updated_at=?,revision=revision+1,resolved_at=CASE WHEN ?='Verified' THEN NULL ELSE resolved_at END WHERE id=? AND revision=?`,
          )
          .bind(status, now, status, id, report.revision),
      ]);
      if (!result[2].meta.changes)
        throw new HttpError(
          409,
          "Another update was saved first. Refresh and retry.",
        );
    }
    return json({
      report: await presentReport((await findReport(id))!, user, true),
    });
  } catch (error) {
    return apiError(error);
  }
}
