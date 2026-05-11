import { useEffect, useMemo, useState } from "react";
import { clipboardGet, type ClipboardItemDetail } from "../lib/superclip";
import { resolveImageDataUrl } from "../lib/image-utils";
import type { ClipboardItem } from "../components/history-row";

interface PopupPreviewPopoverProps {
  item: ClipboardItem;
  anchorRect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const detailCache = new Map<string, ClipboardItemDetail>();

function useImageDataUrl(detail: ClipboardItemDetail | null) {
  return useMemo(() => {
    return resolveImageDataUrl(detail?.payload ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.item?.id]);
}

export function PopupPreviewPopover({
  item,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
}: PopupPreviewPopoverProps) {
  const [detail, setDetail] = useState<ClipboardItemDetail | null>(
    () => detailCache.get(item.id) ?? null,
  );

  useEffect(() => {
    if (detailCache.has(item.id)) {
      setDetail(detailCache.get(item.id)!);
      return;
    }
    let active = true;
    clipboardGet(item.id)
      .then((d) => {
        if (!active) return;
        detailCache.set(item.id, d);
        if (detailCache.size > 50) {
          const firstKey = detailCache.keys().next().value;
          if (firstKey) detailCache.delete(firstKey);
        }
        setDetail(d);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [item.id]);

  const imageDataUrl = useImageDataUrl(detail);

  const previewText =
    detail?.payload?.textPlain?.trim() || item.preview || "暂无预览";

  const popoverTop = Math.max(8, anchorRect.top - 8);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-50 max-w-[280px] max-h-[300px] overflow-hidden rounded-lg border border-[var(--popup-border)] bg-[var(--popup-bg)] shadow-[var(--popup-shadow)] backdrop-blur-[24px] backdrop-saturate-[1.8] animate-in fade-in slide-in-from-left-1 duration-150"
      style={{
        left: `${anchorRect.right + 8}px`,
        top: `${popoverTop}px`,
      }}
    >
      {item.kind === "image" ? (
        <div className="p-1.5">
          {imageDataUrl ? (
            <img
              src={imageDataUrl}
              alt=""
              className="max-h-[260px] max-w-full rounded object-contain"
            />
          ) : (
            <p className="px-1 py-3 text-[12px] text-[var(--text-tertiary)]">
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
