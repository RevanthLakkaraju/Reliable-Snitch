import {
  actor,
  checkMutation,
  json,
  apiError,
  findReport,
  reportEvents,
  updateReport,
  parseBody,
} from "@/lib/server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await actor(request);
    const { id } = await params;
    const report = await findReport(id);
    if (!report)
      return json(
        { error: "Report not found. Check the reference and try again." },
        404,
      );
    return json({
      report,
      events: await reportEvents(
        id,
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
    const { id } = await params;
    const report = await updateReport(
      id,
      await parseBody(request),
      await actor(request),
    );
    return json({ report, events: await reportEvents(id) });
  } catch (error) {
    return apiError(error);
  }
}
