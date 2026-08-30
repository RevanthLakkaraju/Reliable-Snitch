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
              For a demonstration, try{" "}
              <button
                className="text-link"
                onClick={() => {
                  setCode("TE-1001");
                  void load("TE-1001");
                }}
              >
                TE-1001
              </button>
              .
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
                {report.photoKey && (
                  <Image
                    unoptimized
                    width={1600}
                    height={1000}
                    src={imageUrl(report.photoKey)}
                    alt="Photo attached to this report"
                  />
                )}
                <small>Submitted {dateLabel(report.createdAt)} IST</small>
              </div>
            </section>
            <section className="panel tracking-history">
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
        <div className="tracker-bottom">
          <span>Something else needs attention?</span>
          <Link href="/report" className="text-link">
            Report a disruption <ArrowUpRight size={13} />
          </Link>
        </div>
      </main>
      <footer className="citizen-footer">
        <span>RELIABLE SNITCH · CIVIC SERVICES MANAGEMENT PORTAL</span>
        <Link href="/about">About this prototype</Link>
      </footer>
    </div>
  );
}
