import { memo, useEffect, useRef, useState } from "react";
import { Copy, FileImage, FileText, Link, Pin, Star, Trash2 } from "lucide-react";
import type { ClipboardItem } from "../components/history-row";

interface PopupHistoryRowProps {
  item: ClipboardItem;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onMouseEnter: (rect: DOMRect) => void;
  onMouseLeave: () => void;
  onPin: () => void;
  onDelete: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * 类型色已收敛为中性灰：图标保持 --icon-idle，选中态用强调色（--accent-text）。
 * 类型只靠图标形状区分，不再按类型着色。
 */
const TYPE_ICON_CLASS = "text-[var(--icon-idle)]";
const ACCENT_ICON_CLASS = "text-[var(--accent-text)]";
const ACCENT_BAR_CLASS = "bg-[var(--accent)]";

function KindIcon({ kind }: { kind: string }) {
  switch (kind) {
    case "image":
      return <FileImage className="h-[13px] w-[13px]" />;
    case "html":
      return <Link className="h-[13px] w-[13px]" />;
    default:
      return <FileText className="h-[13px] w-[13px]" />;
  }
}

export const PopupHistoryRow = memo(function PopupHistoryRow({
  item,
  isSelected,
  onSelect,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onPin,
  onDelete,
  onContextMenu,
}: PopupHistoryRowProps) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const accentTextClass = isSelected ? ACCENT_ICON_CLASS : TYPE_ICON_CLASS;
  const accentBarClass = ACCENT_BAR_CLASS;
  const accentBgClass = "bg-[var(--accent-soft)]";
  const showActions = hovered || isSelected;

  return (
    <button
      ref={rowRef}
      type="button"
      data-clipboard-row-id={item.id}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => {
        onSelect();
        setHovered(true);
        if (rowRef.current) {
          onMouseEnter(rowRef.current.getBoundingClientRect());
        }
      }}
      onMouseLeave={() => {
        setHovered(false);
        onMouseLeave();
      }}
      className={`relative mx-1.5 flex w-[calc(100%-12px)] items-center gap-[9px] rounded-[9px] px-[9px] py-[7px] text-left transition-colors ${
        isSelected ? "bg-[var(--row-selected)]" : "hover:bg-[var(--row-hover)]"
      }`}
    >
      {/* 左侧 2.5px 强调色条（仅选中态显示） */}
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 w-[2.5px] -translate-y-1/2 rounded-[2px] transition-all duration-150 ${
          isSelected ? `${accentBarClass} h-[15px] opacity-85` : "h-0 opacity-0"
        }`}
      />

      {/* 类型图标容器（选中时用强调色淡底；hover 操作占位不改变尺寸） */}
      <span
        className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] transition-colors duration-150 ${
          isSelected
            ? `${accentBgClass} ${accentTextClass}`
            : "bg-[var(--icon-bg)] text-[var(--icon-idle)]"
        }`}
      >
        <KindIcon kind={item.kind} />
      </span>

      {/* 标题 + 预览（两行结构） */}
      <span className="min-w-0 flex-1">
        <span
          className={`flex items-center gap-1 truncate leading-[1.35] ${
            isSelected
              ? "font-semibold text-[var(--text-primary)]"
              : "text-[var(--text-secondary)]"
          }`}
          style={{ fontSize: "var(--list-font-size)" }}
        >
          <span className="truncate">{item.title}</span>
          {item.isPinned && (
            <Star
              className="h-[9px] w-[9px] shrink-0 text-[var(--pinned)]"
              fill="currentColor"
              aria-label="已置顶"
            />
          )}
        </span>
        <span
          className="mt-px block truncate text-[var(--text-tertiary)]"
          style={{ fontSize: "calc(var(--list-font-size) - 2px)" }}
        >
          {item.preview}
        </span>
      </span>

