import { actor, json, apiError, reportEvents } from "@/lib/server";
export async function GET(request: Request) {
  try {
    actor(request);
    return json({ events: await reportEvents() });
  } catch (error) {
    return apiError(error);
  }
}
