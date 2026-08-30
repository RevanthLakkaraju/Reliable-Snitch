import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error(
    "Integration tests only run against a local development server, never a deployed workspace.",
  );
async function call(path, method = "GET", body, extra = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  return { status: response.status, data };
}
const payload = () => ({
  requestId: crypto.randomUUID(),
  description:
    "[QA] A large pothole is blocking the entire pavement near the demo school.",
  locationText: "School Lane · QA demo",
  latitude: 12.9765,
  longitude: 77.6004,
  accuracy: null,
  locationSource: "demo",
  photoKey: null,
});
test("all primary routes return successfully", async () => {
  for (const route of [
    "/",
    "/report",
    "/track",
    "/disruptions",
    "/map",
    "/departments",
    "/activity",
    "/about",
  ])
    assert.equal((await fetch(base + route)).status, 200, route);
});
test("invalid request bodies and cross-site writes are rejected", async () => {
  assert.equal((await call("/api/reports", "POST", null)).status, 400);
  assert.equal((await call("/api/reports", "POST", {})).status, 400);
  assert.equal(
    (
      await call("/api/reports", "POST", payload(), {
        Origin: "https://not-the-portal.example",
      })
    ).status,
    403,
  );
});
test("photo upload validates content, persists bytes, and can be attached", async () => {
  const bad = new FormData();
  bad.append(
    "photo",
    new File(["not an image"], "bad.jpg", { type: "image/jpeg" }),
  );
  assert.equal(
    (await fetch(base + "/api/uploads", { method: "POST", body: bad })).status,
    400,
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCz0AAAAASUVORK5CYII=",
    "base64",
  );
  const form = new FormData();
  form.append("photo", new File([png], "qa-pixel.png", { type: "image/png" }));
  const response = await fetch(base + "/api/uploads", {
    method: "POST",
    body: form,
  });
  assert.equal(response.status, 201);
  const { key } = await response.json();
  const image = await fetch(base + "/api/image?key=" + encodeURIComponent(key));
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  const created = await call("/api/reports", "POST", {
    ...payload(),
    photoKey: key,
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.report.photoKey, key);
});
test("repeat and concurrent submissions yield one report and one receipt event", async () => {
  const data = payload();
  const [a, b] = await Promise.all([
    call("/api/reports", "POST", data),
    call("/api/reports", "POST", data),
  ]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.data.report.id, b.data.report.id);
  const again = await call("/api/reports", "POST", data);
  assert.equal(again.data.report.id, a.data.report.id);
  const details = await call("/api/reports/" + a.data.report.id);
  assert.equal(details.data.events.length, 1);
});
test("full management flow persists, protects private notes, rejects stale edits, and reopens", async () => {
  let response = await call("/api/reports", "POST", payload());
  assert.equal(response.status, 201);
  let report = response.data.report;
  const path = "/api/reports/" + report.id;
  assert.equal(report.status, "Reported");
  assert.equal(report.priority, "Unassessed");
  assert.ok(report.context.facilities.length > 0);
  assert.equal(
    (
      await call(path, "PATCH", {
        revision: report.revision,
        status: "Resolved",
        department: "Public Works",
        note: "Trying to skip verification.",
      })
    ).status,
    400,
  );
  response = await call(path, "PATCH", {
    revision: report.revision,
    status: "Verified",
    note: "PRIVATE INSPECTION DETAIL",
    visibility: "internal",
  });
  assert.equal(response.status, 200);
  report = response.data.report;
  assert.equal(
    (await call(path, "PATCH", { revision: 0, note: "Stale edit attempt" }))
      .status,
    409,
  );
  const citizen = await call(path + "?public=1");
  assert.ok(citizen.data.events.every((e) => e.visibility === "public"));
  assert.ok(
    !JSON.stringify(citizen.data.events).includes("PRIVATE INSPECTION DETAIL"),
  );
  assert.ok(response.data.events.some((e) => e.visibility === "internal"));
  response = await call(path, "PATCH", {
    revision: report.revision,
    status: "Assigned",
    department: "Public Works",
    priority: "High",
    note: "Assigned to the demonstration road team.",
  });
  assert.equal(response.status, 200);
  report = response.data.report;
  response = await call(path, "PATCH", {
    revision: report.revision,
    status: "In progress",
    note: "Demo repair work is underway.",
  });
  assert.equal(response.status, 200);
  report = response.data.report;
  assert.equal(
    (
      await call(path, "PATCH", {
        revision: report.revision,
        status: "Resolved",
        note: "done",
      })
    ).status,
    400,
  );
  response = await call(path, "PATCH", {
    revision: report.revision,
    status: "Resolved",
    note: "QA demonstration only: paving repaired and checked.",
  });
  assert.equal(response.status, 200);
  report = response.data.report;
  assert.ok(report.resolvedAt);
  assert.ok(response.data.events.some((e) => e.kind === "Resolution recorded"));
  const refetched = await call(path);
  assert.equal(refetched.data.report.status, "Resolved");
  assert.equal(refetched.data.report.department, "Public Works");
  response = await call(path, "PATCH", {
    revision: report.revision,
    status: "Verified",
    note: "QA demonstration: the issue has reappeared and needs review.",
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.report.resolvedAt, null);
});
test("concurrent staff edits produce one success and one conflict", async () => {
  const created = await call("/api/reports", "POST", payload());
  const id = created.data.report.id;
  const results = await Promise.all([
    call("/api/reports/" + id, "PATCH", {
      revision: 0,
      status: "Verified",
      note: "First inspection update.",
    }),
    call("/api/reports/" + id, "PATCH", {
      revision: 0,
      status: "Verified",
      note: "Second inspection update.",
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const details = await call("/api/reports/" + id);
  assert.equal(details.data.report.revision, 1);
  assert.equal(details.data.events.length, 2);
});
