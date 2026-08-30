"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  RotateCcw,
  SwitchCamera,
  Upload,
  X,
} from "lucide-react";
import {
  cameraError,
  captureVideoFrame,
  createCameraSession,
} from "@/lib/camera";
import { Spinner } from "./ui";

export default function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<ReturnType<typeof createCameraSession> | null>(null);
  const alive = useRef(false);
  const request = useRef(0);
  const previewUrl = useRef("");
  const [state, setState] = useState<"loading" | "live" | "captured" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const [captured, setCaptured] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const stopCamera = useCallback(() => {
    request.current++;
    session.current?.stop();
  }, []);

  const start = useCallback(async (chosenDevice?: string) => {
    const attempt = ++request.current;
    setError("");
    setState("loading");
    setCaptured(null);
    setPreview("");
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = "";
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setError(
        "Live camera access is unavailable here. Open the secure HTTPS portal in your phone’s browser, or use a device photo below.",
      );
      return;
    }
    session.current ??= createCameraSession(navigator.mediaDevices);
    try {
      const stream = await session.current.open(chosenDevice);
      if (!stream || !alive.current || attempt !== request.current) return;
      if (!video.current) {
        session.current.stop();
        return;
      }
      video.current.srcObject = stream;
      setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? "");
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (!alive.current || attempt !== request.current) return;
        setState("error");
        setError(
          "The camera disconnected. Try again or choose a photo from your device.",
        );
      });
      await video.current.play();
      if (!alive.current || attempt !== request.current) return;
      setState("live");
      void navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          if (alive.current && attempt === request.current)
            setCameras(list.filter((device) => device.kind === "videoinput"));
        })
        .catch(() => {});
    } catch (cause) {
      if (!alive.current || attempt !== request.current) return;
      session.current?.stop();
      setState("error");
      setError(cameraError(cause));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => {
      if (!cancelled) void start();
    });
    return () => {
      cancelled = true;
      alive.current = false;
      stopCamera();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      document.body.style.overflow = previousOverflow;
    };
  }, [start, stopCamera]);

  async function takePicture() {
    if (!video.current || saving) return;
    setSaving(true);
    setError("");
    try {
      const photo = await captureVideoFrame(video.current);
      if (!alive.current) return;
      request.current++;
      session.current?.stop();
      video.current.srcObject = null;
      previewUrl.current = URL.createObjectURL(photo);
      setCaptured(photo);
      setPreview(previewUrl.current);
      setState("captured");
    } catch (cause) {
      if (alive.current) setError((cause as Error).message);
    } finally {
      if (alive.current) setSaving(false);
    }
  }

  function choose(file: File) {
    onCapture(file);
    onClose();
  }
  function pauseForPicker() {
    request.current++;
    session.current?.stop();
    if (video.current) video.current.srcObject = null;
    setState("error");
    setError(
      "Live camera paused for the file picker. If you cancel, choose ‘Try camera again’ to resume.",
    );
  }

  return (
    <dialog
      ref={dialog}
      className="camera-dialog"
      aria-labelledby="camera-title"
      aria-describedby="camera-description"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="camera-heading">
        <div>
          <div className="eyebrow">SHOW THE ISSUE</div>
          <h2 id="camera-title">Take a report photo</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close camera"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <p id="camera-description">
        Frame the disruption, not people or private details. Nothing is uploaded
        until you submit the report.
      </p>
      <div className="camera-stage">
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label="Live camera preview"
          hidden={state === "captured" || state === "error"}
        />
        {preview && (
          <Image
            unoptimized
            src={preview}
            width={1600}
            height={1200}
            alt="Review your captured report photo"
          />
        )}
        {state === "loading" && (
          <div className="camera-placeholder" role="status">
            <Spinner />
            <span>Waiting for camera access…</span>
            <small>
              Allow camera access if your browser asks. You can close this at
              any time.
            </small>
          </div>
        )}
        {state === "error" && (
          <div className="camera-placeholder">
            <Camera size={32} />
            <span>Let’s use another way</span>
          </div>
        )}
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      <div className="camera-controls">
        {state === "captured" ? (
          <>
            <button
              type="button"
              className="button"
              onClick={() => void start(deviceId || undefined)}
            >
              <RotateCcw size={16} />
              Retake photo
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => captured && choose(captured)}
            >
              <Check size={16} />
              Use this photo
            </button>
          </>
        ) : (
          <>
            {state === "error" ? (
              <button
                type="button"
                className="button"
                onClick={() => void start()}
              >
                <RotateCcw size={16} />
                Try camera again
              </button>
            ) : (
              <>
                {cameras.length > 1 && (
                  <button
                    type="button"
                    className="button"
                    disabled={state !== "live" || saving}
                    onClick={() => {
                      const next =
                        cameras[
                          (cameras.findIndex(
                            (camera) => camera.deviceId === deviceId,
                          ) +
                            1) %
                            cameras.length
                        ];
                      void start(next.deviceId);
                    }}
                  >
                    <SwitchCamera size={16} />
                    Switch camera
                  </button>
                )}
                <button
                  type="button"
                  className="button primary"
                  disabled={state !== "live" || saving}
                  onClick={() => void takePicture()}
                >
                  {saving ? <Spinner /> : <Camera size={16} />}Take picture
                </button>
              </>
            )}
          </>
        )}
      </div>
      {state !== "captured" && (
        <div className="camera-fallback">
          <p>Prefer your device’s camera or an existing photo?</p>
          <div className="upload-actions">
            <label className="button">
              <Camera size={14} />
              Device camera
              <input
                className="file-input"
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Use device camera"
                onClick={pauseForPicker}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) choose(file);
                  event.target.value = "";
                }}
              />
            </label>
            <label className="button">
              <Upload size={14} />
              Choose photo
              <input
                className="file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Choose existing photo"
                onClick={pauseForPicker}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) choose(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      )}
      <p className="camera-privacy">
        Photos only · No microphone · Camera stops when you capture or close
      </p>
    </dialog>
  );
}
