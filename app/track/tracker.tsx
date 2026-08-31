"use client";
import Image from "next/image";

import Link from "../components/navigation-link";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Search,
  ArrowRight,
  MapPin,
  RefreshCw,
  Building2,
  Info,
  ArrowUpRight,
} from "lucide-react";
import { type Report, type ReportEvent, dateLabel } from "@/lib/domain";
import { requestJson, imageUrl } from "@/lib/client";
import { CitizenHeader, StatusBadge, Stepper, Spinner } from "../components/ui";
import { Timeline } from "../components/report-detail";
import { useViewer } from "../access-context";
export default function Tracker({
  initialCode = "",
  initialReport = null,
  initialEvents = [],
  initialError = "",
}: {
  initialCode?: string;
  initialReport?: Report | null;
  initialEvents?: ReportEvent[];
  initialError?: string;
}) {
  const viewer = useViewer();
  const [reply, setReply] = useState(""),
    [replyMessage, setReplyMessage] = useState("");
  const [code, setCode] = useState(initialCode.toUpperCase()),
    [loadedCode, setLoadedCode] = useState(initialReport?.id ?? ""),
    [report, setReport] = useState<Report | null>(initialReport),
    [events, setEvents] = useState<ReportEvent[]>(initialEvents),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError);
  const sequence = useRef(0);
  const load = useCallback(async (reference: string) => {
    const request = ++sequence.current;
    const id = reference.trim().toUpperCase();
    if (!/^TE-[A-Z0-9]{4,12}$/.test(id)) {
      setError("Enter a report reference such as TE-1001.");
      setReport(null);
      setEvents([]);
      setLoadedCode("");
      setBusy(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await requestJson<{ report: Report; events: ReportEvent[] }>(
        "/api/reports/" + encodeURIComponent(id) + "?public=1",
      );
      if (request !== sequence.current) return;
      setReport(data.report);
      setEvents(data.events);
      setLoadedCode(id);
    } catch (e) {
      if (request !== sequence.current) return;
      setError((e as Error).message);
      setReport(null);
      setEvents([]);
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (initialCode) void load(initialCode);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialCode, load]);
  async function citizenAction(action: string) {
    if (!report) return;
    setBusy(true);
    setError("");
    setReplyMessage("");
    try {
      await requestJson(`/api/reports/${report.id}/citizen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: reply,
          revision: report.revision,
        }),
      });
      await load(report.id);
      setReply("");
      setReplyMessage("Your response was recorded on this complaint.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!loadedCode) return;
    const timer = setInterval(() => {
      if (!document.hidden) void load(loadedCode);
    }, 20000);
    return () => clearInterval(timer);
  }, [loadedCode, load]);
  function submit(e: FormEvent) {
    e.preventDefault();
    setLoadedCode("");
    void load(code);
  }
  return (
    <div className="citizen-page">
      <CitizenHeader />
      <main className="tracker-layout" id="citizen-main">
        <div className="tracker-intro">
          <div className="eyebrow">CITIZEN SERVICES</div>
          <h1>Track report status</h1>
          <p>
            Enter your report reference to view its status, assigned department
            and public updates.
          </p>
        </div>
        <form className="tracking-search" onSubmit={submit}>
          <label htmlFor="tracking-code" className="sr-only">
            Report reference
          </label>
          <Search size={18} />
          <input
            id="tracking-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter your reference, e.g. TE-1001"
            maxLength={16}
            required
            autoComplete="off"
          />
          <button className="button primary" disabled={busy}>
            {busy ? (
              <Spinner />
            ) : (
              <>
                Track report <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {!report && !busy && !error && (
          <div className="tracker-empty">
            <h2>Where to find your reference number</h2>
            <p>
              Your reference was shown when you submitted the report.
              <br />
              <Link
                href={viewer?.role === "official" ? "/disruptions" : "/citizen"}
              >
                Open your complaint register
              </Link>{" "}
              to find an accessible reference.
            </p>
          </div>
        )}
        {report && (
          <div className="tracking-result">
            <section className="panel tracking-report">
              <div className="tracking-report-top">
                <span className="detail-reference">
                  {report.id}
                  {report.isDemo && <span className="tag">Demo report</span>}
                </span>
                <StatusBadge status={report.status} />
              </div>
              <h2>{report.title}</h2>
              <div className="receipt-meta">
                <span>
                  <strong>Registered:</strong> {dateLabel(report.createdAt)} IST
                </span>
                <span>
                  <strong>Locality / ward:</strong> {report.ward}
                </span>
                <span>
                  <strong>Category:</strong> {report.category}
                </span>
                <span>
                  <strong>Provider:</strong>{" "}
                  {report.provider || "Not applicable"}
                </span>
                {report.provider && (
                  <>
                    <span>
                      <strong>Provider stage:</strong> {report.coordination}
                    </span>
                    <span>
                      <strong>Provider reference:</strong>{" "}
                      {report.providerTicket || "Not recorded"}
                    </span>
                  </>
                )}
              </div>
              <button className="button" onClick={() => window.print()}>
                Print acknowledgement
              </button>
              <p className="tracking-location">
                <MapPin size={14} />
                {report.locationText}
              </p>
              <Stepper status={report.status} />
              <div className="tracking-owner">
                <Building2 size={18} />
                <div>
                  <small>RESPONSIBLE DEPARTMENT</small>
                  <strong>
                    {report.department === "Unassigned"
                      ? "Awaiting assignment"
                      : report.department}
                  </strong>
                </div>
                <button
                  className="icon-button"
                  onClick={() => void load(report.id)}
                  aria-label="Refresh report"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <div className="tracking-description">
                <h3>Your report</h3>
                <p>{report.description}</p>
                {(report.photoKey || report.demoPhoto) && (
                  <Image
                    unoptimized
                    width={1600}
                    height={1000}
                    src={
                      report.photoKey
                        ? imageUrl(report.photoKey)
                        : report.demoPhoto!
                    }
                    alt="Photo attached to this report"
                  />
                )}
                {report.demoPhoto && (
                  <small className="photo-credit">
                    Illustrative photograph, not incident evidence.{" "}
                    <Link href="/about#photo-credits">Photo credits</Link>
                  </small>
                )}
                <small>Submitted {dateLabel(report.createdAt)} IST</small>
              </div>
            </section>
            <section className="panel tracking-history">
              {report.owned &&
                (report.clarification ||
                  ["Resolved", "Closed"].includes(report.status)) && (
                  <div className="citizen-response">
                    <h3>
                      {report.clarification
                        ? "Clarification requested"
                        : "Review the resolution"}
                    </h3>
                    {report.clarification && <p>{report.clarification}</p>}
                    <label>
                      Reply or reopening reason
                      <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        maxLength={2000}
                        placeholder="At least 12 characters for a reply or reopening request"
                      />
                    </label>
                    {report.clarification && (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void citizenAction("reply")}
                      >
                        Send clarification
                      </button>
                    )}
                    {report.status === "Resolved" && (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void citizenAction("confirm")}
                      >
                        Confirm resolved & close
                      </button>
                    )}
                    {["Resolved", "Closed"].includes(report.status) && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => void citizenAction("reopen")}
                      >
                        Request reopening
                      </button>
                    )}
                  </div>
                )}
              {replyMessage && (
                <p className="success-message" role="status">
                  {replyMessage}
                </p>
              )}
              <div className="panel-heading">
                <div>
                  <h2>Report progress and public updates</h2>
                  <p>Public updates from the demonstration operations team.</p>
                </div>
              </div>
              <Timeline events={events} />
            </section>
            <div className="map-context">
              <Info size={15} />
              <p>
                This is an ideathon prototype. Status changes represent demo
                actions, not verified municipal work. Internal staff notes are
                not shown in this citizen view.
              </p>
            </div>
          </div>
        )}
        {viewer?.role !== "official" && (
          <div className="tracker-bottom">
            <span>Something else needs attention?</span>
            <Link href="/report" className="text-link">
              Report a disruption <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
      </main>
      <footer className="citizen-footer">
        <span>RELIABLE SNITCH · CIVIC SERVICES MANAGEMENT PORTAL</span>
        <Link href="/about">About this prototype</Link>
      </footer>
    </div>
  );
}
