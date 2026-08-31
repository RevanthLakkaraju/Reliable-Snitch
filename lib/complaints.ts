import { database, HttpError, findReport } from "./server";
import type { PortalUser } from "./auth";
import type { Report } from "./domain";
import { demoPhoto } from "./demo-corpus";
export type Registry = {
  reportId: string;
  ownerId: string | null;
  ward: string;
  provider: string;
  assignee: string;
  dueAt: number | null;
  providerTicket: string;
  coordination: string;
  clarification: string;
  escalated: number;
  photoApproved: number;
};
const registrySelect =
  "g.report_id AS reportId,g.owner_id AS ownerId,g.ward,g.provider,g.assignee,g.due_at AS dueAt,g.provider_ticket AS providerTicket,g.coordination,g.clarification,g.escalated,g.photo_approved AS photoApproved";
export async function registry(id: string) {
  return (await database())
    .prepare(
      "SELECT " +
        registrySelect +
        " FROM complaint_registry g WHERE g.report_id=?",
    )
    .bind(id)
    .first<Registry>();
}
export async function presentReports(
  reports: Report[],
  user: PortalUser,
  nearby = false,
): Promise<Report[]> {
  if (!reports.length) return [];
  const db = await database();
  type Row = Registry & {
    supportCount: number;
    supported: number;
    pendingId: string | null;
    pendingKey: string | null;
  };
  const map = new Map<string, Row>();
  // Chunked to stay below D1's bound-parameter limit; no per-report query loop.
  for (let start = 0; start < reports.length; start += 80) {
    const ids = reports.slice(start, start + 80).map((r) => r.id);
    const result = await db
      .prepare(
        "SELECT " +
          registrySelect +
          ",(SELECT count(*) FROM complaint_supports s WHERE s.report_id=g.report_id) AS supportCount,EXISTS(SELECT 1 FROM complaint_supports s WHERE s.report_id=g.report_id AND s.user_id=?) AS supported,p.id AS pendingId,p.photo_key AS pendingKey FROM complaint_registry g LEFT JOIN complaint_photos p ON p.report_id=g.report_id AND p.status='pending' WHERE g.report_id IN (" +
          ids.map(() => "?").join(",") +
          ")",
      )
      .bind(user.id, ...ids)
      .all<Row>();
    for (const row of result.results) map.set(row.reportId, row);
  }
  return reports.map((report) => {
    const info = map.get(report.id),
      owned = info?.ownerId === user.id,
      official = user.role === "official",
      illustration = report.isDemo ? demoPhoto(report.id) : null;
    return {
      ...report,
      photoKey:
        official || owned || info?.photoApproved ? report.photoKey : null,
      ward: info?.ward ?? "Locality to be verified",
      provider: info?.provider ?? "",
      dueAt: info?.dueAt,
      assignee: official ? info?.assignee : undefined,
      providerTicket: nearby ? undefined : info?.providerTicket,
      coordination: info?.coordination,
      clarification: owned || official ? info?.clarification : undefined,
      escalated: !!info?.escalated,
      owned,
      supportCount: info?.supportCount ?? 0,
      supported: !!info?.supported,
      photoApproved: !!info?.photoApproved,
      canContributePhoto:
        !report.photoKey &&
        !illustration &&
        !info?.pendingId &&
        !["Resolved", "Closed"].includes(report.status),
      pendingPhotoId: official ? info?.pendingId : undefined,
      pendingPhotoKey: official ? info?.pendingKey : undefined,
      demoPhoto: illustration,
    };
  });
}
export async function presentReport(
  report: Report,
  user: PortalUser,
  nearby = false,
) {
  return (await presentReports([report], user, nearby))[0];
}
export async function ownedReport(id: string, user: PortalUser) {
  const report = await findReport(id),
    info = await registry(id);
  if (!report || (user.role !== "official" && info?.ownerId !== user.id))
    throw new HttpError(
      404,
      "That complaint is not in your account. Use the locality map for public information.",
    );
  return report;
}
