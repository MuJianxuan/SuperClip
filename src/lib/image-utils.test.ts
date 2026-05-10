import { describe, expect, it } from "vitest";
import { resolveImageDataUrl } from "./image-utils";
import type { ClipboardPayloadSnapshot } from "./superclip";

function makePayload(overrides: Partial<ClipboardPayloadSnapshot> = {}): ClipboardPayloadSnapshot {
  return {
    textPlain: null,
    textHtml: null,
    textRtf: null,
    imageBytes: null,
    imageWidth: null,
    imageHeight: null,
    fileUrls: null,
    extraJson: null,
    ...overrides,
  };
}

describe("resolveImageDataUrl", () => {
  it("returns null for null payload", () => {
    expect(resolveImageDataUrl(null)).toBeNull();
  });

  it("returns null when no image data at all", () => {
    expect(resolveImageDataUrl(makePayload())).toBeNull();
  });

  it("returns data URL from imageBytes when available", () => {
    const payload = makePayload({
      imageBytes: [255, 0, 0, 255],
      imageWidth: 1,
      imageHeight: 1,
    });
    const result = resolveImageDataUrl(payload);
    expect(result).toBe("data:image/png;base64,superclip-test");
  });

  it("falls back to extraJson.previewImage when imageBytes is null", () => {
    const payload = makePayload({
      imageBytes: null,
      imageWidth: null,
      imageHeight: null,
      extraJson: {
        previewImage: {
          bytes: [0, 255, 0, 255],
          width: 1,
          height: 1,
          format: "rgba8",
        },
      },
    });
    const result = resolveImageDataUrl(payload);
    expect(result).toBe("data:image/png;base64,superclip-test");
  });

  it("returns null when extraJson has invalid previewImage structure", () => {
    const payload = makePayload({
      extraJson: { previewImage: { bytes: "not-an-array", width: 1, height: 1 } },
    });
    expect(resolveImageDataUrl(payload)).toBeNull();
  });

  it("returns null when extraJson is not an object", () => {
    const payload = makePayload({ extraJson: "string-value" });
    expect(resolveImageDataUrl(payload)).toBeNull();
  });

  it("returns null when extraJson.previewImage is missing", () => {
    const payload = makePayload({ extraJson: { otherField: true } });
    expect(resolveImageDataUrl(payload)).toBeNull();
  });

  it("returns null when imageBytes is empty array", () => {
    const payload = makePayload({
      imageBytes: [],
      imageWidth: 1,
      imageHeight: 1,
    });
    expect(resolveImageDataUrl(payload)).toBeNull();
  });

  it("returns null when dimensions are zero", () => {
    const payload = makePayload({
      imageBytes: [255, 0, 0, 255],
      imageWidth: 0,
      imageHeight: 1,
    });
    expect(resolveImageDataUrl(payload)).toBeNull();
  });

  it("prefers imageBytes over extraJson when both present", () => {
    const payload = makePayload({
      imageBytes: [255, 0, 0, 255],
      imageWidth: 1,
      imageHeight: 1,
      extraJson: {
        previewImage: { bytes: [0, 255, 0, 255], width: 2, height: 2, format: "rgba8" },
      },
    });
    const result = resolveImageDataUrl(payload);
    expect(result).toBe("data:image/png;base64,superclip-test");
  });
});
