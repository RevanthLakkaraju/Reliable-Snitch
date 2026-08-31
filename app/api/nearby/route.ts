import { currentUser } from "@/lib/auth";
import { json, apiError, listReports, HttpError } from "@/lib/server";
import { presentReports } from "@/lib/complaints";
import { distanceMeters } from "@/lib/domain";
export async function GET(request: Request) {
  try {
    const user = await currentUser(request),
      p = new URL(request.url).searchParams;
    const lat = Number(p.get("lat")),
      lng = Number(p.get("lng")),
      radius = Number(p.get("radius") ?? 3000);
    const locality = (p.get("locality") ?? "").trim().toLowerCase();
    const coordinates = p.has("lat") && p.has("lng");
    if (
      coordinates &&
      (!Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180)
    )
      throw new HttpError(400, "Choose a valid map location.");
    if (!Number.isFinite(radius) || radius < 100 || radius > 10000)
      throw new HttpError(400, "Choose a radius between 100 m and 10 km.");
    if (!coordinates && locality.length < 3) return json({ reports: [] });
    const all = await listReports(),
      reports = [];
    for (const report of all) {
      if (p.get("demo") === "0" && report.isDemo) continue;
      const match = coordinates
        ? report.latitude !== null &&
          report.longitude !== null &&
          distanceMeters(lat, lng, report.latitude, report.longitude) <= radius
        : report.locationText.toLowerCase().includes(locality);
      if (match) reports.push(report);
      if (reports.length >= 100) break;
    }
    reports.sort((a, b) =>
      coordinates
        ? distanceMeters(lat, lng, a.latitude!, a.longitude!) -
          distanceMeters(lat, lng, b.latitude!, b.longitude!)
        : b.createdAt - a.createdAt,
    );
    return json({ reports: await presentReports(reports, user, true) });
  } catch (error) {
    return apiError(error);
  }
}
