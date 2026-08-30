import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { createSession, sessionActor, accessCodeMatches, SESSION_COOKIE, SESSION_SECONDS } from "../lib/demo-session.ts";
const secret = randomBytes(32).toString("base64url");
const cookie = (token) => `${SESSION_COOKIE}=${token}`;
test("unguessable invitation code must exactly match its SHA-256 hash", async () => {
  const code = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(code).digest("hex");
  assert.equal(await accessCodeMatches(code, hash), true);
  for (const invalid of ["", "password", null, {}, code + "a", randomBytes(32).toString("base64url")])
    assert.equal(await accessCodeMatches(invalid, hash), false);
});
test("signed cookies identify a stable team session, not an account", async () => {
  const token = await createSession(secret, 1000);
  const id = await sessionActor(cookie(token), secret, 1001);
  assert.match(id, /^team-demo-[a-f0-9-]{36}$/);
  assert.equal(await sessionActor(`other=abc; ${cookie(token)}`, secret, 1002), id);
  assert.notEqual(await sessionActor(cookie(await createSession(secret, 1000)), secret, 1001), id);
});
test("missing, malformed, duplicated, and forged sessions are rejected", async () => {
  const token = await createSession(secret, 1000);
  for (const invalid of [null, "", cookie("wrong"), cookie(token + ".extra"), `${cookie(token)}; ${cookie(token)}`])
    assert.equal(await sessionActor(invalid, secret, 1001), null);
  const [payload, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ v: 1, id: crypto.randomUUID(), iat: 1000, exp: 1000 + SESSION_SECONDS })).toString("base64url");
  assert.equal(await sessionActor(cookie(`${forged}.${signature}`), secret, 1001), null);
  assert.equal(await sessionActor(cookie(`${payload}.AAAA`), secret, 1001), null);
});
test("expired, future-issued, and key-rotated sessions are rejected", async () => {
  const token = await createSession(secret, 1000);
  assert.equal(await sessionActor(cookie(token), secret, 1000 + SESSION_SECONDS), null);
  assert.equal(await sessionActor(cookie(token), secret, 800), null);
  assert.equal(await sessionActor(cookie(token), randomBytes(32).toString("base64url"), 1001), null);
  assert.equal(await sessionActor(cookie(token), "", 1001), null);
  await assert.rejects(() => createSession("weak"));
});
