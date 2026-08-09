import { memo, useState } from "react";
import { CheckSquare, Inbox, Pin, Square, Star, Trash2 } from "lucide-react";
import type { ClipboardItem } from "../../components/history-row";
import { KIND_META } from "./kind-meta";

interface MainGridViewProps {
  items: ClipboardItem[];
  selectedId: string;
  selectedIds: Set<string>;
  hasQuery: boolean;
  onClearSearch: () => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onAction: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  /** 卡片 hover 预览：与 MainListView 行 hover 同链路（MainApp 的 useHoverPreview 消费）；
   * cursorX/cursorY 为鼠标在窗口内的 client 坐标，用于悬浮窗跟随鼠标右侧定位 */
  onRowHover: (item: ClipboardItem, rect: DOMRect, cursorX: number, cursorY: number) => void;
  onRowLeave: () => void;
}

/** E2 网格：卡片 minmax(160px,1fr) 自适应列，顶部类型色渐变条，20px 图标。 */
export const MainGridView = memo(function MainGridView({
  items,
  selectedId,
  selectedIds,
  hasQuery,
  onClearSearch,
  onSelect,
  onToggleSelect,
  onAction,
  onPin,
  onDelete,
  onRowHover,
  onRowLeave,
}: MainGridViewProps) {
  if (items.length === 0) {
    return (
      <div data-testid="main-grid-view" className="flex-1 overflow-y-auto px-4 py-5">
        <EmptyState hasQuery={hasQuery} onClearSearch={onClearSearch} />
      </div>
    );
  }

  return (
    <div
      data-testid="main-grid-view"
      className="flex-1 overflow-y-auto px-2.5 pb-2"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, alignContent: "start", paddingTop: 6 }}
    >
      {items.map((item) => (
        <GridCard
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          checked={selectedIds.has(item.id)}
          onSelect={onSelect}
          onToggleSelect={onToggleSelect}
          onAction={onAction}
          onPin={onPin}
          onDelete={onDelete}
          onRowHover={onRowHover}
          onRowLeave={onRowLeave}
        />
      ))}
    </div>
  );
});

function GridCard({
  item,
  selected,
  checked,
  onSelect,
  onToggleSelect,
  onAction,
  onPin,
  onDelete,
  onRowHover,
  onRowLeave,
}: {
  item: ClipboardItem;
  selected: boolean;
  checked: boolean;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onAction: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onRowHover: (item: ClipboardItem, rect: DOMRect, cursorX: number, cursorY: number) => void;
  onRowLeave: () => void;
}) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-clipboard-row-id={item.id}
      data-selected={selected || undefined}
      onMouseEnter={(e) => {
        setHovered(true);
        onRowHover(item, e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onRowLeave();
      }}
      onClick={() => onSelect(item.id)}
      onDoubleClick={() => onAction(item.id)}
      className="relative flex min-h-[118px] cursor-pointer flex-col overflow-hidden rounded-xl border p-[11px] transition-all animate-[rowSlideIn_0.2s_ease-out]"
      style={{
        background: selected ? "var(--row-selected)" : hovered ? "var(--grid-card-hover, var(--row-hover))" : "var(--grid-card-bg)",
        borderColor: selected ? "rgba(56,189,248,0.15)" : hovered ? `${meta.color}22` : "var(--border)",
      }}
    >
      {/* top type gradient bar */}
      <div
        className="absolute left-0 right-0 top-0 h-[2px] transition-opacity"
        style={{
          background: `linear-gradient(90deg, ${meta.color}, transparent)`,
          opacity: hovered || selected ? 0.55 : 0.18,
        }}
        aria-hidden="true"
      />

      {/* header: icon + pin + checkbox */}
      <div className="mb-2 flex items-start justify-between">
        <div
          className="flex h-[26px] w-[26px] items-center justify-center rounded-lg transition-colors"
          style={{
            background: selected ? `${meta.color}14` : "var(--icon-box-bg, var(--surface-2))",
            color: selected ? meta.color : "var(--icon-box-text, var(--text-tertiary))",
          }}
        >
          <Icon className="h-3 w-3" />
        </div>
        <div className="flex items-center gap-1.5">
          {item.isPinned && (
            <Star className="h-2.5 w-2.5" style={{ fill: "rgba(251,191,36,0.8)", color: "rgba(251,191,36,0.8)" }} aria-label="已置顶" />
          )}
          <button
            type="button"
            title={checked ? "取消选择" : "选择"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(item.id);
            }}
            className="flex items-center justify-center"
          >
            {checked ? (
              <CheckSquare className="h-3 w-3" style={{ color: "rgba(56,189,248,0.7)" }} />
            ) : (
              <Square
                className="h-3 w-3"
                style={{ color: hovered ? "var(--checkbox-hover, var(--text-secondary))" : "var(--checkbox-idle, var(--text-tertiary))" }}
              />
            )}
          </button>
        </div>
      </div>

      {/* body */}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--row-title,var(--text-primary))]">{item.title}</p>
        <p className="mt-1 truncate text-[10.5px] text-[var(--text-tertiary)]">{item.preview}</p>
      </div>

      {/* footer */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-1.5 text-[10px] text-[var(--row-time,var(--text-tertiary))]" style={{ borderColor: "var(--group-line, var(--border))" }}>
        <span className="truncate text-[var(--row-meta,var(--text-tertiary))]">{item.sourceApp}</span>
        <span className="shrink-0">{item.timeLabel}</span>
      </div>

      {/* hover quick actions */}
      {hovered && (
        <div className="absolute right-2 top-7 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title={item.isPinned ? "取消置顶" : "置顶"}
            onClick={() => onPin(item.id)}
            className="flex h-[24px] w-[24px] items-center justify-center rounded-md bg-[var(--surface-raised)] text-[var(--text-tertiary)] shadow-sm transition-colors hover:text-[var(--selection-accent)]"
          >
            <Pin className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="删除"
            onClick={() => onDelete(item.id)}
            className="flex h-[24px] w-[24px] items-center justify-center rounded-md bg-[var(--surface-raised)] text-[var(--text-tertiary)] shadow-sm transition-colors hover:text-[var(--danger-text)]"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

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
