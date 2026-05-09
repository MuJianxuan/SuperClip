import { memo } from "react";
import { Pin, Trash2, FileImage } from "lucide-react";
import type { ClipboardItem } from "../../components/history-row";

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
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect(item.id)}
            onDoubleClick={() => onAction(item.id)}
            className={`group relative cursor-pointer rounded-xl border p-3 transition-all ${
              item.id === selectedId
                ? "border-[var(--selection-accent)] bg-[var(--row-selected)] shadow-sm"
                : "border-[var(--border)] bg-[var(--grid-card-bg)] hover:border-[var(--border-strong)] hover:shadow-sm"
            }`}
          >
            {/* Checkbox */}
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

            {/* Preview */}
            <div className="mb-2.5 flex h-[100px] items-center justify-center overflow-hidden rounded-lg bg-[var(--surface-2)]">
              {item.kind === "image" ? (
                <FileImage className="h-8 w-8 text-[var(--text-tertiary)]" />
              ) : (
                <p className="line-clamp-4 px-2.5 text-[11px] leading-[1.6] text-[var(--text-secondary)]">
                  {item.preview || item.title}
                </p>
              )}
            </div>

            {/* Info */}
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

            {/* Action Overlay */}
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
      {!items.length && (
        <div className="flex h-[300px] items-center justify-center">
          <p className="text-[14px] text-[var(--text-tertiary)]">暂无记录</p>
        </div>
      )}
    </div>
  );
});
