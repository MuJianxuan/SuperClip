import { memo, useMemo, useState } from "react";
import { CheckSquare, Copy, Inbox, Pin, Square, Star, Trash2 } from "lucide-react";
import type { ClipboardItem } from "../../components/history-row";
import { KIND_META } from "./kind-meta";

interface MainListViewProps {
  items: ClipboardItem[];
  selectedId: string;
  selectedIds: Set<string>;
  hasQuery: boolean;
  onClearSearch: () => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onAction: (id: string) => void;
  onCopy: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}

type GroupId = "today" | "yesterday" | "earlier";

const GROUP_ORDER: GroupId[] = ["today", "yesterday", "earlier"];
const GROUP_LABELS: Record<GroupId, string> = { today: "今天", yesterday: "昨天", earlier: "更早" };

/**
 * 由后端生成的相对时间标签（刚刚 / X 分钟前 / X 小时前 / X 天前）推断日期分组。
 * 数据层不返回原始时间戳，此为确认设计「今天/昨天/更早」的近似实现。
 */
export function groupOf(timeLabel: string): GroupId {
  if (timeLabel.includes("分钟") || timeLabel.includes("小时") || timeLabel === "刚刚") {
    return "today";
  }
  if (/^1 ?天前$/.test(timeLabel.trim())) {
    return "yesterday";
  }
  return "earlier";
}

export const MainListView = memo(function MainListView({
  items,
  selectedId,
  selectedIds,
  hasQuery,
  onClearSearch,
  onSelect,
  onToggleSelect,
  onAction,
  onCopy,
  onPin,
  onDelete,
}: MainListViewProps) {
  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      items: items.filter((item) => groupOf(item.timeLabel) === group),
    })).filter((entry) => entry.items.length > 0);
  }, [items]);

  if (items.length === 0) {
    return (
      <div data-testid="main-list-view" className="flex-1 overflow-y-auto">
        <EmptyState hasQuery={hasQuery} onClearSearch={onClearSearch} />
      </div>
    );
  }

  return (
    <div data-testid="main-list-view" className="flex-1 overflow-y-auto px-2.5 pb-2">
      {grouped.map(({ group, items: groupItems }) => (
        <section key={group} className="mb-1">
          <div className="flex items-center gap-2 px-2 pb-1.5 pt-2.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--group-label,var(--text-tertiary))]">
              {GROUP_LABELS[group]}
            </span>
            <span className="text-[10px] text-[var(--group-count,var(--text-tertiary))]">{groupItems.length}</span>
            <div className="h-px flex-1 bg-[var(--group-line,var(--border))]" />
          </div>
          {groupItems.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              checked={selectedIds.has(item.id)}
              onSelect={onSelect}
              onToggleSelect={onToggleSelect}
              onAction={onAction}
              onCopy={onCopy}
              onPin={onPin}
              onDelete={onDelete}
            />
          ))}
        </section>
      ))}
    </div>
  );
});

/* ================= 列表行 ================= */

