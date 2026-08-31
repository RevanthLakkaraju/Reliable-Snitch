import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  digest,
  passwordHash,
  equalHash,
  randomToken,
  sessionToken,
  ACCOUNT_COOKIE,
} from "../lib/credentials.ts";
import { validateCivicInput } from "../lib/civic.ts";
import { upgradeSchema } from "../lib/upgrade-schema.ts";
test("password hashes depend on the password, salt and server pepper", async () => {
  const salt = randomToken(),
    hash = await passwordHash("Prototype-password-123", salt, "qa-pepper");
  assert.ok(
    equalHash(
      hash,
      await passwordHash("Prototype-password-123", salt, "qa-pepper"),
    ),
  );
  for (const args of [
    ["other-password", salt, "qa-pepper"],
    ["Prototype-password-123", randomToken(), "qa-pepper"],
    ["Prototype-password-123", salt, "other-pepper"],
  ])
    assert.notEqual(hash, await passwordHash(...args));
  assert.notEqual(hash, "Prototype-password-123");
  assert.equal(hash.length, 64);
});
test("session cookie parsing rejects malformed or duplicate values", () => {
  const value = randomToken();
  assert.equal(sessionToken(ACCOUNT_COOKIE + "=" + value), value);
  for (const cookie of [
    null,
    "bad=value",
    ACCOUNT_COOKIE + "=forged",
    ACCOUNT_COOKIE + "=" + value + "; " + ACCOUNT_COOKIE + "=" + value,
  ])
    assert.equal(sessionToken(cookie), null);
});
test("municipal code matching is exact and never accepts an empty hash", async () => {
  const hash = await digest("MUNI-QA-private-code");
  assert.ok(equalHash(hash, await digest("MUNI-QA-private-code")));
  assert.ok(!equalHash(hash, await digest("MUNI-QA-private-code ")));
  assert.ok(!equalHash("", ""));
});
test("citizen title and provider input are constrained independently of category suggestions", () => {
  const body = {
    title: "Connectivity interrupted",
    ward: "Demo Ward 01",
    provider: "Other",
    otherProvider: "Demo Local Fibre",
  };
  assert.equal(
    validateCivicInput(body, "Internet & mobile network").provider,
    "Demo Local Fibre",
  );
  assert.equal(validateCivicInput(body, "Roads & footpaths").provider, "");
  assert.throws(() =>
    validateCivicInput({ ...body, title: "" }, "Roads & footpaths"),
  );
  assert.throws(() =>
    validateCivicInput(
      { ...body, provider: "not-a-choice" },
      "Internet & mobile network",
    ),
  );
});
test("fresh Drizzle migrations and runtime schema are compatible and keep existing tables intact", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const dir = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(new URL(file, dir), "utf8"));
  for (const sql of upgradeSchema) db.exec(sql);
  const names = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);
  for (const name of [
    "reports",
    "uploads",
    "report_events",
    "portal_users",
    "portal_sessions",
    "complaint_registry",
    "complaint_photos",
    "complaint_supports",
    "portal_rate_limits",
  ])
    assert.ok(names.includes(name));
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  db.close();
});
