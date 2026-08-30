// Preload only for the existing integration suite against the separate QA server.
const base = process.env.TEST_BASE_URL;
if (base !== "http://localhost:3100") throw new Error("Team QA is restricted to the separate localhost:3100 deployment copy.");
const nativeFetch = globalThis.fetch;
const login = await nativeFetch(base + "/api/team-access", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ code: process.env.TEST_TEAM_CODE }), signal: AbortSignal.timeout(120000),
});
if (!login.ok) throw new Error(`QA invitation login failed (${login.status})`);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("QA login did not issue a session.");
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, base);
  if (url.origin !== base) return nativeFetch(input, init);
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set("Cookie", cookie);
  const method = init.method ?? (input instanceof Request ? input.method : "GET");
  if (!["GET", "HEAD"].includes(method.toUpperCase()) && !headers.has("Origin")) headers.set("Origin", base);
  return nativeFetch(input, { ...init, headers });
};
