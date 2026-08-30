import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL;
if (base !== "http://localhost:3100") throw new Error("Team security tests only run on the separate QA server.");
const invitation = process.env.TEST_TEAM_CODE;
function login(code = invitation, extra = {}) {
  return fetch(base + "/api/team-access", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...extra },
    body: JSON.stringify({ code }),
  });
}
test("unauthorized visitors and forged identity headers cannot read or mutate any records", async () => {
  for (const [path, method] of [
    ["/api/reports", "GET"], ["/api/reports/TE-1001", "GET"], ["/api/activity", "GET"],
    ["/api/export", "GET"], ["/api/image?key=anything", "GET"], ["/api/reports", "POST"],
    ["/api/reports/TE-1001", "PATCH"], ["/api/uploads", "POST"],
  ]) {
    const response = await fetch(base + path, { method, headers: { Origin: base, "oai-authenticated-user-id": "forged-user" } });
    assert.equal(response.status, 401, `${method} ${path}`);
  }
});
test("invitation rejects invalid codes, missing or foreign origins, non-JSON, and oversized bodies", async () => {
  assert.equal((await login("wrong")).status, 401);
  assert.equal((await login(invitation, { Origin: "https://evil.invalid" })).status, 403);
  assert.equal((await login(invitation, { Origin: "null" })).status, 403);
  assert.equal((await fetch(base + "/api/team-access", { method: "POST", body: JSON.stringify({ code: invitation }), headers: { "Content-Type": "application/json" } })).status, 403);
  assert.equal((await login(invitation, { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await login("x".repeat(1500))).status, 413);
});
test("valid invitations establish protected sessions and tampered cookies fail", async () => {
  const response = await login();
  assert.equal(response.status, 200);
  const header = response.headers.get("set-cookie");
  assert.match(header, /HttpOnly/); assert.match(header, /Secure/); assert.match(header, /SameSite=Lax/);
  assert.match(header, /Max-Age=86400/); assert.match(header, /Path=\//);
  const cookie = header.split(";")[0];
  const state = await fetch(base + "/api/team-access", { headers: { Cookie: cookie } });
  assert.equal((await state.json()).authenticated, true);
  const records = await fetch(base + "/api/reports", { headers: { Cookie: cookie } });
  assert.equal(records.status, 200);
  assert.ok((await records.json()).reports.length >= 12);
  assert.equal((await fetch(base + "/api/reports", { headers: { Cookie: cookie + "tampered" } })).status, 401);
});
