import { useEffect, useMemo, useRef, useState } from "react";
import { clipboardGet, type ClipboardItemDetail } from "../lib/superclip";
import type { ClipboardItem } from "../components/history-row";

interface PreviewPayload {
  item: ClipboardItem;
}

function useImageDataUrl(detail: ClipboardItemDetail | null) {
  return useMemo(() => {
    const bytes = detail?.payload?.imageBytes;
    const w = detail?.payload?.imageWidth;
    const h = detail?.payload?.imageHeight;
    if (!bytes || !w || !h) return null;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imageData = ctx.createImageData(w, h);
    imageData.data.set(new Uint8ClampedArray(bytes));
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }, [detail?.payload?.imageBytes, detail?.payload?.imageWidth, detail?.payload?.imageHeight]);
}

export function PreviewApp() {
  const [item, setItem] = useState<ClipboardItem | null>(null);
  const [detail, setDetail] = useState<ClipboardItemDetail | null>(null);
  const emitRef = useRef<((event: string, payload?: unknown) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | null = null;
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen, emit }) => {
        emitRef.current = emit;
        return listen<PreviewPayload>("preview:show", (event) => {
          if (!disposed) {
            setItem(event.payload.item);
            setDetail(null);
          }
        });
      })
      .then((fn) => { if (disposed) void fn(); else unlisten = fn; })
      .catch(() => {});

    return () => { disposed = true; unlisten?.(); };
  }, []);

  useEffect(() => {
    if (!item) return;
    let active = true;
    clipboardGet(item.id)
      .then((d) => { if (active) setDetail(d); })
      .catch(() => {});
    return () => { active = false; };
  }, [item?.id]);

  const imageDataUrl = useImageDataUrl(detail);

  function handleMouseEnter() {
    emitRef.current?.("preview:mouse-enter").catch(() => {});
  }

  function handleMouseLeave() {
    emitRef.current?.("preview:mouse-leave").catch(() => {});
  }

  if (!item) {
    return <div className="h-screen w-screen" />;
  }

  const previewText =
    detail?.payload?.textPlain?.trim() || item.preview || "暂无预览";

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="h-screen w-screen overflow-hidden rounded-lg border border-[var(--popup-border)] bg-[var(--popup-bg)] shadow-[var(--popup-shadow)] backdrop-blur-[24px] backdrop-saturate-[1.8]"
    >
      {item.kind === "image" ? (
        <div className="flex h-full w-full items-center justify-center p-1.5">
          {imageDataUrl ? (
            <img
              src={imageDataUrl}
              alt=""
              className="max-h-full max-w-full rounded object-contain"
            />
          ) : (
            <p className="text-[12px] text-[var(--text-tertiary)]">
              {item.meta || "图片"}
            </p>
          )}
        </div>
      ) : (
        <div className="px-2 py-1.5">
          <p className="whitespace-pre-wrap text-[12px] leading-[1.5] text-[var(--text-primary)] line-clamp-6">
            {previewText}
          </p>
        </div>
      )}
    </div>
  );
}
