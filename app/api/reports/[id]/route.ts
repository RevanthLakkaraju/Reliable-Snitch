import {
  checkMutation,
  json,
  apiError,
  reportEvents,
  updateReport,
  parseBody,
} from "@/lib/server";
import { currentUser, requireRole } from "@/lib/auth";
import { ownedReport, presentReport } from "@/lib/complaints";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser(request),
      { id } = await params,
      report = await ownedReport(id, user);
    return json({
      report: await presentReport(report, user),
      events: await reportEvents(
        id,
        user.role !== "official" ||
          new URL(request.url).searchParams.get("public") === "1",
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await checkMutation(request);
    const user = await requireRole(request, "official"),
      { id } = await params;
    const report = await updateReport(id, await parseBody(request), user.id);
    return json({
      report: report ? await presentReport(report, user) : null,
      events: await reportEvents(id),
    });
  } catch (error) {
    return apiError(error);
  }
}
