import type { LucideIcon } from "lucide-react";
import { FileCode2, FileImage, FileText, FolderClosed, Pin, Type } from "lucide-react";
import { cn } from "../lib/utils";

export type ClipboardKind = "text" | "html" | "rtf" | "image" | "file";

export interface HighlightRange {
  field: string;
  start: number;
  end: number;
}

export interface ClipboardItem {
  id: string;
  kind: ClipboardKind;
  title: string;
  preview: string;
  sourceApp: string;
  meta: string;
  timeLabel: string;
  isPinned: boolean;
  matchType?: "exact" | "prefix" | "contains" | "recent" | null;
  matchedFields?: string[];
  highlightRanges?: HighlightRange[];
}

const iconMap: Record<ClipboardKind, LucideIcon> = {
  text: Type,
  html: FileCode2,
  rtf: FileText,
  image: FileImage,
  file: FolderClosed,
};

const labelMap: Record<ClipboardKind, string> = {
  text: "Text",
  html: "HTML",
  rtf: "RTF",
  image: "Image",
  file: "File",
};

interface HistoryRowProps {
  item: ClipboardItem;
  selected: boolean;
  onSelect: (id: string) => void;
  rowId?: string;
}

function renderHighlightedText(value: string, ranges: HighlightRange[] | undefined, field: string) {
  const range = ranges?.find((entry) => entry.field === field);

  if (!range || range.start >= range.end) {
    return value;
  }

  const chars = Array.from(value);
  const start = Math.max(0, Math.min(range.start, chars.length));
  const end = Math.max(start, Math.min(range.end, chars.length));

  return (
    <>
      {chars.slice(0, start).join("")}
      <mark className="rounded-[4px] bg-[var(--accent-soft)] px-0.5 text-[var(--text-primary)]">
        {chars.slice(start, end).join("")}
      </mark>
      {chars.slice(end).join("")}
    </>
  );
}

export function HistoryRow({ item, selected, onSelect, rowId }: HistoryRowProps) {
  const Icon = iconMap[item.kind];
  const titleField = item.kind === "file" ? "file_name" : "title";

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      data-clipboard-row-id={rowId}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-[15px] border px-3 py-2.5 text-left transition-all",
        selected
          ? "border-[var(--border-strong)] bg-white shadow-[0_8px_18px_rgba(20,24,30,0.06)] before:absolute before:bottom-3 before:left-0 before:top-3 before:w-[3px] before:rounded-r-full before:bg-[var(--accent)]"
          : "border-transparent bg-transparent hover:border-[var(--border)] hover:bg-[var(--surface-2)]",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border bg-[var(--surface-2)] text-[var(--accent)]",
          selected ? "border-[var(--border-strong)]" : "border-[var(--border)]",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                {renderHighlightedText(item.title, item.highlightRanges, titleField)}
              </p>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                {labelMap[item.kind]}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-secondary)]">
              {renderHighlightedText(item.preview, item.highlightRanges, "preview_text")}
            </p>
          </div>
          {item.isPinned ? (
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--text-secondary)]">
              <Pin className="h-3 w-3" />
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[var(--text-tertiary)]">
          <span>{item.sourceApp}</span>
          <span>{item.meta}</span>
          <span>{item.timeLabel}</span>
        </div>
      </div>
    </button>
  );
}

export function getClipboardIcon(kind: ClipboardKind) {
  return iconMap[kind];
}

export function getClipboardKindLabel(kind: ClipboardKind) {
  return labelMap[kind];
}
