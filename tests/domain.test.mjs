import test from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  deriveContext,
  distanceMeters,
  validateReport,
  validateTransition,
  titleFromDescription,
} from "../lib/domain.ts";
const valid = () => ({
  description: "A large pothole is blocking the walking route.",
  locationText: "QA location",
  latitude: 12.9765,
  longitude: 77.6004,
  accuracy: 10,
  locationSource: "demo",
  photoKey: null,
  requestId: crypto.randomUUID(),
});
test("distances are zero at the same point, symmetric, and plausible", () => {
  assert.equal(distanceMeters(12, 77, 12, 77), 0);
  assert.equal(distanceMeters(12, 77, 13, 77), distanceMeters(13, 77, 12, 77));
  assert.ok(distanceMeters(0, 0, 1, 0) > 111000);
});
test("description categories are suggestions with an unknown fallback", () => {
  assert.equal(
    classify("There is a pothole outside the school"),
    "Roads & footpaths",
  );
  assert.equal(classify("Broken streetlights on the lane"), "Street lighting");
  assert.equal(
    classify("The garbage bins are overflowing"),
    "Waste & sanitation",
  );
  assert.equal(
    classify("The drain is clogged with leaves and waste"),
    "Water & drainage",
  );
  assert.equal(
    classify("Something looks unusual over here"),
    "Needs classification",
  );
});
test("GPS does not invent a real facility or assign priority", () => {
  const context = deriveContext(
    "An entire road is blocked",
    12.9765,
    77.6004,
    "gps",
  );
  assert.equal(context.facilities.length, 0);
  assert.match(context.facilityNote, /not connected/);
  assert.ok(!("priority" in context));
  assert.match(context.scale, /unverified/);
});
test("only explicit demo coordinates use the illustrative facility dataset", () => {
  const context = deriveContext(
    "An issue near school",
    12.9765,
    77.6004,
    "demo",
  );
  assert.equal(context.facilities[0].name, "Demo Community School");
  assert.ok(context.facilities[0].distance < 100);
});
test("a normal report validates without a forced category", () => {
  assert.equal(
    validateReport(valid()).description,
    "A large pothole is blocking the walking route.",
  );
});
test("landmark-only reports remain valid and visibly unlocated", () => {
  const data = valid();
  data.latitude = null;
  data.longitude = null;
  data.accuracy = null;
  data.locationSource = "description";
  assert.equal(validateReport(data).latitude, null);
});
for (const [name, change] of [
  ["short description", { description: "help" }],
  ["long description", { description: "x".repeat(2001) }],
  ["invalid latitude", { latitude: 91 }],
  ["invalid longitude", { longitude: 200 }],
  ["non-number coordinate", { longitude: "77" }],
  ["one missing coordinate", { longitude: null }],
  ["negative accuracy", { accuracy: -1 }],
  ["unknown source", { locationSource: "made-up" }],
  ["untrusted image path", { photoKey: "../../secret" }],
  ["missing idempotency key", { requestId: "" }],
])
  test("reject " + name, () =>
    assert.throws(() => validateReport({ ...valid(), ...change })),
  );
test("workflow permits the complete verified, assigned, worked, resolved journey", () => {
  validateTransition("Reported", "Verified", "Unassigned", "");
  validateTransition("Verified", "Assigned", "Public Works", "");
  validateTransition("Assigned", "In progress", "Public Works", "");
  validateTransition(
    "In progress",
    "Resolved",
    "Public Works",
    "The paving was repaired and inspected.",
  );
});
test("workflow rejects skipping verification and resolving without evidence", () => {
  assert.throws(() =>
    validateTransition(
      "Reported",
      "Resolved",
      "Public Works",
      "Finished repairs.",
    ),
  );
  assert.throws(() =>
    validateTransition("Verified", "Assigned", "Unassigned", ""),
  );
  assert.throws(() =>
    validateTransition("In progress", "Resolved", "Public Works", "done"),
  );
  assert.throws(() =>
    validateTransition("Resolved", "Verified", "Public Works", ""),
  );
});
test("reopening requires a reason", () =>
  validateTransition(
    "Resolved",
    "Verified",
    "Public Works",
    "The repair failed after the next rainfall.",
  ));
test("long titles are bounded without losing descriptions", () => {
  assert.ok(titleFromDescription("x".repeat(500)).length <= 75);
  assert.equal(
    titleFromDescription("Issue here. More details follow."),
    "Issue here",
  );
});
