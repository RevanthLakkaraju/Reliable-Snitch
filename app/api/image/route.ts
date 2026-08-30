import { env } from "cloudflare:workers";
import { actor, apiError, json, database } from "@/lib/server";
export async function GET(request: Request) {
  try {
    actor(request);
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !/^reports\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key))
      return json({ error: "Image not found." }, 404);
    const db = await database();
    const upload = await db
      .prepare("SELECT key FROM uploads WHERE key=?")
      .bind(key)
      .first();
    if (!upload) return json({ error: "Image not found." }, 404);
    const file = await env.FILES.get(key);
    if (!file) return json({ error: "Image not found." }, 404);
    return new Response(file.body, {
      headers: {
        "Content-Type": file.httpMetadata?.contentType ?? "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