      {/* 右侧：默认时间；hover/选中换成置顶 + 删除（同宽占位，避免行跳动） */}
      {showActions ? (
        <span className="flex shrink-0 items-center gap-px" data-testid="popup-row-actions">
          <span
            role="button"
            tabIndex={-1}
            title={item.isPinned ? "取消置顶" : "置顶"}
            aria-label={item.isPinned ? "取消置顶" : "置顶"}
            onClick={(event) => {
              event.stopPropagation();
              onPin();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex h-[21px] w-[21px] items-center justify-center rounded-[6px] bg-[var(--bg-elevated,var(--surface-2))] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <Pin className="h-[12px] w-[12px]" />
          </span>
          <span
            role="button"
            tabIndex={-1}
            title="删除"
            aria-label="删除"
            data-action="delete"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex h-[21px] w-[21px] items-center justify-center rounded-[6px] bg-[var(--bg-elevated,var(--surface-2))] text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-bg)]"
          >
            <Trash2 className="h-[12px] w-[12px]" />
          </span>
        </span>
      ) : (
        <span
          className="shrink-0 text-right tabular-nums text-[var(--text-tertiary)]"
          style={{ fontSize: "calc(var(--list-font-size) - 3px)" }}
        >
          {item.timeLabel}
        </span>
      )}
    </button>
  );
});

/** 右键菜单项（hover 由 React state 驱动） */
export function PopupContextMenu({
  x,
  y,
  item,
  onCopy,
  onPaste,
  onPastePlainText,
  onPin,
  onDetail,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  item: ClipboardItem;
  onCopy: () => void;
  onPaste: () => void;
  onPastePlainText: () => void;
  onPin: () => void;
  onDetail: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const entries: Array<{
    key: string;
    label: string;
    shortcut?: string;
    icon: React.ReactNode;
    danger?: boolean;
    onSelect: () => void;
  }> = [
    { key: "copy", label: "复制", shortcut: "⌘C", icon: <Copy className="h-[13px] w-[13px]" />, onSelect: onCopy },
    { key: "paste", label: "粘贴到前台应用", shortcut: "↵", icon: <FileText className="h-[13px] w-[13px]" />, onSelect: onPaste },
    {
      key: "paste-plain",
      label: "粘贴为纯文本",
      shortcut: "⌥↵",
      icon: <FileText className="h-[13px] w-[13px]" />,
      onSelect: onPastePlainText,
    },
    {
      key: "pin",
      label: item.isPinned ? "取消置顶" : "置顶",
      shortcut: "⌘P",
      icon: <Pin className="h-[13px] w-[13px]" />,
      onSelect: onPin,
    },
    { key: "detail", label: "查看详情", icon: <FileImage className="h-[13px] w-[13px]" />, onSelect: onDetail },
    { key: "delete", label: "删除", shortcut: "⌘⌫", icon: <Trash2 className="h-[13px] w-[13px]" />, danger: true, onSelect: onDelete },
  ];

  return (
    <div
      ref={menuRef}
      data-testid="popup-context-menu"
      role="menu"
      className="fixed z-50 min-w-[178px] rounded-[10px] p-[5px] backdrop-blur-[30px]"
      style={{
        left: x,
        top: y,
        background: "var(--bg-window-solid, var(--surface-raised))",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-raised, 0 6px 20px rgba(0,0,0,0.35))",
      }}
    >
      {entries.map((entry, index) => (
        <div key={entry.key}>
          {index === 4 ? <div className="my-1 h-px" style={{ background: "var(--divider)" }} /> : null}
          <ContextMenuItem
            icon={entry.icon}
            label={entry.label}
            shortcut={entry.shortcut}
            danger={entry.danger}
            onSelect={() => {
              entry.onSelect();
              onClose();
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ContextMenuItem({
  icon,
  label,
  shortcut,
  danger,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  danger?: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex w-full items-center gap-[9px] rounded-[6px] px-[9px] py-[7px] text-left text-[12.5px] transition-colors"
      style={{
        background: hovered ? "var(--accent)" : "transparent",
        color: hovered
          ? "var(--accent-contrast)"
          : danger
            ? "var(--danger-text)"
            : "var(--text-primary)",
      }}
    >
      <span style={{ color: "inherit" }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut ? (
        <span
          className="font-mono text-[10px]"
          style={{ color: hovered ? "var(--accent-contrast)" : "var(--text-tertiary)" }}
        >
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}
