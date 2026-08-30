/** Team-demo authorization. No account identity or private key reaches the browser. */
export const SESSION_COOKIE = "__Host-reliable-snitch-session";
export const SESSION_SECONDS = 24 * 60 * 60;
const encoder = new TextEncoder();

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid encoding");
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function signingKey(secret: string) {
  if (secret.length < 43) throw new Error("Team access is not configured.");
  return crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" },
    false, ["sign", "verify"],
  );
}
export async function accessCodeMatches(code: unknown, expectedHash: string) {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(code)
    || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(code)));
  const actual = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return difference === 0;
}
export async function createSession(secret: string, now = Math.floor(Date.now() / 1000)) {
  const payload = encode(encoder.encode(JSON.stringify({
    v: 1, id: crypto.randomUUID(), iat: now, exp: now + SESSION_SECONDS,
  })));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}
export async function sessionActor(
  cookieHeader: string | null, secret: string, now = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  if (!cookieHeader || secret.length < 43) return null;
  const matches = cookieHeader.split(";").map((part) => part.trim())
    .filter((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(SESSION_COOKIE.length + 1);
  if (token.length > 600) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const [payload, signature] = parts;
    if (!await crypto.subtle.verify("HMAC", await signingKey(secret), decode(signature), encoder.encode(payload))) return null;
    const data = JSON.parse(new TextDecoder().decode(decode(payload)));
    if (data.v !== 1 || !/^[a-f0-9-]{36}$/.test(data.id)
      || !Number.isInteger(data.iat) || !Number.isInteger(data.exp)
      || data.iat > now + 60 || data.exp <= now
      || data.exp - data.iat !== SESSION_SECONDS) return null;
    return `team-demo-${data.id}`;
  } catch { return null; }
}
