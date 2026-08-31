import {
  checkMutation,
  createReport,
  database,
  apiError,
  json,
} from "@/lib/server";
import { requireRole } from "@/lib/auth";
import { digest } from "@/lib/credentials";
export async function POST(request: Request) {
  try {
    await checkMutation(request);
    const user = await requireRole(request, "citizen"),
      db = await database();
    const specs = [
      {
        title: "Demo: uneven footpath by the crossing",
        description:
          "Several footpath tiles are uneven at this demonstration crossing. Please inspect the walking surface.",
        category: "Roads & footpaths",
        provider: "",
        status: "Reported",
        clarification: "Please confirm which side of the crossing is affected.",
      },
      {
        title: "Demo: intermittent broadband on Market Road",
        description:
          "This is a fictional broadband complaint for a personal demonstration. Connectivity is intermittent along the sample street.",
        category: "Internet & mobile network",
        provider: "Airtel",
        status: "Resolved",
        clarification: "",
      },
    ];
    const ids = [];
    for (const [index, s] of specs.entries()) {
      const hex = await digest(`citizen-demo:${user.id}:${index}`),
        requestId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      const r = await createReport(
        {
          ...s,
          requestId,
          ward: "Demo Ward 01 · Bengaluru",
          locationText: "Market Road · Personal demo",
          locationSource: "demo",
          latitude: 12.9721 + index * 0.001,
          longitude: 77.5953,
          photoKey: null,
          accuracy: null,
        },
        user.id,
      );
      if (r) {
        await db.batch([
          db
            .prepare(
              "UPDATE reports SET status=?,department=?,resolved_at=? WHERE id=? AND revision=0 AND NOT EXISTS(SELECT 1 FROM report_events WHERE id=?)",
            )
            .bind(
              s.status,
              index ? "Telecom Coordination" : "Public Works",
              index ? Date.now() : null,
              r.id,
              "personal-scenario:" + r.id,
            ),
          db
            .prepare(
              "UPDATE complaint_registry SET clarification=?,coordination=?,provider_ticket=? WHERE report_id=? AND NOT EXISTS(SELECT 1 FROM report_events WHERE id=?) AND EXISTS(SELECT 1 FROM reports WHERE id=? AND revision=0)",
            )
            .bind(
              s.clarification,
              index ? "Provider confirms restored" : "Not required",
              index ? "PERSONAL-DEMO-RESTORED" : "",
              r.id,
              "personal-scenario:" + r.id,
              r.id,
            ),
          db
            .prepare(
              "INSERT OR IGNORE INTO report_events (id,report_id,kind,note,actor,visibility,created_at) SELECT ?,id,'Personal demonstration scenario',?,'Demo setup','public',? FROM reports WHERE id=? AND revision=0",
            )
            .bind(
              "personal-scenario:" + r.id,
              index
                ? "Simulated resolution for testing confirmation and reopening. No real work or provider contact took place."
                : "Sample clarification request for testing the citizen reply flow.",
              Date.now(),
              r.id,
            ),
        ]);
      }
      if (r) ids.push(r.id);
    }
    return json({ ids });
  } catch (error) {
    return apiError(error);
  }
}
