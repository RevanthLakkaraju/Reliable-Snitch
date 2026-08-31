import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Tests may only write to localhost.");
const accessCode = process.env.TEST_OFFICIAL_ACCESS_CODE;
if (!accessCode) throw new Error("Set TEST_OFFICIAL_ACCESS_CODE privately.");
const password = "Local-QA-Only-728461!",
  suffix = crypto.randomUUID().slice(0, 8);
async function call(path, method = "GET", body, cookie = "", extra = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: new URL(base).origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await r.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }
  return {
    status: r.status,
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
    headers: r.headers,
  };
}
const ok = (r, n = 200) => assert.equal(r.status, n, JSON.stringify(r.data));
const payload = (extra = {}) => ({
  requestId: crypto.randomUUID(),
  title: "QA: uneven footpath at crossing",
  description:
    "[QA] Uneven footpath tiles obstruct the pavement near the demonstration crossing.",
  locationText: "Market Road · QA demo",
  latitude: 12.9721,
  longitude: 77.5953,
  accuracy: null,
  locationSource: "demo",
  photoKey: null,
  ward: "Demo Ward 01 · Bengaluru",
  ...extra,
});
let citizen, other, official;
const account = (name, role = "citizen", extra = {}) => ({
  action: "register",
  name: "QA " + name,
  username: "qa-" + name + "-" + suffix,
  password,
  role,
  ...extra,
});
async function create(body = payload(), cookie = citizen) {
  const r = await call("/api/reports", "POST", body, cookie);
  ok(r, 201);
  return r.data.report;
}
async function upload(cookie) {
  const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCz0AAAAASUVORK5CYII=",
      "base64",
    ),
    form = new FormData();
  form.append("photo", new File([png], "qa-pixel.png", { type: "image/png" }));
  const r = await fetch(base + "/api/uploads", {
    method: "POST",
    headers: { Origin: new URL(base).origin, Cookie: cookie },
    body: form,
  });
  assert.equal(r.status, 201);
  return (await r.json()).key;
}
test("role-restricted civic portal integration", async (t) => {
  await t.test(
    "registration requires a municipal code for official accounts",
    async () => {
      let r = await call("/api/team-access", "POST", account("citizen"));
      ok(r);
      citizen = r.cookie;
      r = await call("/api/team-access", "POST", account("other"));
      ok(r);
      other = r.cookie;
      ok(
        await call("/api/team-access", "POST", account("staff", "official")),
        401,
      );
      ok(
        await call(
          "/api/team-access",
          "POST",
          account("staff", "official", { accessCode: "wrong" }),
        ),
        401,
      );
      r = await call(
        "/api/team-access",
        "POST",
        account("staff", "official", { accessCode }),
      );
      ok(r);
      official = r.cookie;
      assert.equal(r.data.user.role, "official");
      assert.match(
        r.headers.get("set-cookie"),
        /HttpOnly; Secure; SameSite=Lax/,
      );
    },
  );
  await t.test(
    "every official sign-in requires the password AND code; role switching is rejected",
    async () => {
      const login = {
        action: "login",
        username: "qa-staff-" + suffix,
        password,
        role: "official",
      };
      ok(await call("/api/team-access", "POST", login), 401);
      ok(
        await call("/api/team-access", "POST", {
          ...login,
          accessCode,
          password: "Wrong-Password-123",
        }),
        401,
      );
      ok(await call("/api/team-access", "POST", { ...login, accessCode }));
      ok(
        await call("/api/team-access", "POST", { ...login, role: "citizen" }),
        401,
      );
      ok(
        await call("/api/team-access", "POST", {
          ...login,
          username: "qa-citizen-" + suffix,
          accessCode,
        }),
        401,
      );
    },
  );
  await t.test(
    "unauthenticated access, forged roles and cross-site writes are rejected",
    async () => {
      for (const p of [
        "/api/reports",
        "/api/reports/TE-1001",
        "/api/activity",
        "/api/export",
        "/api/nearby?lat=12.9721&lng=77.5953",
        "/api/image?key=x",
      ])
        ok(await call(p), 401);
      ok(
        await call("/api/reports", "GET", undefined, "", {
          "x-role": "official",
          "x-forwarded-user": "admin",
        }),
        401,
      );
      ok(
        await call("/api/reports", "POST", payload(), citizen, {
          Origin: "https://evil.example",
        }),
        403,
      );
      ok(await call("/api/reports", "POST", payload(), official), 403);
      ok(await call("/api/activity", "GET", undefined, citizen), 403);
      ok(await call("/api/export", "GET", undefined, citizen), 403);
    },
  );
  await t.test(
    "pages render and tracker HTML never contains another person’s private description",
    async () => {
      for (const p of [
        "/",
        "/citizen",
        "/nearby",
        "/report",
        "/track",
        "/disruptions",
        "/map",
        "/departments",
        "/activity",
        "/about",
      ])
        assert.equal((await fetch(base + p)).status, 200, p);
      const r = await create(
        payload({ description: "PRIVATE_QA_REPORT_DESCRIPTION_OWNER_ONLY" }),
      );
      assert.doesNotMatch(
        await (await fetch(base + "/track?code=" + r.id)).text(),
        /PRIVATE_QA_REPORT_DESCRIPTION_OWNER_ONLY/,
      );
    },
  );
  await t.test(
    "citizen ownership, title validation and mandatory service provider selection",
    async () => {
      const r = await create();
      ok(await call("/api/reports/" + r.id, "GET", undefined, other), 404);
      ok(
        await call(
          "/api/reports/" + r.id,
          "PATCH",
          { revision: 0, status: "Verified" },
          citizen,
        ),
        403,
      );
      assert.ok(
        (
          await call("/api/reports", "GET", undefined, citizen)
        ).data.reports.some((x) => x.id === r.id),
      );
      assert.ok(
        !(
          await call("/api/reports", "GET", undefined, other)
        ).data.reports.some((x) => x.id === r.id),
      );
      assert.ok(
        (
          await call("/api/reports", "GET", undefined, official)
        ).data.reports.some((x) => x.id === r.id),
      );
      ok(
        await call("/api/reports", "POST", payload({ title: "" }), citizen),
        400,
      );
      const network = payload({
        title: "QA: broadband connection interrupted",
        description:
          "Broadband internet is not working along the demonstration street.",
      });
      ok(await call("/api/reports", "POST", network, citizen), 400);
      ok(
        await call(
          "/api/reports",
          "POST",
          { ...network, provider: "Other", otherProvider: "" },
          citizen,
        ),
        400,
      );
      const n = await create({
        ...network,
        provider: "Other",
        otherProvider: "Demo Fibre",
      });
      assert.equal(n.provider, "Demo Fibre");
      assert.equal(n.title, network.title);
    },
  );
  await t.test(
    "concurrent report retries are idempotent and cannot be stolen by another account",
    async () => {
      const body = payload(),
        rs = await Promise.all([
          call("/api/reports", "POST", body, citizen),
          call("/api/reports", "POST", body, citizen),
        ]);
      rs.forEach((r) => ok(r, 201));
      assert.equal(rs[0].data.report.id, rs[1].data.report.id);
      assert.equal(
        (
          await call(
            "/api/reports/" + rs[0].data.report.id,
            "GET",
            undefined,
            citizen,
          )
        ).data.events.length,
        1,
      );
      ok(await call("/api/reports", "POST", body, other), 409);
    },
  );
  await t.test(
    "nearby map, persistent one-per-user support, undo and no duplicate complaints",
    async () => {
      const r = await create(),
        p = "/api/reports/" + r.id + "/citizen",
        query = () =>
          call(
            "/api/nearby?lat=12.9721&lng=77.5953&radius=3000&demo=1",
            "GET",
            undefined,
            other,
          ),
        before = await query();
      ok(before);
      assert.ok(before.data.reports.some((x) => x.id === r.id));
      ok(await call(p, "POST", { action: "support", supported: true }, other));
      let s = await call(
        p,
        "POST",
        { action: "support", supported: true },
        other,
      );
      ok(s);
      assert.equal(s.data.report.supportCount, 1);
      assert.equal(
        (await query()).data.reports.length,
        before.data.reports.length,
      );
      s = await call(p, "POST", { action: "support", supported: false }, other);
      ok(s);
      assert.equal(s.data.report.supportCount, 0);
      ok(
        await call("/api/nearby?lat=999&lng=77", "GET", undefined, other),
        400,
      );
    },
  );
  await t.test(
    "original photo is private until municipal approval",
    async () => {
      const key = await upload(citizen),
        r = await create(payload({ photoKey: key }));
      ok(await call("/api/image?key=" + key, "GET", undefined, citizen));
      ok(await call("/api/image?key=" + key, "GET", undefined, other), 404);
      const a = await call(
        "/api/reports/" + r.id,
        "PATCH",
        { revision: 0, approvePhoto: true },
        official,
      );
      ok(a);
      assert.equal(a.data.report.photoApproved, true);
      ok(await call("/api/image?key=" + key, "GET", undefined, other));
    },
  );
  await t.test(
    "missing-photo contribution is moderated and stays on the original complaint",
    async () => {
      const r = await create(),
        key = await upload(other),
        p = "/api/reports/" + r.id;
      ok(
        await call(
          p + "/citizen",
          "POST",
          { action: "photo", photoKey: key },
          other,
        ),
      );
      ok(
        await call(
          p + "/citizen",
          "POST",
          { action: "photo", photoKey: key },
          other,
        ),
        409,
      );
      ok(await call("/api/image?key=" + key, "GET", undefined, citizen), 404);
      const pending = (await call(p, "GET", undefined, official)).data.report;
      assert.ok(pending.pendingPhotoId);
      const a = await call(
        p,
        "PATCH",
        {
          revision: pending.revision,
          photoReview: "approve",
          pendingPhotoId: pending.pendingPhotoId,
        },
        official,
      );
      ok(a);
      assert.equal(a.data.report.photoKey, key);
      assert.equal(a.data.report.id, r.id);
      ok(await call("/api/image?key=" + key, "GET", undefined, citizen));
    },
  );
  await t.test(
    "provider workflow, private notes, clarification, resolution, confirmation and reopening",
    async () => {
      let r = await create(
        payload({
          title: "QA: internet disruption",
          description:
            "Demo broadband internet is interrupted in this locality.",
          provider: "Airtel",
        }),
      );
      const p = "/api/reports/" + r.id;
      async function update(body) {
        const a = await call(
          p,
          "PATCH",
          { revision: r.revision, ...body },
          official,
        );
        ok(a);
        r = a.data.report;
      }
      ok(
        await call(
          p,
          "PATCH",
          {
            revision: 0,
            status: "Resolved",
            department: "Telecom Coordination",
            note: "Cannot skip review.",
          },
          official,
        ),
        400,
      );
      await update({
        status: "Verified",
        note: "PRIVATE_NOTE_MUST_NOT_LEAK",
        visibility: "internal",
      });
      assert.doesNotMatch(
        JSON.stringify((await call(p, "GET", undefined, citizen)).data),
        /PRIVATE_NOTE_MUST_NOT_LEAK/,
      );
      assert.match(
        JSON.stringify((await call(p, "GET", undefined, official)).data),
        /PRIVATE_NOTE_MUST_NOT_LEAK/,
      );
      await update({
        status: "Assigned",
        department: "Telecom Coordination",
        assignee: "QA-STF-001",
        coordination: "Forwarded to provider",
        providerTicket: "QA-AIR-123",
        escalated: true,
        note: "Recorded a simulated referral to the chosen provider.",
      });
      assert.equal(r.providerTicket, "QA-AIR-123");
      assert.equal(r.escalated, true);
      await update({
        clarification: "Please confirm the affected landmark.",
        note: "Requested a clearer landmark from the complainant.",
      });
      ok(
        await call(
          p + "/citizen",
          "POST",
          {
            action: "reply",
            revision: r.revision,
            note: "Other person cannot answer this request.",
          },
          other,
        ),
        403,
      );
      let a = await call(
        p + "/citizen",
        "POST",
        {
          action: "reply",
          revision: r.revision,
          note: "The demonstration market entrance is affected.",
        },
        citizen,
      );
      ok(a);
      r = a.data.report;
      assert.equal(r.clarification, "");
      await update({
        status: "In progress",
        note: "The mock provider repair is in progress.",
      });
      await update({
        status: "Resolved",
        coordination: "Provider confirms restored",
        note: "Demonstration connectivity was restored and checked.",
      });
      a = await call(
        p + "/citizen",
        "POST",
        { action: "confirm", revision: r.revision },
        citizen,
      );
      ok(a);
      r = a.data.report;
      assert.equal(r.status, "Closed");
      a = await call(
        p + "/citizen",
        "POST",
        {
          action: "reopen",
          revision: r.revision,
          note: "The demonstration issue returned after closure.",
        },
        citizen,
      );
      ok(a);
      assert.equal(a.data.report.status, "Verified");
      assert.equal(a.data.report.resolvedAt, null);
      ok(
        await call(
          p,
          "PATCH",
          { revision: 0, note: "Stale update must not overwrite." },
          official,
        ),
        409,
      );
    },
  );
  await t.test(
    "concurrent staff edits produce one successful update and one conflict",
    async () => {
      const r = await create(),
        p = "/api/reports/" + r.id,
        rs = await Promise.all(
          ["First", "Second"].map((note) =>
            call(
              p,
              "PATCH",
              {
                revision: 0,
                status: "Verified",
                note: note + " inspection update.",
              },
              official,
            ),
          ),
        );
      assert.deepEqual(rs.map((x) => x.status).sort(), [200, 409]);
      const a = await call(p, "GET", undefined, official);
      assert.equal(a.data.report.revision, 1);
      assert.equal(a.data.events.length, 2);
    },
  );
  await t.test(
    "personal demonstration cases are private and do not duplicate",
    async () => {
      const a = await call("/api/demo", "POST", undefined, citizen);
      ok(a);
      assert.equal(a.data.ids.length, 2);
      const b = await call("/api/demo", "POST", undefined, citizen);
      ok(b);
      assert.deepEqual(a.data.ids, b.data.ids);
      for (const id of a.data.ids)
        ok(await call("/api/reports/" + id, "GET", undefined, other), 404);
    },
  );
  await t.test(
    "official CSV export works; logout revokes the session",
    async () => {
      const r = await call(
        "/api/export?query=TE-1001",
        "GET",
        undefined,
        official,
      );
      ok(r);
      assert.match(r.headers.get("content-type"), /text\/csv/);
      assert.match(r.data.raw, /TE-1001/);
      assert.doesNotMatch(r.data.raw, /TE-1002/);
      ok(await call("/api/team-access", "DELETE", undefined, other));
      ok(await call("/api/reports", "GET", undefined, other), 401);
    },
  );
});
