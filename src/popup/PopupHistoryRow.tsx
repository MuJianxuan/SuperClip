import { memo, useRef } from "react";
import { FileImage, FileText, Link, Pin } from "lucide-react";
import type { ClipboardItem } from "../components/history-row";

interface PopupHistoryRowProps {
  item: ClipboardItem;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onMouseEnter: (rect: DOMRect) => void;
  onMouseLeave: () => void;
}

function KindIcon({ kind, isSelected }: { kind: string; isSelected: boolean }) {
  const className = `h-3.5 w-3.5 ${isSelected ? "text-white/80" : "text-[var(--text-tertiary)]"}`;
  switch (kind) {
    case "image":
      return <FileImage className={className} />;
    case "file":
      return <FileText className={className} />;
    case "link":
      return <Link className={className} />;
    default:
      return <FileText className={className} />;
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
      className={`mx-1.5 flex w-[calc(100%-12px)] items-center gap-2 rounded-[5px] px-2 py-1.5 text-left transition-colors ${
        isSelected
          ? "bg-[var(--selection-accent)] text-white"
          : "hover:bg-[var(--row-hover)]"
      }`}
    >
      <KindIcon kind={item.kind} isSelected={isSelected} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] leading-tight ${isSelected ? "text-white font-medium" : "text-[var(--text-primary)]"}`}>
          {item.title}
        </p>
      </div>
      {item.isPinned && <Pin className={`h-3 w-3 shrink-0 ${isSelected ? "text-white/70" : "text-[var(--text-tertiary)]"}`} />}
    </button>
  );
});
