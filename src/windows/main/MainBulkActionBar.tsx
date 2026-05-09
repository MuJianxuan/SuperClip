import { memo } from "react";
import { Copy, Pin, Trash2, X } from "lucide-react";

interface MainBulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkCopy: () => void;
  onBulkPin: () => void;
  onBulkDelete: () => void;
}

export const MainBulkActionBar = memo(function MainBulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkCopy,
  onBulkPin,
  onBulkDelete,
}: MainBulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl">
      <span className="text-[13px] font-medium text-[var(--text-primary)]">
        已选 {selectedCount} 项
      </span>

      <div className="h-4 w-px bg-[var(--border)]" />

      <button
        type="button"
        onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
        className="text-[12px] text-[var(--selection-accent)] hover:underline"
      >
        {selectedCount === totalCount ? "取消全选" : "全选"}
      </button>

      <div className="h-4 w-px bg-[var(--border)]" />

      <button
        type="button"
        onClick={onBulkCopy}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--tab-hover-bg)]"
      >
        <Copy className="h-3.5 w-3.5" />
        复制
      </button>
      <button
        type="button"
        onClick={onBulkPin}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--tab-hover-bg)]"
      >
        <Pin className="h-3.5 w-3.5" />
        置顶
      </button>
      <button
        type="button"
        onClick={onBulkDelete}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-bg)]"
      >
        <Trash2 className="h-3.5 w-3.5" />
        删除
      </button>

      <div className="h-4 w-px bg-[var(--border)]" />

      <button
        type="button"
        onClick={onDeselectAll}
        className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});
