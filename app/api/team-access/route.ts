import { env } from "cloudflare:workers";
import { json } from "@/lib/server";
import { accessCodeMatches, createSession, sessionActor, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/demo-session";

function configured() {
  return typeof env.DEMO_SESSION_SECRET === "string" && env.DEMO_SESSION_SECRET.length >= 43
    && typeof env.DEMO_ACCESS_CODE_HASH === "string" && /^[a-f0-9]{64}$/.test(env.DEMO_ACCESS_CODE_HASH);
}
export async function GET(request: Request) {
  if (!configured()) {
    if (import.meta.env.DEV && !env.DEMO_SESSION_SECRET) return json({ authenticated: true });
    return json({ error: "Team access is not configured yet." }, 503);
  }
  const authenticated = !!await sessionActor(request.headers.get("cookie"), env.DEMO_SESSION_SECRET!);
  return json({ authenticated });
}
export async function POST(request: Request) {
  if (!configured()) return json({ error: "Team access is not configured yet." }, 503);
  // This endpoint never touches data/storage for untrusted requests.
  const expectedOrigin = env.SITE_ORIGIN;
  if (!expectedOrigin || request.headers.get("origin") !== new URL(expectedOrigin).origin
    || request.headers.get("sec-fetch-site") === "cross-site")
    return json({ error: "Open the invitation in the portal itself." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "A JSON access request is required." }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > 1024)
    return json({ error: "Access request is too large." }, 413);
  let raw = "";
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Enter the team access code." }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) { await reader.cancel(); return json({ error: "Access request is too large." }, 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  raw = new TextDecoder().decode(bytes);
  let code: unknown;
  try { code = JSON.parse(raw)?.code; } catch { return json({ error: "Enter a valid team access code." }, 400); }
  if (!await accessCodeMatches(code, env.DEMO_ACCESS_CODE_HASH!))
    return json({ error: "This team link or access code is invalid. Ask the project owner for the current invitation." }, 401);
  const token = await createSession(env.DEMO_SESSION_SECRET!);
  const response = json({ authenticated: true });
  response.headers.set("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`);
  return response;
}
