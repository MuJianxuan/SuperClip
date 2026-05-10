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

function KindIcon({ kind }: { kind: string }) {
  const className = "h-4 w-4 text-[var(--text-tertiary)]";
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
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
        isSelected
          ? "bg-[var(--row-selected)] border-l-[3px] border-l-[var(--selection-accent)]"
          : "border-l-[3px] border-l-transparent hover:bg-[var(--row-hover)]"
      }`}
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)]">
        <KindIcon kind={item.kind} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight text-[var(--text-primary)]">
          {item.title}
        </p>
      </div>
      {item.isPinned && <Pin className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" />}
    </button>
  );
});
