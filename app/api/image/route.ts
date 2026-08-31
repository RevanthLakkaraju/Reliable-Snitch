import { env } from "cloudflare:workers";
import { apiError, json, database } from "@/lib/server";
import { currentUser } from "@/lib/auth";
export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !/^reports\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key))
      return json({ error: "Image not found." }, 404);
    const db = await database();
    const upload = await db
      .prepare("SELECT key,owner FROM uploads WHERE key=?")
      .bind(key)
      .first<{ key: string; owner: string }>();
    if (!upload) return json({ error: "Image not found." }, 404);
    if (user.role !== "official" && upload.owner !== user.id) {
      const allowed = await db
        .prepare(
          `SELECT r.id FROM reports r JOIN complaint_registry g ON g.report_id=r.id WHERE r.photo_key=? AND (g.owner_id=? OR g.photo_approved=1) UNION ALL SELECT e.report_id FROM report_events e JOIN complaint_registry g ON g.report_id=e.report_id WHERE e.photo_key=? AND e.visibility='public' AND g.owner_id=? LIMIT 1`,
        )
        .bind(key, user.id, key, user.id)
        .first();
      if (!allowed) return json({ error: "Image not found." }, 404);
    }
    const file = await env.FILES.get(key);
    if (!file) return json({ error: "Image not found." }, 404);
    return new Response(file.body, {
      headers: {
        "Content-Type": file.httpMetadata?.contentType ?? "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
