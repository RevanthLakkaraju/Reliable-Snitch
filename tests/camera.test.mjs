import test from "node:test";
import assert from "node:assert/strict";
import {
  createCameraSession,
  cameraError,
  captureVideoFrame,
} from "../lib/camera.ts";

function stream() {
  const track = {
    stopped: 0,
    stop() {
      this.stopped++;
    },
  };
  return { track, getTracks: () => [track] };
}

test("camera asks for rear-facing video, never microphone, and releases hardware", async () => {
  let constraints;
  const source = stream();
  const camera = createCameraSession({
    getUserMedia: async (value) => {
      constraints = value;
      return source;
    },
  });
  assert.equal(await camera.open(), source);
  assert.equal(constraints.audio, false);
  assert.equal(constraints.video.facingMode.ideal, "environment");
  camera.stop();
  camera.stop();
  assert.equal(source.track.stopped, 1);
});

test("closing while permission is pending stops a late-arriving camera stream", async () => {
  let resolve;
  const source = stream();
  const camera = createCameraSession({
    getUserMedia: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  const pending = camera.open();
  camera.stop();
  resolve(source);
  assert.equal(await pending, null);
  assert.equal(source.track.stopped, 1);
});

test("switching cameras releases the previous device first", async () => {
  const sources = [stream(), stream()];
  let calls = 0;
  const camera = createCameraSession({
    getUserMedia: async (constraints) => {
      if (calls) {
        assert.equal(sources[0].track.stopped, 1);
        assert.equal(constraints.video.deviceId.exact, "rear-2");
      }
      return sources[calls++];
    },
  });
  await camera.open();
  await camera.open("rear-2");
  camera.stop();
  assert.equal(sources[1].track.stopped, 1);
});

test("overlapping camera requests cannot revive an old stream", async () => {
  const pending = [];
  const a = stream();
  const b = stream();
  const camera = createCameraSession({
    getUserMedia: () => new Promise((resolve) => pending.push(resolve)),
  });
  const first = camera.open();
  const second = camera.open("back");
  pending[1](b);
  assert.equal(await second, b);
  pending[0](a);
  assert.equal(await first, null);
  assert.equal(a.track.stopped, 1);
  camera.stop();
  assert.equal(b.track.stopped, 1);
});

test("a denied camera can be retried without a stuck session", async () => {
  let calls = 0;
  const source = stream();
  const camera = createCameraSession({
    getUserMedia: async () => {
      if (!calls++) throw new DOMException("denied", "NotAllowedError");
      return source;
    },
  });
  await assert.rejects(camera.open(), { name: "NotAllowedError" });
  assert.equal(await camera.open(), source);
  camera.stop();
});

test("camera errors explain permission, missing device, occupied device, and fallback", () => {
  assert.match(cameraError({ name: "NotAllowedError" }), /permission/);
  assert.match(cameraError({ name: "NotFoundError" }), /No camera/);
  assert.match(cameraError({ name: "NotReadableError" }), /another app/);
  assert.match(cameraError({ name: "OverconstrainedError" }), /default camera/);
  assert.match(cameraError(null), /upload/);
});

test("capture rejects a not-yet-ready or blank video", async () => {
  await assert.rejects(
    captureVideoFrame({ readyState: 1, videoWidth: 0, videoHeight: 0 }),
    /not ready/,
  );
});

test("capture creates a size-bounded JPEG from the live video frame", async () => {
  let draw;
  const source = { readyState: 4, videoWidth: 4000, videoHeight: 3000 };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (...args) => {
        draw = args;
      },
    }),
    toBlob(callback, mime, quality) {
      assert.equal(mime, "image/jpeg");
      assert.equal(quality, 0.85);
      callback(new Blob(["jpeg"], { type: mime }));
    },
  };
  const file = await captureVideoFrame(source, () => canvas);
  assert.equal(canvas.width, 1600);
  assert.equal(canvas.height, 1200);
  assert.equal(draw[0], source);
  assert.equal(file.type, "image/jpeg");
  assert.equal(file.name, "report-camera.jpg");
});

test("capture reports unavailable canvas and failed encoding", async () => {
  const source = { readyState: 4, videoWidth: 800, videoHeight: 600 };
  await assert.rejects(
    captureVideoFrame(source, () => ({ getContext: () => null })),
    /Could not capture/,
  );
  await assert.rejects(
    captureVideoFrame(source, () => ({
      getContext: () => ({ drawImage() {} }),
      toBlob: (cb) => cb(null),
    })),
    /retake/,
  );
});
