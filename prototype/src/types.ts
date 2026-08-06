// 原型自包含的类型定义。
// 从 src/components/history-row.tsx 复制，切断原型对主项目业务代码的依赖。
// 原型只关心剪贴板条目的数据形状，不需要 history-row 组件本身。

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