function Row({
  item,
  selected,
  checked,
  onSelect,
  onToggleSelect,
  onAction,
  onCopy,
  onPin,
  onDelete,
}: {
  item: ClipboardItem;
  selected: boolean;
  checked: boolean;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onAction: (id: string) => void;
  onCopy: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-clipboard-row-id={item.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(item.id)}
      onDoubleClick={() => onAction(item.id)}
      className="relative flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] transition-colors animate-[rowSlideIn_0.2s_ease-out]"
      style={{
        background: selected ? "var(--row-selected)" : hovered ? "var(--row-hover)" : "transparent",
      }}
    >
      {/* left type accent bar */}
      <div
        className="absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full transition-all"
        style={{
          height: selected ? 20 : 0,
          background: meta.color,
          opacity: selected ? 0.85 : 0,
        }}
        aria-hidden="true"
      />

      {/* checkbox */}
      <button
        type="button"
        title={checked ? "取消选择" : "选择"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(item.id);
        }}
        className="flex h-4 w-[18px] shrink-0 items-center justify-center"
      >
        {checked ? (
          <CheckSquare className="h-[13px] w-[13px]" style={{ color: "rgba(56,189,248,0.7)" }} />
        ) : (
          <Square
            className="h-[13px] w-[13px]"
            style={{ color: hovered ? "var(--checkbox-hover, var(--text-secondary))" : "var(--checkbox-idle, var(--text-tertiary))" }}
          />
        )}
      </button>

      {/* kind icon */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
        style={{
          background: selected ? `${meta.color}14` : "var(--icon-box-bg, var(--surface-2))",
          color: selected ? meta.color : "var(--icon-box-text, var(--text-tertiary))",
        }}
      >
        <Icon className="h-3 w-3" />
      </div>

      {/* title + preview */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`truncate text-[13px] font-medium`}
            style={{ color: selected ? "var(--row-title-selected, var(--text-primary))" : "var(--row-title, var(--text-primary))" }}
          >
            {item.title}
          </span>
          {item.isPinned && (
            <Star
              className="h-[9px] w-[9px] shrink-0"
              style={{ fill: "rgba(251,191,36,0.8)", color: "rgba(251,191,36,0.8)" }}
              aria-label="已置顶"
            />
          )}
        </div>
        <span className="block truncate text-[11px] text-[var(--row-preview,var(--text-tertiary))]">{item.preview}</span>
      </div>

      {/* hover actions or meta（占位等宽，避免 hover 时行跳动） */}
      {hovered && !selected ? (
        <div className="flex shrink-0 items-center gap-[2px]" onClick={(e) => e.stopPropagation()}>
          <RowAction title="复制" onClick={() => onCopy(item.id)}>
            <Copy className="h-3 w-3" />
          </RowAction>
          <RowAction title={item.isPinned ? "取消置顶" : "置顶"} onClick={() => onPin(item.id)}>
            <Pin className="h-3 w-3" />
          </RowAction>
          <RowAction title="删除" danger onClick={() => onDelete(item.id)}>
            <Trash2 className="h-3 w-3" />
          </RowAction>
        </div>
      ) : (
        <div className="flex h-[26px] shrink-0 items-center gap-2.5" style={{ minWidth: 86 }}>
          <span className="truncate text-right text-[11px] text-[var(--row-meta,var(--text-tertiary))]">{item.sourceApp}</span>
          <span className="shrink-0 text-[10.5px] text-[var(--row-time,var(--text-tertiary))]">{item.timeLabel}</span>
        </div>
      )}
    </div>
  );
}

function RowAction({
  title,
  danger,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] transition-colors"
      style={{
        background: hovered ? (danger ? "var(--danger-bg)" : "var(--row-action-hover-bg, var(--tab-hover-bg))") : "var(--surface-2)",
        color: hovered
          ? danger
            ? "var(--danger-text)"
            : "var(--row-action-hover-text, var(--text-primary))"
          : danger
            ? "var(--danger-idle, var(--danger-text))"
            : "var(--row-action-text, var(--text-tertiary))",
      }}
    >
      {children}
    </button>
  );
}

/* ================= 空状态 ================= */

function EmptyState({ hasQuery, onClearSearch }: { hasQuery: boolean; onClearSearch: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-10">
      <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--surface-2)] text-[var(--text-tertiary)]">
        <Inbox className="h-5 w-5" />
      </div>
      <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">
        {hasQuery ? "没有匹配的内容" : "剪贴板暂无记录"}
      </span>
      <span className="text-[11px] text-[var(--text-tertiary)]">
        {hasQuery ? "试试其他关键词" : "复制任意内容后会自动出现在这里"}
      </span>
      {hasQuery ? (
        <button
          type="button"
          onClick={onClearSearch}
          className="mt-1 rounded-lg border border-[var(--border-strong)] bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90"
        >
          清空搜索
        </button>
      ) : null}
    </div>
  );
}
