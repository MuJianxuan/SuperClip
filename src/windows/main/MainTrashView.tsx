import { memo, useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import type { TrashEntry } from "../../lib/superclip";

interface MainTrashViewProps {
  entries: TrashEntry[];
  retentionDays: number;
  selectedIds: Set<string>;
  readOnly: boolean;
  onToggleSelect: (trashId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRestore: (undoToken: string) => void | Promise<void>;
  onRestoreSelected: () => void | Promise<void>;
  onRestoreAll: () => void | Promise<void>;
  onPurgeSelected: () => void | Promise<void>;
  onPurgeAll: () => void | Promise<void>;
}

/**
 * 回收站视图（D10）：表格布局（内容 / 来源 / 删除时间 / 剩余天数）+ 复选 +
 * 顶部「全部恢复 / 清空回收站」+ 底部「恢复所选 / 彻底删除所选」+ 保留期说明卡。
 * 破坏性操作由调用方弹二次确认；本组件只负责触发与展示。
 */
export const MainTrashView = memo(function MainTrashView({
  entries,
  retentionDays,
  selectedIds,
  readOnly,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onRestore,
  onRestoreSelected,
  onRestoreAll,
  onPurgeSelected,
  onPurgeAll,
}: MainTrashViewProps) {
  const selectedCount = selectedIds.size;
  const allSelected = entries.length > 0 && selectedCount === entries.length;

  const header = useMemo(
    () => (
      <div className="flex items-center gap-3 px-5 pb-3 pt-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
            回收站
          </h2>
          <p className="mt-1 text-[11.5px] text-[var(--text-tertiary)]">
            {entries.length} 条记录 · {retentionDays} 天后自动清空
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ActionButton
            label="全部恢复"
            icon={<RotateCcw className="h-[13px] w-[13px]" />}
            disabled={readOnly || entries.length === 0}
            onClick={() => void onRestoreAll()}
          />
          <ActionButton
            label="清空回收站"
            icon={<Trash2 className="h-[13px] w-[13px]" />}
            danger
            disabled={readOnly || entries.length === 0}
            onClick={() => void onPurgeAll()}
          />
        </div>
      </div>
    ),
    [entries.length, retentionDays, readOnly, onRestoreAll, onPurgeAll],
  );

  return (
    <div data-testid="main-trash-view" className="flex min-h-0 flex-1 flex-col">
      {header}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
        {entries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--surface-2)] text-[var(--text-tertiary)]">
              <Trash2 className="h-5 w-5" />
            </div>
            <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">回收站为空</span>
            <span className="text-[11px] text-[var(--text-tertiary)]">删除的记录会在这里保留 30 天</span>
          </div>
        ) : (
          // table-fixed：长内容不再把「删除时间/剩余」两列挤出可视区
          <table className="w-full table-fixed border-collapse text-[12.5px]">
            <thead>
              <tr>
                <Th className="w-[34px]">
                  <button
                    type="button"
                    title={allSelected ? "取消全选" : "全选"}
                    onClick={allSelected ? onDeselectAll : onSelectAll}
                    disabled={readOnly}
                    className="flex h-[15px] w-[15px] items-center justify-center rounded-[5px] border"
                    style={{
                      borderColor: allSelected ? "var(--accent)" : "var(--border-strong)",
                      background: allSelected ? "var(--accent)" : "transparent",
                    }}
                  >
                    {allSelected ? (
                      <span
                        aria-hidden
                        className="block h-[4px] w-[7px] -translate-y-px rotate-[-45deg] border-b-[1.8px] border-l-[1.8px] border-white"
                      />
                    ) : null}
                  </button>
                </Th>
                <Th>内容</Th>
                <Th className="w-[120px]">来源</Th>
                <Th className="w-[100px]">删除时间</Th>
                <Th className="w-[64px]">剩余</Th>
                <Th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <TrashRow
                  key={entry.trashId}
                  entry={entry}
                  checked={selectedIds.has(entry.trashId)}
                  readOnly={readOnly}
                  onToggleSelect={onToggleSelect}
                  onRestore={onRestore}
                />
              ))}
            </tbody>
          </table>
        )}

        {/* 保留期说明卡 */}
        <div
          data-testid="trash-retention-note"
          className="mb-3 mt-3 rounded-[10px] px-3.5 py-3 text-[11px] leading-[1.6]"
          style={{ background: "var(--card-bg)", color: "var(--text-tertiary)" }}
        >
          回收站记录保留 {retentionDays} 天。恢复后回到原位置与置顶状态；清空后无法找回。
          已排除的敏感内容不会被回收站留存。
        </div>
      </div>

      {/* 底部批量栏 */}
      {entries.length > 0 ? (
        <div
          data-testid="trash-bulk-bar"
          className="flex h-[50px] shrink-0 items-center gap-3 px-5"
          style={{
            background: "var(--accent-soft)",
            borderTop: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
          }}
        >
          <span className="text-[12.5px] text-[var(--text-primary)]">
            已选择 <span className="font-bold tabular-nums text-[var(--accent-text)]">{selectedCount}</span> 条
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ActionButton
              label="恢复所选"
              icon={<RotateCcw className="h-[13px] w-[13px]" />}
              disabled={readOnly || selectedCount === 0}
              onClick={() => void onRestoreSelected()}
            />
            <ActionButton
              label="彻底删除所选"
              icon={<Trash2 className="h-[13px] w-[13px]" />}
              danger
              disabled={readOnly || selectedCount === 0}
              onClick={() => void onPurgeSelected()}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
});

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b px-3 py-[9px] text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-tertiary)] ${className ?? ""}`}
      style={{ borderColor: "var(--divider)", background: "var(--card-bg)" }}
    >
      {children}
    </th>
  );
}

function TrashRow({
  entry,
  checked,
  readOnly,
  onToggleSelect,
  onRestore,
}: {
  entry: TrashEntry;
  checked: boolean;
  readOnly: boolean;
  onToggleSelect: (trashId: string) => void;
  onRestore: (undoToken: string) => void | Promise<void>;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      data-testid="trash-row"
      data-trash-id={entry.trashId}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: checked ? "var(--accent-soft)" : hovered ? "var(--row-hover)" : undefined }}
    >
      <td className="border-b px-3 py-[10px]" style={{ borderColor: "var(--divider)" }}>
        <button
          type="button"
          title={checked ? "取消选择" : "选择"}
          onClick={() => onToggleSelect(entry.trashId)}
          disabled={readOnly}
          className="flex h-[15px] w-[15px] items-center justify-center rounded-[5px] border"
          style={{
            borderColor: checked ? "var(--accent)" : "var(--border-strong)",
            background: checked ? "var(--accent)" : "transparent",
          }}
        >
          {checked ? (
            <span
              aria-hidden
              className="block h-[4px] w-[7px] -translate-y-px rotate-[-45deg] border-b-[1.8px] border-l-[1.8px] border-white"
            />
          ) : null}
        </button>
      </td>
      <td className="border-b px-3 py-[10px]" style={{ borderColor: "var(--divider)" }}>
        <span className="block truncate font-medium text-[var(--text-primary)]">{entry.title}</span>
        <span className="block truncate text-[11px] text-[var(--text-tertiary)]">{entry.preview}</span>
      </td>
      <td className="truncate border-b px-3 py-[10px] text-[var(--text-secondary)]" style={{ borderColor: "var(--divider)" }}>
        {entry.sourceApp}
      </td>
      <td className="border-b px-3 py-[10px] text-[var(--text-secondary)]" style={{ borderColor: "var(--divider)" }}>
        {entry.deletedLabel}
      </td>
      <td className="border-b px-3 py-[10px] tabular-nums text-[var(--text-secondary)]" style={{ borderColor: "var(--divider)" }}>
        {entry.remainingDays} 天
      </td>
      <td className="border-b px-3 py-[10px]" style={{ borderColor: "var(--divider)" }}>
        <button
          type="button"
          title="恢复"
          aria-label={`恢复 ${entry.title}`}
          disabled={readOnly}
          onClick={() => void onRestore(entry.undoToken)}
          className="flex h-[24px] w-[24px] items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-text)]"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

function ActionButton({
  label,
  icon,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 rounded-[9px] border px-3 py-[6px] text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55"
      style={{
        borderColor: danger
          ? `color-mix(in srgb, var(--danger) ${hovered ? 30 : 18}%, transparent)`
          : "var(--border)",
        background: danger
          ? `color-mix(in srgb, var(--danger) ${hovered ? 14 : 8}%, transparent)`
          : hovered
            ? "var(--row-hover)"
            : "var(--card-bg)",
        color: danger ? "var(--danger-text)" : "var(--text-primary)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
