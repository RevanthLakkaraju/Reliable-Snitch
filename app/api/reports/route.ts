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
    actor(request);
    return json({ reports: await listReports() });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkMutation(request);
    return json(
      { report: await createReport(await parseBody(request), actor(request)) },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
