import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Copy, Pin, Trash2, ArrowUpRight } from "lucide-react";
import type { ClipboardItem } from "../../components/history-row";

interface MainListViewProps {
  items: ClipboardItem[];
  selectedId: string;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onAction: (id: string) => void;
  onCopy: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}

const ROW_HEIGHT = 52;

export const MainListView = memo(function MainListView({
  items,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onAction,
  onCopy,
  onPin,
  onDelete,
}: MainListViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="flex-1 overflow-y-auto" ref={parentRef}>
      <div className="sticky top-0 z-10 flex h-8 items-center border-b border-[var(--border)] bg-[var(--surface-raised)] text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
        <div className="w-10 px-3">
          <input
            type="checkbox"
            checked={selectedIds.size === items.length && items.length > 0}
            onChange={() => {
              if (selectedIds.size === items.length) {
                selectedIds.clear();
              }
            }}
            className="h-3.5 w-3.5 rounded border-[var(--border-strong)]"
          />
        </div>
        <div className="flex-1 px-3">内容</div>
        <div className="w-24 px-3">来源</div>
        <div className="w-20 px-3">时间</div>
        <div className="w-28 px-3 text-right">操作</div>
      </div>

      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={item.id}
              data-clipboard-row-id={item.id}
              onClick={() => onSelect(item.id)}
              onDoubleClick={() => onAction(item.id)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={`group flex cursor-pointer items-center border-b border-[var(--border)] transition-colors ${
                item.id === selectedId
                  ? "bg-[var(--row-selected)]"
                  : "hover:bg-[var(--row-hover)]"
              }`}
            >
              <div className="w-10 px-3">
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
              <div className="flex flex-1 items-center gap-2.5 px-3">
                <span className="inline-flex h-6 items-center rounded-md bg-[var(--surface-2)] px-1.5 text-[10px] font-medium uppercase text-[var(--text-tertiary)]">
                  {item.kind}
                </span>
                <span className="truncate text-[13px] text-[var(--text-primary)]">
                  {item.title}
                </span>
                {item.isPinned && <Pin className="h-3 w-3 shrink-0 text-[var(--selection-accent)]" />}
              </div>
              <div className="w-24 px-3 text-[12px] text-[var(--text-secondary)]">
                {item.sourceApp}
              </div>
              <div className="w-20 px-3 text-[12px] text-[var(--text-tertiary)]">
                {item.timeLabel}
              </div>
              <div className="w-28 px-3">
                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAction(item.id); }}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]"
                    title="粘贴"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCopy(item.id); }}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]"
                    title="复制"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPin(item.id); }}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]"
                    title={item.isPinned ? "取消置顶" : "置顶"}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
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