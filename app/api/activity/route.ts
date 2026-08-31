import { json, apiError, reportEvents } from "@/lib/server";
export async function GET(request: Request) {
  try {
    await requireRole(request, "official");
    return json({ events: await reportEvents() });
  } catch (error) {
    return apiError(error);
  }
}
import { requireRole } from "@/lib/auth";
