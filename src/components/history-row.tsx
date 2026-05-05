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
  titleMaxUnits?: number;
}

function getVisualUnit(char: string) {
  return /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/u.test(char) ? 2 : 1;
}

function truncateByVisualUnits(value: string, maxUnits: number | undefined) {
  if (!maxUnits || maxUnits <= 0) {
    return {
      value,
      visibleCharCount: Array.from(value).length,
      isTruncated: false,
    };
  }

  const chars = Array.from(value);
  const totalUnits = chars.reduce((sum, char) => sum + getVisualUnit(char), 0);

  if (totalUnits <= maxUnits) {
    return {
      value,
      visibleCharCount: chars.length,
      isTruncated: false,
    };
  }

  const ellipsis = "...";
  const availableUnits = Math.max(1, maxUnits - ellipsis.length);
  let usedUnits = 0;
  let visibleCharCount = 0;

  for (const char of chars) {
    const nextUnits = usedUnits + getVisualUnit(char);

    if (nextUnits > availableUnits) {
      break;
    }

    usedUnits = nextUnits;
    visibleCharCount += 1;
  }

  return {
    value: `${chars.slice(0, visibleCharCount).join("")}${ellipsis}`,
    visibleCharCount,
    isTruncated: true,
  };
}

function clampHighlightRanges(
  ranges: HighlightRange[] | undefined,
  field: string,
  visibleCharCount: number,
  isTruncated: boolean,
) {
  if (!isTruncated) {
    return ranges;
  }

  return ranges
    ?.map((range) => {
      if (range.field !== field) {
        return range;
      }

      return {
        ...range,
        start: Math.min(range.start, visibleCharCount),
        end: Math.min(range.end, visibleCharCount),
      };
    })
    .filter((range) => range.field !== field || range.start < range.end);
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

export function HistoryRow({ item, selected, onSelect, rowId, titleMaxUnits }: HistoryRowProps) {
  const Icon = iconMap[item.kind];
  const titleField = item.kind === "file" ? "file_name" : "title";
  const displayTitle = truncateByVisualUnits(item.title, titleMaxUnits);
  const displayHighlightRanges = clampHighlightRanges(
    item.highlightRanges,
    titleField,
    displayTitle.visibleCharCount,
    displayTitle.isTruncated,
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      data-clipboard-row-id={rowId}
      aria-label={`${labelMap[item.kind]} ${item.title}${item.isPinned ? " 置顶" : ""}`}
      title={item.title}
      className={cn(
        "group relative flex min-w-0 w-full items-center gap-2.5 rounded-[10px] border border-transparent bg-transparent px-2.5 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-strong)] focus-visible:ring-offset-0",
        selected
          ? "before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-[var(--accent)]"
          : "hover:border-[var(--border)] hover:bg-[var(--surface-2)]",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border bg-[var(--surface-2)] text-[var(--accent)]",
          selected ? "border-[var(--border-strong)] bg-[var(--surface)]" : "border-[var(--border)]",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[13px] leading-5 text-[var(--text-primary)]",
              selected ? "font-semibold" : "font-medium",
            )}
          >
            {renderHighlightedText(displayTitle.value, displayHighlightRanges, titleField)}
          </p>
          {item.isPinned ? (
            <div
              className="shrink-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--text-secondary)]"
              aria-hidden="true"
            >
              <Pin className="h-3 w-3" />
            </div>
          ) : null}
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
