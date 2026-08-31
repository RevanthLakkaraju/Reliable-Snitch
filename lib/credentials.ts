export const ACCOUNT_COOKIE = "__Host-reliable-snitch-account";
export const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function equalHash(a: string, b: string) {
  if (a.length !== 64 || b.length !== 64) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export async function passwordHash(
  password: string,
  salt: string,
  pepper: string,
) {
  const material = await digest(`${pepper}\0${password}`);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(material),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function sessionToken(cookie: string | null) {
  const values = (cookie ?? "")
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.startsWith(ACCOUNT_COOKIE + "="));
  if (values.length !== 1) return null;
  const value = values[0].slice(ACCOUNT_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
