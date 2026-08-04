import { memo, useState } from "react";
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

/**
 * E2 批量操作栏：有选中时自底部滑入（translateY + fade），蓝色计数高亮，
 * 复制 / 置顶 / 删除 + 取消。始终渲染以保留滑入动画，隐藏时不可交互。
 */
export const MainBulkActionBar = memo(function MainBulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkCopy,
  onBulkPin,
  onBulkDelete,
}: MainBulkActionBarProps) {
  const visible = selectedCount > 0;
  const allSelected = selectedCount > 0 && selectedCount === totalCount;

  return (
    <div
      data-testid="main-bulk-action-bar"
      aria-hidden={!visible}
      className="relative z-30 shrink-0 border-t px-4 py-2 transition-[transform,opacity] duration-200 ease-out"
      style={{
        transform: visible ? "translateY(0)" : "translateY(100%)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        borderColor: "var(--border)",
        background: "var(--surface-raised)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-[var(--text-secondary)]">
            已选 <span className="font-semibold tabular-nums text-[var(--selection-accent)]">{selectedCount}</span> 项
          </span>
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            disabled={allSelected}
            className="rounded-md px-1.5 py-0.5 text-[11px] transition-colors disabled:cursor-default"
            style={{
              color: allSelected ? "var(--text-tertiary)" : "var(--selection-accent)",
            }}
          >
            {allSelected ? "已全选" : "全选可见"}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <BulkBtn icon={<Copy className="h-3 w-3" />} label="复制" onClick={onBulkCopy} />
          <BulkBtn icon={<Pin className="h-3 w-3" />} label="置顶" onClick={onBulkPin} />
          <BulkBtn icon={<Trash2 className="h-3 w-3" />} label="删除" danger onClick={onBulkDelete} />
          <button
            type="button"
            title="取消选择"
            onClick={onDeselectAll}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

function BulkBtn({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-all"
      style={{
        borderColor: danger ? (hovered ? "rgba(239,68,68,0.35)" : "var(--border)") : "var(--border)",
        background: hovered ? (danger ? "var(--danger-bg)" : "var(--tab-hover-bg)") : "var(--surface-2)",
        color: hovered
          ? danger
            ? "var(--danger-text)"
            : "var(--text-primary)"
          : danger
            ? "var(--danger-text)"
            : "var(--text-secondary)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
