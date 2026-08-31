"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "../components/navigation-link";
import { CitizenHeader, StatusBadge, Spinner } from "../components/ui";
import CityMap from "../components/city-map";
import { useViewer } from "../access-context";
import { requestJson, imageUrl, preparePhoto, uploadPhoto } from "@/lib/client";
import { dateLabel, type Report } from "@/lib/domain";
type Point = { latitude: number; longitude: number };
export default function CitizenPortal({
  nearby = false,
}: {
  nearby?: boolean;
}) {
  const viewer = useViewer();
  const sequence = useRef(0);
  const [reports, setReports] = useState<Report[]>([]),
    [point, setPoint] = useState<Point | null>(null),
    [locality, setLocality] = useState(""),
    [search, setSearch] = useState(""),
    [radius, setRadius] = useState("3000"),
    [demo, setDemo] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [locationLabel, setLocationLabel] = useState("");
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    if (nearby && !point && search.length < 3) {
      setReports([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ radius, demo: demo ? "1" : "0" });
      if (point) {
        params.set("lat", String(point.latitude));
        params.set("lng", String(point.longitude));
      } else params.set("locality", search);
      const data = await requestJson<{ reports: Report[] }>(
        nearby ? "/api/nearby?" + params : "/api/reports",
      );
      if (current === sequence.current) setReports(data.reports);
    } catch (e) {
      if (current === sequence.current) setError((e as Error).message);
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }, [nearby, point, radius, demo, search]);
  useEffect(() => {
    const tracker = sequence;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      tracker.current++;
    };
  }, [refresh]);
  function locate() {
    setError("");
    setMessage("");
    if (!navigator.geolocation) {
      setError(
        "Location is unavailable. Search a locality or choose a point on the map.",
      );
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoint({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationLabel(
          `Your location · accuracy about ${Math.round(position.coords.accuracy)} m`,
        );
        setBusy(false);
      },
      () => {
        setError(
          "Location was not available. Search a locality, click the map, or explore the labelled demo area.",
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }
  async function action(report: Report, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await requestJson<{ report: Report }>(
        `/api/reports/${report.id}/citizen`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setReports((all) =>
        all.map((r) => (r.id === report.id ? result.report : r)),
      );
      setMessage(
        body.action === "photo"
          ? "Photo submitted for municipal review on the same complaint. No duplicate was created."
          : body.supported
            ? "Your support was recorded on this complaint."
            : "Your support was removed.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="citizen-page">
      <CitizenHeader />
      <main id="citizen-main" className="gov-container citizen-workspace">
        <div className="page-heading">
          <div>
            <span className="eyebrow">CITIZEN SERVICES · {viewer?.name}</span>
            <h1>
              {nearby ? "Complaints in your locality" : "My complaint register"}
            </h1>
            <p>
              {nearby
                ? "Check existing issues before filing a new complaint. Public summaries never show the complainant’s account details."
                : "Only complaints submitted through your account appear here."}
            </p>
          </div>
          <Link className="button primary" href="/report">
            Register a complaint
          </Link>
        </div>
        <div className="demo-notice">
          Demonstration only. No municipal or emergency service is notified. Use
          non-sensitive information.
        </div>
        {nearby ? (
          <section className="panel locality-panel">
            <div className="locality-controls">
              <button
                className="button primary"
                disabled={busy}
                onClick={locate}
              >
                Use my live location
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => {
                  setPoint({ latitude: 12.9716, longitude: 77.5946 });
                  setLocationLabel(
                    "Illustrative Bengaluru locality—not your GPS position",
                  );
                }}
              >
                Explore Bengaluru demo
              </button>
              <label>
                Search radius
                <select
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                >
                  <option value="1000">1 km</option>
                  <option value="3000">3 km</option>
                  <option value="5000">5 km</option>
                  <option value="10000">10 km</option>
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={demo}
                  onChange={(e) => setDemo(e.target.checked)}
                />
                Include labelled demo complaints
              </label>
            </div>
            <form
              className="locality-search"
              onSubmit={(e) => {
                e.preventDefault();
                setPoint(null);
                setSearch(locality.trim());
                setLocationLabel("Locality text search: " + locality);
              }}
            >
              <label>
                Locality or landmark
                <input
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="e.g. Market Road"
                  minLength={3}
                  required
                />
              </label>
              <button className="button" disabled={busy}>
                Search locality
              </button>
            </form>
            <p className="field-hint">
              {locationLabel ||
                "Choose your live location, search a locality or click a point on the map. The initial map view is Bengaluru, not a detected location."}
            </p>
            <CityMap
              reports={reports}
              selected={point}
              onPick={(p) => {
                setPoint(p);
                setLocationLabel("Manually chosen point—not live GPS");
              }}
              onSelect={(r) => {
                setSelected(r.id);
                document
                  .getElementById("complaint-" + r.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </section>
        ) : (
          <div className="citizen-summary">
            <div className="panel">
              <strong>{reports.length}</strong>
              <span>My complaints</span>
            </div>
            <div className="panel">
              <strong>
                {
                  reports.filter(
                    (r) => !["Resolved", "Closed"].includes(r.status),
                  ).length
                }
              </strong>
              <span>Awaiting completion</span>
            </div>
            <div className="panel">
              <strong>{reports.filter((r) => r.clarification).length}</strong>
              <span>Need my clarification</span>
            </div>
            <Link className="panel" href="/nearby">
              <strong>Locality map →</strong>
              <span>Check before reporting the same issue</span>
            </Link>
          </div>
        )}
        {!nearby && (
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await requestJson("/api/demo", { method: "POST" });
                await refresh();
                setMessage(
                  "Two clearly labelled sample complaints are available in your account. Loading again does not duplicate them.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Load my demonstration complaints
          </button>
        )}
        <div className="register-toolbar">
          <h2>
            {nearby ? "Nearby complaint summaries" : "My submissions"}{" "}
            <span className="tag">{reports.length}</span>
          </h2>
          <button
            className="button"
            onClick={() => void refresh()}
            disabled={busy}
          >
            {busy ? <Spinner /> : null}Refresh list
          </button>
        </div>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {message && (
          <p className="success-message" role="status">
            {message}
          </p>
        )}
        {!busy && !reports.length && (
          <div className="empty-state">
            <h3>
              {nearby
                ? "No matching complaints in this area"
                : "No complaints in your account yet"}
            </h3>
            <p>
              {nearby
                ? "Try a wider radius, a different locality, or the labelled Bengaluru demonstration."
                : "Submit a complaint to receive a reference and follow its progress here."}
            </p>
          </div>
        )}
        <div className="complaint-grid">
          {reports.map((report) => {
            const photo = report.photoKey
              ? imageUrl(report.photoKey)
              : report.demoPhoto;
            return (
              <article
                className="panel complaint-card"
                id={"complaint-" + report.id}
                key={report.id}
              >
                {photo ? (
                  <Image
                    unoptimized
                    src={photo}
                    alt={
                      report.isDemo
                        ? "Illustrative Indian street photograph for " +
                          report.title
                        : "Complaint photo: " + report.title
                    }
                    width={800}
                    height={450}
                  />
                ) : (
                  <div className="photo-unavailable">
                    {report.canContributePhoto
                      ? "No photograph attached"
                      : "Photo unavailable or awaiting review"}
                  </div>
                )}
                {report.demoPhoto && (
                  <small className="photo-credit">
                    Illustrative photograph · Not evidence of this demo incident
                    · <Link href="/about#photo-credits">Photo credits</Link>
                  </small>
                )}
                <div className="complaint-card-body">
                  <div className="register-toolbar">
                    <span>
                      {report.id}
                      {report.isDemo ? " · DEMO" : ""}
                    </span>
                    <StatusBadge status={report.status} />
                  </div>
                  <h3>{report.title}</h3>
                  <p>{report.locationText}</p>
                  <small>
                    {report.ward} · {dateLabel(report.createdAt)} IST
                  </small>
                  {report.provider && (
                    <p>
                      <strong>Service provider:</strong> {report.provider}
                      <br />
                      {report.coordination}
                    </p>
                  )}
                  <button
                    className="text-link"
                    aria-expanded={selected === report.id}
                    onClick={() =>
                      setSelected(selected === report.id ? null : report.id)
                    }
                  >
                    {selected === report.id
                      ? "Hide details"
                      : "View complaint details"}
                  </button>
                  {selected === report.id && (
                    <div className="complaint-description">
                      <p>{report.description}</p>
                      <p>Department: {report.department}</p>
                      {report.clarification && (
                        <p>
                          <strong>Clarification requested:</strong>{" "}
                          {report.clarification}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="card-actions">
                    {report.owned ? (
                      <Link
                        className="button primary"
                        href={"/track?code=" + report.id}
                      >
                        Track my complaint
                      </Link>
                    ) : (
                      <button
                        className="button"
                        aria-pressed={!!report.supported}
                        disabled={busy}
                        onClick={() =>
                          void action(report, {
                            action: "support",
                            supported: !report.supported,
                          })
                        }
                      >
                        {report.supported
                          ? "Undo my support"
                          : "I’m affected too"}
                      </button>
                    )}
                    <span>
                      {report.supportCount ?? 0} citizen
                      {report.supportCount === 1 ? "" : "s"} affected
                    </span>
                  </div>
                  {nearby && report.canContributePhoto && !photo && (
                    <label className="photo-contribution">
                      Add the missing photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setBusy(true);
                          setError("");
                          try {
                            const key = await uploadPhoto(
                              await preparePhoto(file),
                            );
                            await action(report, {
                              action: "photo",
                              photoKey: key,
                            });
                          } catch (error) {
                            setError((error as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                      <small>
                        Keep it relevant to this issue. It appears publicly only
                        after municipal review.
                      </small>
                    </label>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
