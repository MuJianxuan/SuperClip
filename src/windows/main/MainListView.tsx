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
    <div data-testid="main-list-view" className="flex-1 overflow-y-auto px-2 pb-2 pt-1">
      {grouped.map(({ group, items: groupItems }) => (
        <section key={group} className="mb-1">
          <div className="flex items-center gap-2 px-2 pb-1 pt-2.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              {GROUP_LABELS[group]}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">{groupItems.length}</span>
            <div className="h-px flex-1 bg-[var(--border)]" />
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
      className="relative flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors animate-[rowSlideIn_0.2s_ease-out]"
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
        className="flex h-4 w-4 shrink-0 items-center justify-center"
      >
        {checked ? (
          <CheckSquare className="h-3.5 w-3.5" style={{ color: "var(--selection-accent)" }} />
        ) : (
          <Square
            className="h-3.5 w-3.5"
            style={{ color: hovered ? "var(--text-secondary)" : "var(--text-tertiary)" }}
          />
        )}
      </button>

      {/* kind icon */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
        style={{
          background: selected ? `${meta.color}14` : "var(--surface-2)",
          color: selected ? meta.color : "var(--text-tertiary)",
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* title + preview */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`truncate text-[13px] leading-5 ${selected ? "font-semibold" : "font-medium"} text-[var(--text-primary)]`}
          >
            {item.title}
          </span>
          {item.isPinned && (
            <Star
              className="h-2.5 w-2.5 shrink-0"
              style={{ fill: "#fbbf24", color: "#fbbf24" }}
              aria-label="已置顶"
            />
          )}
        </div>
        <span className="block truncate text-[11px] text-[var(--text-tertiary)]">{item.preview}</span>
      </div>

      {/* hover actions or meta */}
      {hovered && !selected ? (
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="max-w-[110px] truncate text-[11px] text-[var(--text-tertiary)]">{item.sourceApp}</span>
          <span className="text-[10.5px] text-[var(--text-tertiary)]">{item.timeLabel}</span>
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
        background: hovered ? (danger ? "var(--danger-bg)" : "var(--tab-hover-bg)") : "var(--surface-2)",
        color: hovered
          ? danger
            ? "var(--danger-text)"
            : "var(--text-primary)"
          : danger
            ? "var(--danger-text)"
            : "var(--text-tertiary)",
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
