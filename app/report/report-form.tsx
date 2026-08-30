"use client";
import Image from "next/image";

import Link from "../components/navigation-link";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Camera,
  Upload,
  MapPin,
  LocateFixed,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ArrowUpRight,
  ImageIcon,
  X,
  Info,
  MessageSquare,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import {
  classify,
  DEMO_LOCATIONS,
  type Report,
  type LocationSource,
} from "@/lib/domain";
import { preparePhoto, requestJson, uploadPhoto } from "@/lib/client";
import { CitizenHeader, Spinner } from "../components/ui";
import CityMap from "../components/city-map";
import CameraCapture from "../components/camera-capture";
export default function ReportForm() {
  const [description, setDescription] = useState(""),
    [locationText, setLocationText] = useState(""),
    [point, setPoint] = useState<{
      latitude: number;
      longitude: number;
    } | null>(null),
    [accuracy, setAccuracy] = useState<number | null>(null),
    [source, setSource] = useState<LocationSource>("description"),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [photoBusy, setPhotoBusy] = useState(false),
    [cameraOpen, setCameraOpen] = useState(false),
    [gpsBusy, setGpsBusy] = useState(false),
    [mapOpen, setMapOpen] = useState(false),
    [demoOpen, setDemoOpen] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState<Report | null>(null),
    [copied, setCopied] = useState(false);
  const requestId = useRef(""),
    uploadedKey = useRef<string | null>(null),
    photoGeneration = useRef(0),
    gpsGeneration = useRef(0),
    submitLock = useRef(false);
  useEffect(() => {
    requestId.current = crypto.randomUUID();
  }, []);
  const previewRef = useRef("");
  useEffect(
    () => () => {
      photoGeneration.current++;
      gpsGeneration.current++;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  async function photo(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    await acceptPhoto(chosen);
  }
  async function acceptPhoto(chosen: File) {
    const generation = ++photoGeneration.current;
    setPhotoBusy(true);
    setError("");
    try {
      const prepared = await preparePhoto(chosen);
      if (generation !== photoGeneration.current) return;
      setFile(prepared);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = URL.createObjectURL(prepared);
      setPreview(previewRef.current);
      uploadedKey.current = null;
    } catch (e) {
      if (generation === photoGeneration.current)
        setError((e as Error).message);
    } finally {
      if (generation === photoGeneration.current) setPhotoBusy(false);
    }
  }
  function gps() {
    setError("");
    if (!window.isSecureContext) {
      setError(
        "Location access needs HTTPS. Use a landmark or manually place the pin instead.",
      );
      return;
    }
    if (!navigator.geolocation) {
      setError(
        "This browser does not support location access. Enter a landmark instead.",
      );
      return;
    }
    setGpsBusy(true);
    const generation = ++gpsGeneration.current;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (generation !== gpsGeneration.current) return;
        const p = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setPoint(p);
        setAccuracy(position.coords.accuracy);
        setSource("gps");
        setMapOpen(true);
        setConfirmed(false);
        setLocationText(`${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`);
        setGpsBusy(false);
      },
      (err) => {
        if (generation !== gpsGeneration.current) return;
        setGpsBusy(false);
        setError(
          err.code === 1
            ? "Location permission was not granted. You can still enter a landmark or place a pin."
            : "Could not get a reliable location. Try again, enter a landmark, or place a pin.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current) return;
    setError("");
    if (!confirmed) {
      setError("Please confirm the issue location before submitting.");
      return;
    }
    if (photoBusy || gpsBusy) return;
    submitLock.current = true;
    setBusy(true);
    try {
      if (file && !uploadedKey.current) {
        setPhase("Saving your photo…");
        uploadedKey.current = await uploadPhoto(file);
      }
      setPhase("Creating your report…");
      const { report } = await requestJson<{ report: Report }>("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          description,
          locationText,
          latitude: point?.latitude ?? null,
          longitude: point?.longitude ?? null,
          accuracy,
          locationSource: source,
          photoKey: uploadedKey.current,
        }),
      });
      setSuccess(report);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      submitLock.current = false;
      setPhase("");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(success?.id ?? "");
      setCopied(true);
    } catch {
      setError(
        "Copy is unavailable. You can select the reference below to copy it.",
      );
    }
  }
  function sample(index: number) {
    gpsGeneration.current++;
    setGpsBusy(false);
    const loc = DEMO_LOCATIONS[index];
    setPoint({ latitude: loc.latitude, longitude: loc.longitude });
    setLocationText(loc.name);
    setSource("demo");
    setAccuracy(null);
    setMapOpen(true);
    setConfirmed(false);
    setDemoOpen(false);
  }
  function resetReport() {
    photoGeneration.current++;
    gpsGeneration.current++;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
    uploadedKey.current = null;
    requestId.current = crypto.randomUUID();
    setDescription("");
    setLocationText("");
    setPoint(null);
    setAccuracy(null);
    setSource("description");
    setFile(null);
    setPreview("");
    setPhotoBusy(false);
    setGpsBusy(false);
    setCameraOpen(false);
    setMapOpen(false);
    setDemoOpen(false);
    setConfirmed(false);
    setError("");
    setCopied(false);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <div className="citizen-page">
      <CitizenHeader />
      {success ? (
        <main className="success-layout" id="citizen-main">
          <div className="success-icon">
            <CheckCircle2 size={36} />
          </div>
          <div className="eyebrow">REPORT ACKNOWLEDGEMENT</div>
          <h1>Report registered successfully</h1>
          <p>
            It’s saved in the demonstration workspace and ready for review.
            <br />
            No real municipal team has been notified.
          </p>
          <div className="reference-card">
            <span>YOUR REPORT REFERENCE</span>
            <strong>{success.id}</strong>
            <button className="button" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
              {copied ? "Copied" : "Copy reference"}
            </button>
          </div>
          <div className="success-summary">
            <span className="status reported">Reported</span>
            <h2>{success.title}</h2>
            <p>
              <MapPin size={13} />
              {success.locationText}
            </p>
            {success.isDemo && <span className="tag">Demo location</span>}
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="success-actions">
            <Link className="button primary" href={"/track?code=" + success.id}>
              Track this report <ArrowRight size={15} />
            </Link>
            <Link className="button" href="/disruptions">
              Open operations <ArrowUpRight size={14} />
            </Link>
          </div>
          <button type="button" onClick={resetReport} className="text-link">
            Report another disruption
          </button>
        </main>
      ) : (
        <main className="report-layout" id="citizen-main">
          <aside className="report-intro">
            <div className="eyebrow">CITIZEN SERVICES</div>
            <h1>Report a civic disruption</h1>
            <p>
              Provide the issue details and location for review. You will
              receive a reference number to track your report.
            </p>
            <div className="report-steps">
              <div>
                <span>
                  <Camera size={18} />
                </span>
                <section>
                  <h3>1. Attach a photograph</h3>
                  <p>A photo helps the team understand the issue.</p>
                </section>
              </div>
              <div>
                <span>
                  <MessageSquare size={18} />
                </span>
                <section>
                  <h3>2. Describe the disruption</h3>
                  <p>
                    Explain the issue and its effect on people in your own
                    words.
                  </p>
                </section>
              </div>
              <div>
                <span>
                  <MapPin size={18} />
                </span>
                <section>
                  <h3>3. Confirm the location</h3>
                  <p>Use your location, a map pin, or a landmark.</p>
                </section>
              </div>
            </div>
            <div className="intro-note">
              <ShieldCheck size={18} />
              <p>
                Your report gets a reference and a visible history. You can
                follow it from review to resolution.
              </p>
            </div>
          </aside>
          <section className="report-form-panel">
            <div className="form-heading">
              <h2>Disruption registration form</h2>
              <span className="tag">New report</span>
            </div>
            <div className="form-demo-note">
              <Info size={14} />
              <span>
                Private ideathon demo. Use non-sensitive photos. This is not an
                emergency reporting service.
              </span>
            </div>
            <form onSubmit={submit}>
              <fieldset disabled={busy}>
                <div className="field-heading">
                  <h3>
                    <span>01</span>Add a photo
                  </h3>
                  <small>Optional, but helpful</small>
                </div>
                {preview ? (
                  <div className="upload-preview">
                    <Image
                      unoptimized
                      width={1600}
                      height={1000}
                      src={preview}
                      alt="Your selected report photo"
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove attached photo"
                      onClick={() => {
                        photoGeneration.current++;
                        setFile(null);
                        if (previewRef.current)
                          URL.revokeObjectURL(previewRef.current);
                        previewRef.current = "";
                        setPreview("");
                        uploadedKey.current = null;
                        setPhotoBusy(false);
                      }}
                    >
                      <X size={16} />
                    </button>
                    <span>
                      <CheckCircle2 size={12} />
                      Photo ready · {Math.round((file?.size ?? 0) / 1024)} KB
                    </span>
                  </div>
                ) : (
                  <div className="upload-zone">
                    <div className="upload-zone-icon">
                      {photoBusy ? <Spinner /> : <ImageIcon size={27} />}
                    </div>
                    <strong>
                      {photoBusy
                        ? "Preparing your photo…"
                        : "Attach a clear photograph of the issue"}
                    </strong>
                    <p>JPEG, PNG, or WebP · up to 20 MB before compression</p>
                    <div className="upload-actions">
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => setCameraOpen(true)}
                        disabled={photoBusy}
                      >
                        <Camera size={14} />
                        Take photo
                      </button>
                      <label className="button">
                        <Upload size={14} />
                        Upload photo
                        <input
                          className="file-input"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={photo}
                          disabled={photoBusy}
                          aria-label="Upload a report photo"
                        />
                      </label>
                    </div>
                  </div>
                )}
                <p className="field-hint">
                  Avoid faces, number plates, and private details. Photos are
                  compressed and original metadata is removed before upload.
                </p>
                <div className="field-heading">
                  <h3>
                    <span>02</span>Description of the disruption
                  </h3>
                  <small>Required</small>
                </div>
                <label className="sr-only" htmlFor="description">
                  Describe the disruption
                </label>
                <textarea
                  id="description"
                  className="report-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={12}
                  maxLength={2000}
                  rows={5}
                  placeholder="For example: There’s a large pothole outside the school gate. It takes up half the lane, and bikes have to swerve around it."
                />
                <div className="textarea-footer">
                  <span>
                    {description.trim().length >= 12
                      ? "Suggested category: " + classify(description)
                      : "Include what, where, and how it affects people."}
                  </span>
                  <span>{description.length}/2,000</span>
                </div>
                <p className="field-hint">
                  Suggestions use your description, not AI photo analysis. Staff
                  confirm the details.
                </p>
                <div className="field-heading">
                  <h3>
                    <span>03</span>Location of the disruption
                  </h3>
                  <small>Required</small>
                </div>
                <div className="location-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={gps}
                    disabled={gpsBusy}
                  >
                    {gpsBusy ? <Spinner /> : <LocateFixed size={14} />}Use my
                    location
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setMapOpen(!mapOpen)}
                  >
                    <MapPin size={14} />
                    {mapOpen ? "Hide map" : "Place a pin"}
                  </button>
                </div>
                <label className="form-label" htmlFor="landmark">
                  Location or nearby landmark
                  <input
                    id="landmark"
                    required
                    minLength={3}
                    maxLength={180}
                    value={locationText}
                    placeholder="Street, area, or a nearby landmark"
                    onChange={(e) => {
                      setLocationText(e.target.value);
                      setConfirmed(false);
                    }}
                  />
                </label>
                {point && (
                  <div className="coordinates">
                    <MapPin size={12} />
                    {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}{" "}
                    <span className="tag">{source}</span>
                    {accuracy !== null && (
                      <small>±{Math.round(accuracy)} m</small>
                    )}
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => {
                        gpsGeneration.current++;
                        setGpsBusy(false);
                        setPoint(null);
                        setAccuracy(null);
                        setSource("description");
                        setConfirmed(false);
                      }}
                    >
                      Clear pin
                    </button>
                  </div>
                )}
                {mapOpen && (
                  <div className="report-map">
                    <CityMap
                      selected={point}
                      onPick={(p) => {
                        gpsGeneration.current++;
                        setGpsBusy(false);
                        setPoint(p);
                        setSource("manual");
                        setAccuracy(null);
                        setConfirmed(false);
                        if (!locationText)
                          setLocationText(
                            `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`,
                          );
                      }}
                      showFacilities={source === "demo"}
                    />
                  </div>
                )}
                <div className="demo-locations">
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setDemoOpen(!demoOpen)}
                  >
                    Presenting at the ideathon? Use a demo location{" "}
                    <ChevronDown size={13} />
                  </button>
                  {demoOpen && (
                    <div className="demo-location-options">
                      {DEMO_LOCATIONS.map((loc, i) => (
                        <button
                          type="button"
                          key={loc.name}
                          onClick={() => sample(i)}
                        >
                          <MapPin size={13} />
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="check-label location-confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    required
                  />
                  <span>
                    This is the issue’s location—not necessarily where I am now.
                  </span>
                </label>
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}
                <button
                  className="button primary submit-report"
                  disabled={busy || photoBusy || gpsBusy}
                  type="submit"
                >
                  {busy ? (
                    <>
                      <Spinner />
                      {phase}
                    </>
                  ) : (
                    <>
                      Submit report <ArrowRight size={16} />
                    </>
                  )}
                </button>
                <p className="submit-note">
                  Saved to the demo operations workspace. No emergency or
                  municipal dispatch.
                </p>
              </fieldset>
            </form>
          </section>
        </main>
      )}
      <footer className="citizen-footer">
        <span>RELIABLE SNITCH · CIVIC DISRUPTION MANAGEMENT</span>
        <Link href="/about">
          About this prototype <ArrowUpRight size={12} />
        </Link>
      </footer>
      {cameraOpen && (
        <CameraCapture
          onCapture={(chosen) => void acceptPhoto(chosen)}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
