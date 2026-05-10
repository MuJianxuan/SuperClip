import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Pin, Trash2 } from "lucide-react";
import type { ClipboardItem } from "../../components/history-row";
import { ImageThumbnail } from "../../components/ImageThumbnail";

interface MainGridViewProps {
  items: ClipboardItem[];
  selectedId: string;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onAction: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}

const CARD_HEIGHT = 140;
const ROW_GAP = 5;
const COLUMNS = 3;

export const MainGridView = memo(function MainGridView({
  items,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onAction,
  onPin,
  onDelete,
}: MainGridViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = Math.ceil(items.length / COLUMNS);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT + ROW_GAP,
    overscan: 4,
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5" ref={parentRef}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * COLUMNS;
          const rowItems = items.slice(startIdx, startIdx + COLUMNS);

          return (
            <div
              key={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="grid grid-cols-3 items-start gap-x-5"
            >
              {rowItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  onDoubleClick={() => onAction(item.id)}
                  className={`group relative cursor-pointer rounded-xl border p-2.5 ${
                    item.id === selectedId
                      ? "border-[var(--selection-accent)] bg-[var(--row-selected)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--grid-card-bg)] hover:border-[var(--border-strong)] hover:shadow-sm"
                  }`}
                >
                  <div className="absolute left-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleSelect(item.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5 rounded border-[var(--border-strong)]"
                    />
                  </div>

                  <div className="mb-1.5 flex h-[68px] items-start overflow-hidden rounded-lg bg-[var(--surface-2)]">
                    {item.kind === "image" ? (
                      <ImageThumbnail itemId={item.id} className="h-full w-full object-cover" />
                    ) : (
                      <p className="line-clamp-3 px-2 pt-1.5 text-[11px] leading-[1.6] text-[var(--text-secondary)]">
                        {item.preview || item.title}
                      </p>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                        {item.sourceApp} · {item.timeLabel}
                      </p>
                    </div>
                    {item.isPinned && <Pin className="h-3 w-3 shrink-0 text-[var(--selection-accent)]" />}
                  </div>

                  <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onPin(item.id); }}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--text-secondary)] shadow-sm hover:text-[var(--text-primary)]"
                    >
                      <Pin className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--text-secondary)] shadow-sm hover:text-[var(--danger-text)]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {!items.length && (
        <div className="flex h-[300px] items-center justify-center">
          <p className="text-[14px] text-[var(--text-tertiary)]">暂无记录</p>
        </div>
      )}
    </div>
  );
});