import type { ClipboardPayloadSnapshot } from "./superclip";

interface PreviewImageExtra {
  bytes: number[];
  width: number;
  height: number;
  format: string;
}

function extractPreviewImage(extraJson: unknown): PreviewImageExtra | null {
  if (!extraJson || typeof extraJson !== "object") return null;
  const obj = extraJson as Record<string, unknown>;
  if (!obj.previewImage || typeof obj.previewImage !== "object") return null;
  const pi = obj.previewImage as Record<string, unknown>;
  if (!Array.isArray(pi.bytes) || typeof pi.width !== "number" || typeof pi.height !== "number") {
    return null;
  }
  return { bytes: pi.bytes as number[], width: pi.width, height: pi.height, format: (pi.format as string) ?? "rgba8" };
}

export function resolveImageDataUrl(payload: ClipboardPayloadSnapshot | null): string | null {
  if (!payload) return null;

  let bytes = payload.imageBytes;
  let w = payload.imageWidth;
  let h = payload.imageHeight;

  if (!bytes || !w || !h) {
    const preview = extractPreviewImage(payload.extraJson);
    if (!preview) return null;
    bytes = preview.bytes;
    w = preview.width;
    h = preview.height;
  }

  if (!bytes.length || !w || !h) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const imageData = ctx.createImageData(w, h);
  imageData.data.set(new Uint8ClampedArray(bytes));
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}
