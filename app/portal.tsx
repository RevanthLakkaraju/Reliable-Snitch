"use client";
import Link from "next/link";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  ClipboardList,
  Building2,
  MapPin,
  List,
  Columns3,
  ShieldCheck,
  Info,
  Activity,
  Route,
  Lightbulb,
  Trash2,
  Droplets,
  Trees,
} from "lucide-react";
import {
  CATEGORIES,
  DEPARTMENTS,
  STATUSES,
  relativeTime,
  type Report,
  type ReportEvent,
} from "@/lib/domain";
import { requestJson } from "@/lib/client";
import {
  Shell,
  CategoryIcon,
  StatusBadge,
  ReportButton,
  Spinner,
  EmptyState,
} from "./components/ui";
import ReportDetail, { Timeline } from "./components/report-detail";
import CityMap from "./components/city-map";
const titles: Record<string, [string, string, string]> = {
  overview: [
    "A CLEARER VIEW OF YOUR CITY",
    "Small reports. Real change.",
    "One place to see, coordinate, and resolve civic disruptions.",
  ],
  disruptions: [
    "FROM REPORT TO RESOLUTION",
    "Every disruption, accounted for.",
    "Keep the next step clear and the right people connected.",
  ],
  map: [
    "THE BIGGER PICTURE",
    "Your city, in context.",
    "See where disruptions are happening. Open a marker to take action.",
  ],
  departments: [
    "BETTER, TOGETHER",
    "A shared responsibility.",
    "Clear ownership across every department and every report.",
  ],
  activity: [
    "A RECORD OF PROGRESS",
    "Every update leaves a trace.",
    "Follow the decisions and work behind each disruption.",
  ],
  about: [
    "SPOT IT. REPORT IT. RESOLVE IT.",
    "Attention, turned into action.",
    "A practical prototype for more transparent civic coordination.",
  ],
};
export default function Portal({ view = "overview" }: { view?: string }) {
  const [reports, setReports] = useState<Report[]>([]),
    [events, setEvents] = useState<ReportEvent[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQueryValue] = useState(""),
    [statusFilter, setStatusFilterValue] = useState("All reports"),
    [category, setCategoryValue] = useState("All categories"),
    [department, setDepartmentValue] = useState("All departments"),
    [showDemo, setShowDemoValue] = useState(true),
    [display, setDisplay] = useState("list"),
    [selected, setSelected] = useState<string | null>(null),
    [page, setPage] = useState(1),
    [toast, setToast] = useState(""),
    [refreshed, setRefreshed] = useState<number | null>(null);
  const sequence = useRef(0);
  function setQuery(value: string) {
    setQueryValue(value);
    setPage(1);
  }
  function setStatusFilter(value: string) {
    setStatusFilterValue(value);
    setPage(1);
  }
  function setCategory(value: string) {
    setCategoryValue(value);
    setPage(1);
  }
  function setDepartment(value: string) {
    setDepartmentValue(value);
    setPage(1);
  }
  function setShowDemo(value: boolean) {
    setShowDemoValue(value);
    setPage(1);
  }
  const refresh = useCallback(() => {
    const current = ++sequence.current;
    return Promise.all([
      requestJson<{ reports: Report[] }>("/api/reports"),
      requestJson<{ events: ReportEvent[] }>("/api/activity"),
    ])
      .then(([data, activity]) => {
        if (current !== sequence.current) return;
        setReports(data.reports);
        setEvents(activity.events);
        setError("");
        setRefreshed(Date.now());
      })
      .catch((e: Error) => {
        if (current === sequence.current) setError(e.message);
      })
      .finally(() => {
        if (current === sequence.current) setLoading(false);
      });
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const visible = useMemo(
    () => reports.filter((r) => showDemo || !r.isDemo),
    [reports, showDemo],
  );
  const filtered = useMemo(
    () =>
      visible.filter(
        (r) =>
          (statusFilter === "All reports" || r.status === statusFilter) &&
          (category === "All categories" || r.category === category) &&
          (department === "All departments" || r.department === department) &&
          [r.id, r.title, r.description, r.locationText, r.department]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [visible, statusFilter, category, department, query],
  );
  const selectedReport = useCallback(
      (report: Report) => setSelected(report.id),
      [],
    ),
    closeDetail = useCallback(() => setSelected(null), []);
  const updated = useCallback(
    (report: Report) => {
      setReports((list) => list.map((r) => (r.id === report.id ? report : r)));
      setToast("Update saved. The report history is up to date.");
      void refresh();
    },
    [refresh],
  );
  const resolved = visible.filter((r) => r.status === "Resolved").length,
    open = visible.length - resolved,
    inProgress = visible.filter((r) => r.status === "In progress").length,
    unassigned = visible.filter(
      (r) => r.department === "Unassigned" && r.status !== "Resolved",
    ).length;
  const ratio = visible.length
    ? Math.round((resolved / visible.length) * 100)
    : 0;
  const pageSize = view === "overview" ? 6 : 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  function exportCsv() {
    const params = new URLSearchParams({
      query,
      status: statusFilter,
      category,
      department,
      demo: String(showDemo),
    });
    // A normal attachment response also works in browsers that block blob downloads.
    window.location.assign("/api/export?" + params.toString());
    setToast(`Downloading ${filtered.length} filtered reports.`);
  }
  const table = (
    <>
      <div className="table-scroll">
        <table className="reports-table">
          <thead>
            <tr>
              <th>DISRUPTION</th>
              <th>DEPARTMENT</th>
              <th>STATUS</th>
              <th>REPORTED</th>
              <th>
                <span className="sr-only">View report</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((report) => (
              <tr key={report.id}>
                <td>
                  <button
                    className="report-title-button"
                    onClick={() => selectedReport(report)}
                  >
                    <CategoryIcon category={report.category} />
                    <span>
                      <strong>{report.title}</strong>
                      <small>
                        {report.id}
                        <i>·</i>
                        {report.locationText}
                        {report.isDemo && <em>DEMO</em>}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <span
                    className={
                      "department-text " +
                      (report.department === "Unassigned" ? "unassigned" : "")
                    }
                  >
                    {report.department === "Unassigned" ? (
                      <Clock size={12} />
                    ) : (
                      <span className="department-dot" />
                    )}
                    {report.department}
                  </span>
                </td>
                <td>
                  <StatusBadge status={report.status} />
                </td>
                <td>
                  <span className="reported-time">
                    {relativeTime(report.createdAt)}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button row-arrow"
                    aria-label={"View " + report.id}
                    onClick={() => selectedReport(report)}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <EmptyState
          title={loading ? "Loading reports…" : "No reports match this view"}
          description={
            loading
              ? "Connecting to your shared workspace."
              : "Try another filter, show sample reports, or submit a new disruption."
          }
          action={
            !loading ? (
              <button
                className="button"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("All reports");
                  setCategory("All categories");
                  setDepartment("All departments");
                }}
              >
                Clear filters
              </button>
            ) : (
              <Spinner />
            )
          }
        />
      )}
      <div className="table-footer">
        <span>
          {filtered.length
            ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} reports`
            : "0 reports"}
        </span>
        {view === "overview" ? (
          <Link className="text-link" href="/disruptions">
            View all disruptions <ArrowRight size={13} />
          </Link>
        ) : (
          <div className="pagination">
            <button
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <span>
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
  return (
    <Shell
      active={view}
      search={query}
      onSearch={view !== "about" ? setQuery : undefined}
    >
      <div className="page-heading">
        <div>
          <div className="eyebrow">{titles[view]?.[0]}</div>
          <h1>{titles[view]?.[1]}</h1>
          <p>{titles[view]?.[2]}</p>
        </div>
        <ReportButton />
      </div>
      {view !== "about" && (
        <div className="demo-bar">
          <span>
            <Info size={13} />
            Private prototype · Demo reports and facilities are illustrative. No
            municipal team is notified.
          </span>
          <label>
            <input
              type="checkbox"
              checked={showDemo}
              onChange={(e) => setShowDemo(e.target.checked)}
            />
            Show demo reports
          </label>
        </div>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}
          <button className="text-link" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}
      {["overview", "disruptions"].includes(view) && (
        <>
          <div className="stat-grid">
            {[
              {
                label: "Open disruptions",
                value: open,
                hint: `${unassigned} awaiting assignment`,
                Icon: ClipboardList,
                tone: "green",
              },
              {
                label: "In progress",
                value: inProgress,
                hint: "Work happening on the ground",
                Icon: Activity,
                tone: "amber",
              },
              {
                label: "Resolved",
                value: resolved,
                hint: "A clear outcome, recorded",
                Icon: CheckCircle2,
                tone: "lime",
              },
              {
                label: "Active departments",
                value: new Set(
                  visible
                    .filter(
                      (r) =>
                        r.status !== "Resolved" &&
                        r.department !== "Unassigned",
                    )
                    .map((r) => r.department),
                ).size,
                hint: "Working together",
                Icon: Building2,
                tone: "blue",
              },
            ].map(({ label, value, hint, Icon, tone }) => (
              <div className="stat-card" key={label}>
                <div className="stat-top">
                  <span>{label}</span>
                  <span className={"stat-icon " + tone}>
                    <Icon size={16} />
                  </span>
                </div>
                <strong>
                  {loading ? "—" : String(value).padStart(2, "0")}
                </strong>
                <small>{hint}</small>
              </div>
            ))}
          </div>
          <div className={view === "overview" ? "dashboard-columns" : ""}>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {view === "overview"
                      ? "Disruption overview"
                      : "All disruptions"}{" "}
                    <span className="count-chip">{visible.length}</span>
                  </h2>
                  <p>
                    Newest reports first. Open a report to coordinate the next
                    step.
                  </p>
                </div>
                <div className="panel-tools">
                  {view === "disruptions" && (
                    <div className="segmented">
                      <button
                        className={display === "list" ? "active" : ""}
                        aria-label="List view"
                        onClick={() => setDisplay("list")}
                      >
                        <List size={15} />
                      </button>
                      <button
                        className={display === "board" ? "active" : ""}
                        aria-label="Status board view"
                        onClick={() => setDisplay("board")}
                      >
                        <Columns3 size={15} />
                      </button>
                    </div>
                  )}
                  <button
                    className="button compact"
                    onClick={exportCsv}
                    disabled={!filtered.length}
                  >
                    <Download size={13} />
                    <span>Export</span>
                  </button>
                </div>
              </div>
              <div className="status-tabs">
                {["All reports", "Reported", "In progress", "Resolved"].map(
                  (status) => (
                    <button
                      key={status}
                      className={statusFilter === status ? "active" : ""}
                      onClick={() => setStatusFilter(status)}
                    >
                      {status}
                      <span>
                        {status === "All reports"
                          ? visible.length
                          : visible.filter((r) => r.status === status).length}
                      </span>
                    </button>
                  ),
                )}
              </div>
              <div className="filter-row">
                <label className="search-box">
                  <Search size={14} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a report, place, or reference…"
                    aria-label="Filter disruptions"
                  />
                </label>
                <select
                  aria-label="Filter by category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option>All categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                {view === "disruptions" && (
                  <select
                    aria-label="Filter by department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option>All departments</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                )}
              </div>
              {display === "board" && view === "disruptions" ? (
                <div className="kanban-board">
                  {STATUSES.map((status) => (
                    <section className="kanban-column" key={status}>
                      <h3>
                        <StatusBadge status={status} />
                        <span>
                          {filtered.filter((r) => r.status === status).length}
                        </span>
                      </h3>
                      {filtered
                        .filter((r) => r.status === status)
                        .map((r) => (
                          <button
                            className="kanban-card"
                            key={r.id}
                            onClick={() => selectedReport(r)}
                          >
                            <span className="kanban-reference">
                              {r.id}
                              {r.isDemo ? " · DEMO" : ""}
                            </span>
                            <CategoryIcon category={r.category} />
                            <strong>{r.title}</strong>
                            <small>
                              <MapPin size={11} />
                              {r.locationText}
                            </small>
                            <span className="tag">{r.department}</span>
                          </button>
                        ))}
                      {!filtered.some((r) => r.status === status) && (
                        <p className="kanban-empty">Nothing here yet.</p>
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                table
              )}
            </div>
            {view === "overview" && (
              <aside className="dashboard-aside">
                <section className="panel progress-panel">
                  <div className="panel-heading">
                    <h2>Resolution progress</h2>
                    <CheckCircle2 size={16} className="muted" />
                  </div>
                  <div
                    className="progress-donut"
                    style={{
                      background: `conic-gradient(#6f9455 0 ${ratio}%, #edf0e7 ${ratio}% 100%)`,
                    }}
                  >
                    <div>
                      <strong>{loading ? "—" : ratio + "%"}</strong>
                      <span>resolved</span>
                    </div>
                  </div>
                  <div className="progress-legend">
                    <span>
                      <i className="resolved-dot" />
                      Resolved <strong>{resolved}</strong>
                    </span>
                    <span>
                      <i />
                      Open <strong>{open}</strong>
                    </span>
                  </div>
                  <p className="chart-note">
                    Based on reports shown in this workspace.
                  </p>
                </section>
                <section className="mission-card">
                  <div className="eyebrow">FROM NOTICE TO ACTION</div>
                  <h2>
                    See something?
                    <br />
                    Start something.
                  </h2>
                  <p>
                    A photo and a few words can
                    <br />
                    make a street a little better.
                  </p>
                  <Link href="/report" className="button light">
                    Open citizen portal <ArrowUpRight size={13} />
                  </Link>
                  <div className="mission-circles" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                </section>
              </aside>
            )}
          </div>
          {view === "overview" && (
            <section className="panel recent-activity">
              <div className="panel-heading">
                <div>
                  <h2>Recently, around the workspace</h2>
                  <p>Small steps forward, captured as they happen.</p>
                </div>
                <Link className="text-link" href="/activity">
                  All activity <ArrowRight size={13} />
                </Link>
              </div>
              <div className="activity-cards">
                {events
                  .filter(
                    (e) =>
                      showDemo ||
                      !reports.find((r) => r.id === e.reportId)?.isDemo,
                  )
                  .slice(0, 3)
                  .map((e) => (
                    <button
                      className="activity-card"
                      key={e.id}
                      onClick={() => setSelected(e.reportId)}
                    >
                      <span className="activity-icon">
                        <CheckCircle2 size={16} />
                      </span>
                      <div>
                        <strong>{e.kind}</strong>
                        <p>
                          {e.reportId} · {e.actor}
                        </p>
                        <small>{relativeTime(e.createdAt)}</small>
                      </div>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
      {view === "map" && (
        <>
          <div className="map-toolbar">
            <label className="search-box">
              <Search size={15} />
              <input
                placeholder="Search mapped reports…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search mapped reports"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter map by status"
            >
              <option>All reports</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <span>
              {filtered.filter((r) => r.latitude !== null).length} mapped
              reports
            </span>
          </div>
          <div className="panel full-map">
            <CityMap
              reports={filtered}
              onSelect={selectedReport}
              showFacilities={showDemo}
            />
            <div className="map-legend">
              <span>
                <i style={{ background: "#527b9b" }} />
                Reported
              </span>
              <span>
                <i style={{ background: "#d09435" }} />
                In progress
              </span>
              <span>
                <i style={{ background: "#679451" }} />
                Resolved
              </span>
              <span>
                <i style={{ background: "#718069" }} />
                Verified / assigned
              </span>
              {showDemo && (
                <span>
                  <i className="facility-dot" />
                  Illustrative facility
                </span>
              )}
            </div>
          </div>
          <div className="map-context">
            <Info size={15} />
            <p>
              Sample reports are placed in a Bengaluru demonstration area. Demo
              facilities are fictional. Reports submitted without coordinates
              remain available in the list; GPS does not determine priority.
            </p>
          </div>
          {filtered.some((r) => r.latitude === null) && (
            <div className="panel">
              <div className="panel-heading">
                <h2>Location needs confirmation</h2>
              </div>
              {filtered
                .filter((r) => r.latitude === null)
                .map((r) => (
                  <button
                    key={r.id}
                    className="location-needed-row"
                    onClick={() => selectedReport(r)}
                  >
                    <span>{r.title}</span>
                    <span>{r.locationText}</span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
            </div>
          )}
        </>
      )}
      {view === "departments" && (
        <div className="department-grid">
          {DEPARTMENTS.slice(1).map((d, i) => {
            const assigned = visible.filter(
              (r) =>
                r.department === d &&
                [r.title, r.locationText, d]
                  .join(" ")
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            );
            const active = assigned.filter((r) => r.status !== "Resolved"),
              done = assigned.length - active.length;
            const Icon = [Route, Lightbulb, Trash2, Droplets, Trees][i];
            return (
              <section className="panel department-card" key={d}>
                <div className="department-card-top">
                  <span
                    className={
                      "stat-icon " +
                      ["green", "amber", "lime", "blue", "green"][i]
                    }
                  >
                    <Icon size={21} />
                  </span>
                  <span className="tag">Demo department</span>
                </div>
                <h2>{d}</h2>
                <p>
                  {
                    [
                      "Roads, pavements, and public infrastructure",
                      "Streetlights and public electrical assets",
                      "Waste collection and public cleanliness",
                      "Water supply, drainage, and flooding",
                      "Trees, parks, and shared green spaces",
                    ][i]
                  }
                </p>
                <div className="department-numbers">
                  <span>
                    <strong>{active.length}</strong>Open reports
                  </span>
                  <span>
                    <strong>{done}</strong>Resolved
                  </span>
                </div>
                <div className="department-progress">
                  <i
                    style={{
                      width: assigned.length
                        ? (done / assigned.length) * 100 + "%"
                        : "0%",
                    }}
                  />
                </div>
                <div className="department-mini-list">
                  {active.slice(0, 3).map((r) => (
                    <button key={r.id} onClick={() => selectedReport(r)}>
                      <span>{r.title}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                  {active.length === 0 && (
                    <span className="muted">No open reports in this view.</span>
                  )}
                </div>
              </section>
            );
          })}
          <section className="department-card unassigned-card">
            <Clock size={25} />
            <h2>Awaiting an owner</h2>
            <strong>{unassigned}</strong>
            <p>
              Open a report and assign it to a department to make the next step
              clear.
            </p>
            <Link className="button" href="/disruptions">
              Review disruptions <ArrowRight size={14} />
            </Link>
          </section>
        </div>
      )}
      {view === "activity" && (
        <section className="panel activity-log">
          <div className="panel-heading">
            <div>
              <h2>Workspace history</h2>
              <p>
                Status changes, assignments, public updates, and internal notes.
                Times are in IST.
              </p>
            </div>
            <button className="button compact" onClick={() => void refresh()}>
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
          <div className="activity-log-body">
            {events
              .filter(
                (e) =>
                  (showDemo ||
                    !reports.find((r) => r.id === e.reportId)?.isDemo) &&
                  [e.reportId, e.note, e.actor, e.kind]
                    .join(" ")
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((e) => (
                <div className="activity-log-entry" key={e.id}>
                  <button
                    className="text-link"
                    onClick={() => setSelected(e.reportId)}
                  >
                    {e.reportId}
                    <ArrowUpRight size={12} />
                  </button>
                  <Timeline events={[e]} />
                </div>
              ))}
            {!events.length && (
              <EmptyState
                title="No activity yet"
                description="Updates will appear here as reports move forward."
              />
            )}
          </div>
        </section>
      )}
      {view === "about" && (
        <div className="about-content">
          <section className="about-hero">
            <div>
              <div className="eyebrow">THE PROBLEM WE ADDRESS</div>
              <h2>
                A complaint is only
                <br />
                the beginning.
              </h2>
              <p>
                When reports are scattered across messages, spreadsheets, and
                phone calls, ownership and progress can become unclear. Reliable
                Snitch brings the report, the responsible department, and every
                update into one shared workflow.
              </p>
              <Link href="/report" className="button light">
                Try the citizen experience <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="about-steps">
              {[
                "Notice a disruption",
                "Share a photo and your words",
                "Give it an owner",
                "Keep progress visible",
                "Close the loop",
              ].map((s, i) => (
                <div key={s}>
                  <span>0{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>
          </section>
          <div className="about-grid">
            <section className="panel prose">
              <ShieldCheck size={25} />
              <h2>What really works</h2>
              <ul>
                <li>Shared, persistent reports and photo uploads.</li>
                <li>
                  GPS with consent, manual coordinates, or a written landmark.
                </li>
                <li>Department assignment and validated status transitions.</li>
                <li>Public updates, internal notes, and citizen tracking.</li>
                <li>
                  Filtering, a location map, a status board, and CSV export.
                </li>
              </ul>
            </section>
            <section className="panel prose">
              <Info size={25} />
              <h2>What is simulated</h2>
              <ul>
                <li>
                  This is a private ideathon demonstration, not a municipal
                  service.
                </li>
                <li>
                  Sample reports, departments, and nearby facilities are
                  illustrative.
                </li>
                <li>
                  Category suggestions use text keywords. No AI image analysis
                  is connected.
                </li>
                <li>
                  Priority is a staff-selected label. No automatic danger score
                  is produced.
                </li>
                <li>
                  All authorised workspace viewers can act as demo operators.
                  Separate citizen/staff roles are not implemented.
                </li>
              </ul>
            </section>
          </div>
          <section className="panel prose">
            <h2>For your ideathon demo</h2>
            <p>
              Open the citizen portal, use a clearly labelled demo location, and
              submit a photo with a short description. Open the new report in
              Disruptions. Verify it, assign a department, move it to In
              progress, and resolve it with a summary. Finally, use the report
              reference in the citizen tracker to show the complete history.
            </p>
            <p>
              <strong>Before a real pilot:</strong> add verified facility data,
              genuine staff permissions, moderation and abuse protection,
              privacy and retention controls, and municipal
              notification/dispatch integrations. Test the workflow with the
              actual teams responsible for responding.
            </p>
          </section>
          <div className="safety-note">
            <Info size={17} />
            <p>
              Do not use this prototype to request emergency help. It does not
              contact emergency services or a real municipal team. Use
              non-sensitive demo photos and avoid identifiable people, number
              plates, and private addresses.
            </p>
          </div>
        </div>
      )}
      {view !== "about" && (
        <div className="sync-note">
          <span className="live-dot" />
          {refreshed
            ? "Shared workspace · refreshes every 15 seconds"
            : "Connecting to shared workspace"}
          <button className="text-link" onClick={() => void refresh()}>
            <RefreshCw size={11} />
            Refresh now
          </button>
        </div>
      )}
      {selected && (
        <ReportDetail
          key={selected}
          id={selected}
          onClose={closeDetail}
          onUpdated={updated}
        />
      )}
      <div
        className={"toast " + (toast ? "visible" : "")}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 size={17} />
        {toast}
      </div>
    </Shell>
  );
}
