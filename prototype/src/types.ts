// 原型自包含类型 —— 对齐正式 history-row / settings 形状，不依赖主项目。

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

export type ThemeMode = "system" | "light" | "dark";
export type DefaultAction = "direct_paste" | "copy_only";
export type ExclusionRuleKind = "bundle_id" | "content_kind" | "keyword";

export interface ExclusionRule {
  id: string;
  kind: ExclusionRuleKind;
  value: string;
  enabled: boolean;
}

export interface PrototypeSettings {
  defaultAction: DefaultAction;
  themeMode: ThemeMode;
  historyLimit: number;
  listFontSize: number;
  launchAtLogin: boolean;
  showOnStartup: boolean;
}

export interface PrototypeShortcut {
  binding: string;
  isRegistered: boolean;
  source: "default" | "user";
}
