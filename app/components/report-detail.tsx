"use client";
import Image from "next/image";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import {
  X,
  MapPin,
  ArrowUpRight,
  MessageSquare,
  Clock,
  CheckCircle2,
  ImageIcon,
  LockKeyhole,
  Copy,
} from "lucide-react";
import {
  CATEGORIES,
  DEPARTMENTS,
  PRIORITIES,
  STATUSES,
  dateLabel,
  type Report,
  type ReportEvent,
  type Status,
  type Category,
  type Department,
  type Priority,
} from "@/lib/domain";
import { requestJson, imageUrl, preparePhoto, uploadPhoto } from "@/lib/client";
import { StatusBadge, Stepper, Spinner } from "./ui";
export function Timeline({ events }: { events: ReportEvent[] }) {
  return (
    <div className="timeline">
      {events.map((event) => (
        <div className="timeline-item" key={event.id}>
          <span
            className={
              "timeline-dot " +
              (event.kind.includes("Resolution") ? "finished" : "")
            }
          >
            <Clock size={11} />
          </span>
          <div>
            <div className="timeline-title">
              <strong>{event.kind}</strong>
              {event.visibility === "internal" && (
                <span className="tag">
                  <LockKeyhole size={10} /> Internal
                </span>
              )}
              <time>{dateLabel(event.createdAt)} IST</time>
            </div>
            <p>{event.note}</p>
            <small>{event.actor}</small>
            {"photoKey" in event && typeof event.photoKey === "string" && (
              <Link
                href={imageUrl(event.photoKey)}
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  unoptimized
                  width={1600}
                  height={1000}
                  className="timeline-photo"
                  src={imageUrl(event.photoKey)}
                  alt="Resolution evidence attached by operations"
                />
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
export default function ReportDetail({
  id,
  onClose,
  onUpdated,
}: {
  id: string;
  onClose: () => void;
  onUpdated: (report: Report) => void;
}) {
  const [report, setReport] = useState<Report | null>(null),
    [events, setEvents] = useState<ReportEvent[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("overview"),
    [note, setNote] = useState(""),
    [internal, setInternal] = useState(false),
    [copied, setCopied] = useState(false),
    [resolutionFile, setResolutionFile] = useState<File | null>(null),
    [photoBusy, setPhotoBusy] = useState(false);
  const [status, setStatus] = useState<Status>("Reported"),
    [category, setCategory] = useState<Category>("Needs classification"),
    [department, setDepartment] = useState<Department>("Unassigned"),
    [priority, setPriority] = useState<Priority>("Unassessed");
  const closeRef = useRef<HTMLButtonElement>(null),
    panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    requestJson<{ report: Report; events: ReportEvent[] }>(
      "/api/reports/" + encodeURIComponent(id),
    )
      .then((data) => {
        if (cancelled) return;
        setReport(data.report);
        setEvents(data.events);
        setStatus(data.report.status);
        setCategory(data.report.category);
        setDepartment(data.report.department);
        setPriority(data.report.priority);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const els = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
          ),
        ).filter((el) => el.offsetParent !== null);
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  async function save() {
    if (!report) return;
    setBusy(true);
    setError("");
    try {
      const resolutionPhotoKey =
        status === "Resolved" && resolutionFile
          ? await uploadPhoto(resolutionFile)
          : null;
      const data = await requestJson<{ report: Report; events: ReportEvent[] }>(
        "/api/reports/" + id,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: report.revision,
            status,
            category,
            department,
            priority,
            note,
            visibility:
              status === "Resolved"
                ? "public"
                : internal
                  ? "internal"
                  : "public",
            resolutionPhotoKey,
          }),
        },
      );
      setReport(data.report);
      setEvents(data.events);
      setNote("");
      setResolutionFile(null);
      onUpdated(data.report);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(report?.id ?? id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy is unavailable. Select the report reference to copy it.");
    }
  }
  const changed =
    report &&
    (status !== report.status ||
      category !== report.category ||
      department !== report.department ||
      priority !== report.priority);
  return (
    <div className="drawer-overlay">
      <button
        className="drawer-backdrop"
        aria-label="Close report details"
        onClick={onClose}
      />
      <section
        className="report-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        ref={panelRef}
      >
        <header className="drawer-top">
          <span>DISRUPTION DETAILS</span>
          <button
            ref={closeRef}
            className="icon-button"
            aria-label="Close report details"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {!report ? (
          <div className="drawer-body">
            {error ? (
              <div className="error-message" role="alert">
                {error}
              </div>
            ) : (
              <p className="loading-message">
                <Spinner />
                Loading report…
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="detail-heading">
              <div className="detail-reference">
                <span>{report.id}</span>
                <button
                  className="icon-button"
                  onClick={copy}
                  aria-label="Copy report reference"
                >
                  {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                </button>
                {report.isDemo && <span className="tag">Demo report</span>}
              </div>
              <h2 id="detail-title">{report.title}</h2>
              <div className="detail-subline">
                <StatusBadge status={report.status} />
                <span>
                  <MapPin size={13} />
                  {report.locationText}
                </span>
              </div>
              <Stepper status={report.status} />
            </div>
            <div className="detail-tabs">
              <button
                className={tab === "overview" ? "active" : ""}
                onClick={() => setTab("overview")}
              >
                Overview
              </button>
              <button
                className={tab === "history" ? "active" : ""}
                onClick={() => setTab("history")}
              >
                Activity <span>{events.length}</span>
              </button>
            </div>
            <div className="drawer-body">
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
              {tab === "history" ? (
                <Timeline events={events} />
              ) : (
                <>
                  <div className="evidence-photo">
                    {report.photoKey ? (
                      <Link
                        href={imageUrl(report.photoKey)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Image
                          unoptimized
                          width={1600}
                          height={1000}
                          src={imageUrl(report.photoKey)}
                          alt={"Citizen photo for " + report.title}
                        />
                        <span>
                          Open original <ArrowUpRight size={12} />
                        </span>
                      </Link>
                    ) : (
                      <div className="no-photo">
                        <ImageIcon size={28} />
                        <span>
                          {report.isDemo
                            ? "Illustrative report · no photograph"
                            : "No photograph attached"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="detail-section">
                    <h3>What was reported</h3>
                    <p className="description-text">{report.description}</p>
                    <small className="muted">
                      Submitted {dateLabel(report.createdAt)} IST ·
                      Citizen-reported, awaiting verification
                    </small>
                  </div>
                  <div className="context-panel">
                    <h3>Location & impact context</h3>
                    {report.latitude !== null && report.longitude !== null ? (
                      <>
                        <p>
                          <MapPin size={14} />
                          {report.latitude.toFixed(5)},{" "}
                          {report.longitude.toFixed(5)}{" "}
                          <span className="tag">{report.locationSource}</span>
                        </p>
                        {report.accuracy !== null && (
                          <small>
                            Device-reported accuracy: approximately ±
                            {Math.round(report.accuracy)} m
                          </small>
                        )}
                        <Link
                          className="text-link"
                          href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=17/${report.latitude}/${report.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open location <ArrowUpRight size={12} />
                        </Link>
                      </>
                    ) : (
                      <p>Landmark provided; map position needs verification.</p>
                    )}
                    <div className="impact-lines">
                      <p>
                        <strong>Extent</strong>
                        {report.context.scale}
                      </p>
                      <p>
                        <strong>Access</strong>
                        {report.context.access}
                      </p>
                      <p>
                        <strong>Safety</strong>
                        {report.context.safety}
                      </p>
                    </div>
                    {report.context.facilities.length > 0 && (
                      <div className="facility-list">
                        {report.context.facilities.map((f) => (
                          <div key={f.name}>
                            <span>{f.name}</span>
                            <strong>
                              {f.distance < 1000
                                ? `${f.distance} m`
                                : `${(f.distance / 1000).toFixed(1)} km`}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                    <small>{report.context.facilityNote}</small>
                  </div>
                  <div className="detail-section">
                    <h3>Coordinate the next step</h3>
                    <p className="field-hint">
                      Staff decisions are recorded in the report history.
                    </p>
                    <div className="field-grid">
                      <label>
                        Department
                        <select
                          value={department}
                          onChange={(e) =>
                            setDepartment(e.target.value as Department)
                          }
                        >
                          {DEPARTMENTS.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Status
                        <select
                          value={status}
                          onChange={(e) => {
                            setStatus(e.target.value as Status);
                            if (e.target.value === "Resolved")
                              setInternal(false);
                          }}
                        >
                          {STATUSES.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Category
                        <select
                          value={category}
                          onChange={(e) =>
                            setCategory(e.target.value as Category)
                          }
                        >
                          {CATEGORIES.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Priority <span className="muted">optional</span>
                        <select
                          value={priority}
                          onChange={(e) =>
                            setPriority(e.target.value as Priority)
                          }
                        >
                          {PRIORITIES.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="field-hint">
                      {report.context.categoryReason}
                    </p>
                    <label className="form-label">
                      {status === "Resolved"
                        ? "Resolution summary"
                        : "Add an update"}
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={2000}
                        rows={3}
                        placeholder={
                          status === "Resolved"
                            ? "What was fixed, and how was completion checked?"
                            : "What happened? What should the team or citizen know?"
                        }
                      />
                    </label>
                    {status === "Resolved" && (
                      <label className="form-label resolution-upload">
                        Resolution photo{" "}
                        <span className="muted">
                          Optional supporting evidence
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={busy || photoBusy}
                          onChange={async (e) => {
                            const selected = e.target.files?.[0];
                            if (!selected) return;
                            setPhotoBusy(true);
                            setError("");
                            try {
                              setResolutionFile(await preparePhoto(selected));
                            } catch (error) {
                              setError((error as Error).message);
                            } finally {
                              setPhotoBusy(false);
                            }
                          }}
                        />
                        {photoBusy ? (
                          <span className="field-hint">
                            Preparing evidence…
                          </span>
                        ) : resolutionFile ? (
                          <span className="field-hint">
                            Photo prepared and ready to attach.
                          </span>
                        ) : null}
                      </label>
                    )}
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={internal}
                        disabled={status === "Resolved"}
                        onChange={(e) => setInternal(e.target.checked)}
                      />
                      <LockKeyhole size={12} />
                      Internal note only{" "}
                      {!changed
                        ? ""
                        : "· Workflow changes are visible to citizens"}
                    </label>
                    <div className="detail-actions">
                      <Link
                        className="button"
                        href={"/track?code=" + report.id}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Citizen view <ArrowUpRight size={13} />
                      </Link>
                      <button
                        className="button primary"
                        disabled={busy || photoBusy}
                        onClick={save}
                      >
                        {busy ? <Spinner /> : <CheckCircle2 size={15} />}Save
                        update
                      </button>
                    </div>
                  </div>
                  <div className="detail-section">
                    <h3>
                      <MessageSquare size={15} /> Latest updates
                    </h3>
                    <Timeline events={events.slice(0, 3)} />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
