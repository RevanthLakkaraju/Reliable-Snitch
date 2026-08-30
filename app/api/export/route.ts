import { actor, apiError, listReports } from "@/lib/server";
import { dateLabel } from "@/lib/domain";
import { renderCsv } from "@/lib/csv";

export async function GET(request: Request) {
  try {
    await actor(request);
    const params = new URL(request.url).searchParams;
    const query = (params.get("query") ?? "").toLowerCase();
    const status = params.get("status") ?? "All reports";
    const category = params.get("category") ?? "All categories";
    const department = params.get("department") ?? "All departments";
    const reports = (await listReports()).filter(
      (report) =>
        (params.get("demo") !== "false" || !report.isDemo) &&
        (status === "All reports" || status === report.status) &&
        (category === "All categories" || category === report.category) &&
        (department === "All departments" ||
          department === report.department) &&
        [
          report.id,
          report.title,
          report.description,
          report.locationText,
          report.department,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
    );
    return new Response(
      renderCsv([
        [
          "Reference",
          "Description",
          "Category",
          "Location",
          "Status",
          "Department",
          "Priority",
          "Created (IST)",
          "Demo",
        ],
        ...reports.map((report) => [
          report.id,
          report.description,
          report.category,
          report.locationText,
          report.status,
          report.department,
          report.priority,
          dateLabel(report.createdAt),
          report.isDemo ? "Yes" : "No",
        ]),
      ]),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="reliable-snitch-disruptions.csv"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
