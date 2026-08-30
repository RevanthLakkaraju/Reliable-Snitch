import test from "node:test";
import assert from "node:assert/strict";
import { preparePhoto } from "../lib/client.ts";
import { renderCsv } from "../lib/csv.ts";

test("CSV safely escapes quotes, line breaks, and spreadsheet formulas", () => {
  const csv = renderCsv([
    ["=danger()", "  @formula", 'a,"b"', "line\nnext", null],
  ]);
  assert.equal(
    csv,
    '\ufeff"\'=danger()","\'  @formula","a,""b""","line\nnext",""',
  );
});

test("photo preparation rejects unsupported formats and oversized files before decoding", async () => {
  await assert.rejects(
    preparePhoto(new File(["x"], "bad.txt", { type: "text/plain" })),
    /JPEG/,
  );
  await assert.rejects(
    preparePhoto({ type: "image/jpeg", size: 21 * 1024 * 1024 }),
    /20 MB/,
  );
});

test("photo preparation strips metadata by re-encoding and caps image dimensions", async (t) => {
  let closed = false;
  let drawn = false;
  const bitmap = {
    width: 4000,
    height: 3000,
    close() {
      closed = true;
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      fillRect() {},
      drawImage(image) {
        assert.equal(image, bitmap);
        drawn = true;
      },
    }),
    toBlob(cb, type) {
      cb(new Blob(["reencoded"], { type }));
    },
  };
  const oldBitmap = Object.getOwnPropertyDescriptor(
    globalThis,
    "createImageBitmap",
  );
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: async () => bitmap,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => canvas },
  });
  t.after(() => {
    if (oldBitmap)
      Object.defineProperty(globalThis, "createImageBitmap", oldBitmap);
    else delete globalThis.createImageBitmap;
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else delete globalThis.document;
  });
  const file = await preparePhoto(
    new File(["EXIF-original"], "source.jpg", { type: "image/jpeg" }),
  );
  assert.equal(canvas.width, 1600);
  assert.equal(canvas.height, 1200);
  assert.equal(drawn, true);
  assert.equal(closed, true);
  assert.equal(await file.text(), "reencoded");
  assert.equal(file.type, "image/jpeg");
});
