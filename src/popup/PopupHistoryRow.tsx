import { memo, useRef } from "react";
import { FileImage, FileText, Link, Star } from "lucide-react";
import type { ClipboardItem } from "../components/history-row";

interface PopupHistoryRowProps {
  item: ClipboardItem;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onMouseEnter: (rect: DOMRect) => void;
  onMouseLeave: () => void;
}

/**
 * B2 类型色完整类名（Tailwind 需静态扫描，禁止运行时拼接）。
 * 与 App.css 的 --type-* token 一一对应；rtf 复用 text 类型色。
 */
const kindTextClasses: Record<string, string> = {
  text: "text-[var(--type-text)]",
  html: "text-[var(--type-html)]",
  rtf: "text-[var(--type-text)]",
  image: "text-[var(--type-image)]",
  file: "text-[var(--type-file)]",
};

const kindBarClasses: Record<string, string> = {
  text: "bg-[var(--type-text)]",
  html: "bg-[var(--type-html)]",
  rtf: "bg-[var(--type-text)]",
  image: "bg-[var(--type-image)]",
  file: "bg-[var(--type-file)]",
};

/**
 * 选中态图标容器底：原型为类型色 8% 淡底（${accent}14）。
 * rtf 复用 text 类型色。
 */
const kindBgClasses: Record<string, string> = {
  text: "bg-[color-mix(in_srgb,var(--type-text)_8%,transparent)]",
  html: "bg-[color-mix(in_srgb,var(--type-html)_8%,transparent)]",
  rtf: "bg-[color-mix(in_srgb,var(--type-text)_8%,transparent)]",
  image: "bg-[color-mix(in_srgb,var(--type-image)_8%,transparent)]",
  file: "bg-[color-mix(in_srgb,var(--type-file)_8%,transparent)]",
};

function KindIcon({ kind }: { kind: string }) {
  switch (kind) {
    case "image":
      return <FileImage className="h-3.5 w-3.5" />;
    case "html":
      return <Link className="h-3.5 w-3.5" />;
    default:
      return <FileText className="h-3.5 w-3.5" />;
  }
}

export const PopupHistoryRow = memo(function PopupHistoryRow({
  item,
  isSelected,
  onSelect,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: PopupHistoryRowProps) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const accentTextClass = kindTextClasses[item.kind] ?? "text-[var(--accent)]";
  const accentBarClass = kindBarClasses[item.kind] ?? "bg-[var(--accent)]";
  const accentBgClass = kindBgClasses[item.kind] ?? "bg-[var(--bg-accent)]";

  return (
    <button
      ref={rowRef}
      type="button"
      data-clipboard-row-id={item.id}
      onClick={onClick}
      onMouseEnter={() => {
        onSelect();
        if (rowRef.current) {
          onMouseEnter(rowRef.current.getBoundingClientRect());
        }
      }}
      onMouseLeave={onMouseLeave}
      className={`relative mx-1.5 flex w-[calc(100%-12px)] items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left transition-colors ${
        isSelected ? "bg-[var(--row-selected)]" : "hover:bg-[var(--row-hover)]"
      }`}
    >
      {/* 左侧 3px 类型色条（仅选中态显示） */}
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full transition-all duration-150 ${
          isSelected ? `${accentBarClass} opacity-85` : "opacity-0"
        }`}
      />

      {/* 类型图标容器（选中时按类型色染色） */}
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
          isSelected
            ? `${accentBgClass} ${accentTextClass}`
            : "bg-[var(--border)] text-[var(--text-tertiary)]"
        }`}
      >
        <KindIcon kind={item.kind} />
      </span>

      {/* 标题 + 预览（两行结构） */}
      <span className="min-w-0 flex-1">
        <span
          className={`flex items-center gap-1 truncate text-[13px] leading-[1.25] ${
            isSelected
              ? "font-medium text-[var(--text-primary)]"
              : "text-[var(--text-secondary)]"
          }`}
        >
          <span className="truncate">{item.title}</span>
          {item.isPinned && (
            <Star
              className="h-[9px] w-[9px] shrink-0 text-[var(--pinned)]"
              fill="currentColor"
            />
          )}
        </span>
        <span className="block truncate text-[11px] text-[var(--text-tertiary)]">
          {item.preview}
        </span>
      </span>

      {/* 右侧时间 */}
      <span
        className={`shrink-0 text-[10px] tabular-nums ${
          isSelected
            ? "text-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
            : "text-[var(--text-tertiary)]"
        }`}
      >
        {item.timeLabel}
      </span>
    </button>
  );
});
