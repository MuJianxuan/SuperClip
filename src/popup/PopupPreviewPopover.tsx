import { useEffect, useState } from "react";
import { clipboardGet, type ClipboardItemDetail } from "../lib/superclip";
import type { ClipboardItem } from "../components/history-row";

interface PopupPreviewPopoverProps {
  item: ClipboardItem;
  anchorRect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function PopupPreviewPopover({
  item,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
}: PopupPreviewPopoverProps) {
  const [detail, setDetail] = useState<ClipboardItemDetail | null>(null);

  useEffect(() => {
    let active = true;
    clipboardGet(item.id)
      .then((d) => { if (active) setDetail(d); })
      .catch(() => {});
    return () => { active = false; };
  }, [item.id]);

  const previewText =
    detail?.payload?.textPlain?.trim() || item.preview || "暂无预览";

  const popoverTop = Math.max(8, anchorRect.top - 8);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-50 w-[280px] max-h-[320px] overflow-hidden rounded-xl border border-[var(--popup-border)] bg-[var(--popup-bg)] shadow-[var(--popup-shadow)] backdrop-blur-[24px] backdrop-saturate-[1.8] animate-in fade-in slide-in-from-left-1 duration-150"
      style={{
        left: `${anchorRect.right + 8}px`,
        top: `${popoverTop}px`,
      }}
    >
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            {item.kind}
          </span>
          <span className="text-[11px] text-[var(--text-tertiary)]">
            {item.sourceApp}
          </span>
        </div>

        {item.kind === "image" ? (
          <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]">
            <p className="text-[12px] text-[var(--text-tertiary)]">
              {item.meta || "图片预览"}
            </p>
          </div>
        ) : (
          <div className="max-h-[240px] overflow-hidden rounded-lg bg-[var(--surface-2)] p-2.5">
            <p className="whitespace-pre-wrap text-[12px] leading-[1.6] text-[var(--text-primary)] line-clamp-[8]">
              {previewText}
            </p>
          </div>
        )}

        <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
          {item.timeLabel}
        </p>
      </div>
    </div>
  );
}
