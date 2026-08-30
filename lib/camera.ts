/** Cancels late permission results and releases hardware on every stop/switch. */
export function createCameraSession(
  devices: Pick<MediaDevices, "getUserMedia">,
) {
  let generation = 0;
  let active: MediaStream | null = null;
  function stop() {
    generation++;
    active?.getTracks().forEach((track) => track.stop());
    active = null;
  }
  async function open(deviceId?: string): Promise<MediaStream | null> {
    stop();
    const request = generation;
    const stream = await devices.getUserMedia({
      audio: false,
      video: {
        ...(deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: "environment" } }),
        width: { ideal: 1600 },
        height: { ideal: 1200 },
      },
    });
    if (request !== generation) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    active = stream;
    return stream;
  }
  return { open, stop };
}

export function cameraError(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera permission was not granted. Allow camera access in your browser settings and try again, or use a photo from your device.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No camera was found on this device. You can still upload a photo, or open this portal on your phone.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "The camera may be in use by another app. Close that app and try again, or use a photo from your device.";
  if (name === "OverconstrainedError")
    return "That camera is unavailable. Try again to use the default camera, or choose a photo from your device.";
  return "The camera could not start. Try again, use your device camera below, or upload a photo.";
}

export async function captureVideoFrame(
  video: HTMLVideoElement,
  makeCanvas: () => HTMLCanvasElement = () => document.createElement("canvas"),
): Promise<File> {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight)
    throw new Error(
      "The camera is not ready yet. Wait for the live picture and try again.",
    );
  const canvas = makeCanvas();
  const ratio = Math.min(
    1,
    1600 / Math.max(video.videoWidth, video.videoHeight),
  );
  canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
  canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error(
      "Could not capture the picture. Use a photo from your device instead.",
    );
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("Could not save the picture. Please retake it.")),
      "image/jpeg",
      0.85,
    );
  });
  return new File([blob], "report-camera.jpg", { type: "image/jpeg" });
}
