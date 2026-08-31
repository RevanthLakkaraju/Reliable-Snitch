import {
  checkMutation,
  json,
  apiError,
  listReports,
  createReport,
  parseBody,
  database,
} from "@/lib/server";
import { currentUser, requireRole, rateLimit } from "@/lib/auth";
import { presentReports, presentReport } from "@/lib/complaints";
export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    let reports = await listReports();
    if (user.role !== "official") {
      const rows = await (
        await database()
      )
        .prepare("SELECT report_id FROM complaint_registry WHERE owner_id=?")
        .bind(user.id)
        .all<{ report_id: string }>();
      const ids = new Set(rows.results.map((r) => r.report_id));
      reports = reports.filter((r) => ids.has(r.id));
    }
    return json({ reports: await presentReports(reports, user) });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    await checkMutation(request);
    const user = await requireRole(request, "citizen");
    await rateLimit("report:" + user.id, 50, 3600000);
    const report = await createReport(await parseBody(request), user.id);
    return json(
      { report: report ? await presentReport(report, user) : null },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
