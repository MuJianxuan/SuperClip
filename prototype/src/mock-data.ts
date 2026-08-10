import type { ClipboardItem, ExclusionRule, PrototypeSettings, PrototypeShortcut } from "./types";

/** 五表面共用 mock 历史（字段对齐正式 ClipboardItem） */
export const MOCK_ITEMS: ClipboardItem[] = [
  {
    id: "1",
    kind: "text",
    title: "macOS 剪贴板管理工具设计稿",
    preview: "设计稿 v3 — 包含 Popup、Main、Settings 等表面",
    sourceApp: "Figma",
    meta: "2 行文本 · 42 字符",
    timeLabel: "刚刚",
    isPinned: true,
  },
  {
    id: "2",
    kind: "text",
    title: "欢迎使用 SuperClip — 快速上手指南",
    preview: "按下 Cmd+Shift+V 唤出剪贴板历史，选择条目即可粘贴。",
    sourceApp: "Notes",
    meta: "2 行文本 · 87 字符",
    timeLabel: "2 分钟前",
    isPinned: false,
  },
  {
    id: "3",
    kind: "image",
    title: "截屏 2026-08-02 14.30.22.png",
    preview: "1600×1200 屏幕截图",
    sourceApp: "系统截屏",
    meta: "PNG · 1600×1200",
    timeLabel: "15 分钟前",
    isPinned: false,
  },
  {
    id: "4",
    kind: "text",
    title: "useEffect 清理函数的最佳实践",
    preview:
      "在 React 18+ 中，useEffect 的清理函数在 StrictMode 下会被调用两次。确保清理函数是幂等的。\n\n```tsx\nuseEffect(() => {\n  const id = setInterval(tick, 1000);\n  return () => clearInterval(id);\n}, []);\n```",
    sourceApp: "Arc",
    meta: "多段文本 · 含代码块",
    timeLabel: "1 小时前",
    isPinned: false,
  },
  {
    id: "5",
    kind: "html",
    title: "Tailwind CSS v4 新特性一览",
    preview:
      "Tailwind CSS v4 引入了全新的 CSS-first 配置方式。\n\n- CSS-first 配置\n- 新的 @theme 指令\n- 改进的性能\n- 更好的 TypeScript 支持",
    sourceApp: "Safari",
    meta: "HTML · 4 段落",
    timeLabel: "2 小时前",
    isPinned: false,
  },
  {
    id: "6",
    kind: "file",
    title: "project-brief-v2.pdf",
    preview: "/Users/rao/Documents/project-brief-v2.pdf",
    sourceApp: "Finder",
    meta: "PDF · 2.1 MB",
    timeLabel: "昨天",
    isPinned: false,
  },
  {
    id: "7",
    kind: "rtf",
    title: "Rust 所有权与生命周期速查表",
    preview:
      "每个值在任意时刻有且只有一个所有者。当所有者离开作用域，值被丢弃。引用不可变（&T）和可变（&mut T）不能同时存在。",
    sourceApp: "VS Code",
    meta: "RTF · 3 行",
    timeLabel: "昨天",
    isPinned: false,
  },
  {
    id: "8",
    kind: "image",
    title: "截屏 2026-08-01 09.12.05.png",
    preview: "800×600 屏幕截图 — 设计评审会议记录",
    sourceApp: "系统截屏",
    meta: "PNG · 800×600",
    timeLabel: "昨天",
    isPinned: false,
  },
  {
    id: "9",
    kind: "text",
    title: "Tauri 2.0 跨平台构建指南",
    preview: "Tauri 2.0 支持 macOS、Windows 和 Linux 的跨平台构建。本文档涵盖从开发环境搭建到生产部署的完整流程。",
    sourceApp: "Arc",
    meta: "2 行文本 · 64 字符",
    timeLabel: "2 天前",
    isPinned: false,
  },
  {
    id: "10",
    kind: "text",
    title: "周报 — 2026 年第 31 周",
    preview: "本周完成：Popup 交互优化、Search 性能提升、若干 Bug 修复。下周计划：Main 批量操作、Settings 重构。",
    sourceApp: "Warp",
    meta: "2 行文本 · 58 字符",
    timeLabel: "3 天前",
    isPinned: false,
  },
  {
    id: "11",
    kind: "image",
    title: "截屏 2026-07-30 18.45.10.png",
    preview: "1920×1080 屏幕截图",
    sourceApp: "系统截屏",
    meta: "PNG · 1920×1080",
    timeLabel: "5 天前",
    isPinned: false,
  },
  {
    id: "12",
    kind: "text",
    title: "Design Tokens 命名规范",
    preview: "颜色、间距、圆角、字体阶层的 token 命名约定。",
    sourceApp: "Figma",
    meta: "1 行文本 · 28 字符",
    timeLabel: "1 周前",
    isPinned: false,
  },
];

export const MOCK_SETTINGS: PrototypeSettings = {
  defaultAction: "direct_paste",
  themeMode: "dark",
  historyLimit: 1000,
  listFontSize: 13,
  launchAtLogin: false,
  showOnStartup: false,
};

export const MOCK_SHORTCUT: PrototypeShortcut = {
  binding: "Cmd+Shift+V",
  isRegistered: true,
  source: "default",
};

export const MOCK_RULES: ExclusionRule[] = [
  {
    id: "r1",
    kind: "bundle_id",
    value: "com.1password.1password",
    enabled: true,
  },
  {
    id: "r2",
    kind: "keyword",
    value: "验证码",
    enabled: true,
  },
  {
    id: "r3",
    kind: "content_kind",
    value: "image",
    enabled: false,
  },
];

/** 由相对时间标签推断日期分组（对齐正式 MainListView.groupOf） */
export type GroupId = "today" | "yesterday" | "earlier";

export function groupOf(timeLabel: string): GroupId {
  if (timeLabel.includes("分钟") || timeLabel.includes("小时") || timeLabel === "刚刚") {
    return "today";
  }
  if (/^1 ?天前$/.test(timeLabel.trim()) || timeLabel === "昨天") {
    return "yesterday";
  }
  return "earlier";
}

export const GROUP_LABELS: Record<GroupId, string> = {
  today: "今天",
  yesterday: "昨天",
  earlier: "更早",
};

export function formatShortcutGlyph(binding: string): string {
  if (!binding) return "";
  const glyph: Record<string, string> = {
    Cmd: "⌘",
    Command: "⌘",
    Shift: "⇧",
    Option: "⌥",
    Alt: "⌥",
    Ctrl: "⌃",
    Control: "⌃",
    Caps: "⇪",
    Return: "⏎",
    Enter: "⏎",
    Tab: "⇥",
    Space: "␣",
    Escape: "⎋",
    Esc: "⎋",
    Delete: "⌫",
    Backspace: "⌫",
  };
  return binding
    .split("+")
    .map((part) => {
      const p = part.trim();
      return glyph[p] ?? (p.length === 1 ? p.toUpperCase() : p);
    })
    .join("");
}
