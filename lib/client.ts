export async function requestJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  if (response.status === 401 && typeof window !== "undefined")
    window.dispatchEvent(new Event("reliable-snitch-access-expired"));
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server could not respond. Check your connection and try again.",
    );
  }
  if (!response.ok)
    throw new Error(
      data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string"
        ? data.error
        : "The request could not be completed.",
    );
  return data as T;
}
export function imageUrl(key: string) {
  return "/api/image?key=" + encodeURIComponent(key);
}
export async function preparePhoto(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      "Choose a JPEG, PNG, or WebP image. Convert HEIC photos to JPEG first.",
    );
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose an image below 20 MB.");
  const bitmap = await decodePhoto(file);
  const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Image preparation is unavailable in this browser.");
  }
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Could not prepare the image.")),
      "image/jpeg",
      0.85,
    ),
  );
  // Re-encoding also removes original EXIF metadata, including photo GPS.
  return new File([blob], "report-photo.jpg", { type: "image/jpeg" });
}
async function decodePhoto(
  file: File,
): Promise<
  { width: number; height: number; close: () => void } & CanvasImageSource
> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* Try the browser image decoder too. */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("This image could not be opened. Try another photo."));
      image.src = url;
    });
    return Object.assign(image, { close: () => URL.revokeObjectURL(url) });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
export async function uploadPhoto(file: File) {
  const form = new FormData();
  form.append("photo", file);
  return (
    await requestJson<{ key: string }>("/api/uploads", {
      method: "POST",
      body: form,
    })
  ).key;
}
