import { env } from "cloudflare:workers";
import {
  actor,
  checkMutation,
  json,
  apiError,
  database,
  HttpError,
} from "@/lib/server";
export async function POST(request: Request) {
  let key: string | undefined;
  try {
    checkMutation(request);
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 6 * 1024 * 1024)
      throw new HttpError(
        413,
        "The image is too large. Use a photo below 5 MB.",
      );
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0)
      throw new HttpError(400, "Select a photo first.");
    if (file.size > 5 * 1024 * 1024)
      throw new HttpError(413, "Use a photo below 5 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let type = "",
      extension = "";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      type = "image/jpeg";
      extension = "jpg";
    } else if (
      [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
    ) {
      type = "image/png";
      extension = "png";
    } else if (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    ) {
      type = "image/webp";
      extension = "webp";
    } else
      throw new HttpError(400, "Please upload a JPEG, PNG, or WebP photo.");
    key = `reports/${crypto.randomUUID()}.${extension}`;
    await env.FILES.put(key, bytes, { httpMetadata: { contentType: type } });
    const db = await database();
    await db
      .prepare(
        "INSERT INTO uploads (key,owner,content_type,size,created_at) VALUES (?,?,?,?,?)",
      )
      .bind(key, actor(request), type, file.size, Date.now())
      .run();
    return json({ key }, 201);
  } catch (error) {
    if (key) await env.FILES.delete(key).catch(() => {});
    return apiError(error);
  }
}
