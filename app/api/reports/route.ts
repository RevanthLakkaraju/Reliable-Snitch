import {
  actor,
  checkMutation,
  json,
  apiError,
  listReports,
  createReport,
  parseBody,
} from "@/lib/server";
export async function GET(request: Request) {
  try {
    await actor(request);
    return json({ reports: await listReports() });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    await checkMutation(request);
    return json(
      { report: await createReport(await parseBody(request), await actor(request)) },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
