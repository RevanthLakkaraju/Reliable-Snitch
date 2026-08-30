import Tracker from "./tracker";
import { findReport, reportEvents } from "@/lib/server";
import { siteOrigin } from "@/lib/site-metadata";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  let report = null;
  if (
    typeof code === "string" &&
    /^TE-[A-Z0-9]{4,12}$/.test(code.toUpperCase())
  )
    try {
      report = await findReport(code.toUpperCase());
    } catch {}
  const title = report
    ? `${report.id}: ${report.title} — Reliable Snitch`
    : "Track a report — Reliable Snitch";
  const description = report
    ? `${report.status} · ${report.department} · ${report.locationText}. Follow this demonstration report's public updates.`
    : "Follow a civic disruption from report to resolution.";
  const origin = siteOrigin();
  const images =
    report?.photoKey && origin
      ? [
          new URL(
            "/api/image?key=" + encodeURIComponent(report.photoKey),
            origin,
          ).href,
        ]
      : [];
  return {
    title,
    description,
    openGraph: { title, description, images },
    twitter: {
      card: images.length
        ? ("summary_large_image" as const)
        : ("summary" as const),
      title,
      description,
      images,
    },
  };
}
export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const reference = typeof code === "string" ? code.trim().toUpperCase() : "";
  let report = null,
    events: Awaited<ReturnType<typeof reportEvents>> = [],
    error = "";
  if (reference) {
    if (!/^TE-[A-Z0-9]{4,12}$/.test(reference))
      error = "Enter a valid report reference such as TE-1001.";
    else
      try {
        report = await findReport(reference);
        if (report) events = await reportEvents(reference, true);
        else error = "Report not found. Check the reference and try again.";
      } catch {
        error = "Could not load this report. Please try again.";
      }
  }
  return (
    <Tracker
      key={reference}
      initialCode={reference}
      initialReport={report}
      initialEvents={events}
      initialError={error}
    />
  );
}
