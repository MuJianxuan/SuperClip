import { useCallback, useEffect, useState } from "react";
import { PrototypeSwitcher } from "./PrototypeSwitcher";
import { VariantB_Card } from "./variants/VariantB_Card";
import { VariantD_QuickPanel } from "./variants/VariantD_QuickPanel";
import { VariantE_Main } from "./variants/VariantE_Main";
import { VariantF_Settings } from "./variants/VariantF_Settings";
import { VariantG_Preview } from "./variants/VariantG_Preview";
import type { ClipboardItem } from "./types";

/** 原型用 mock 数据 */
const MOCK_ITEMS: ClipboardItem[] = [
  {
    id: "1",
    kind: "text",
    title: "macOS 剪贴板管理工具设计稿",
    preview: "设计稿 v3 — 包含 Popup、Main、Settings 等表面",
    sourceApp: "Figma",
    meta: "Fig",
    timeLabel: "刚刚",
    isPinned: true,
  },
  {
    id: "2",
    kind: "text",
    title: "欢迎使用 SuperClip — 快速上手指南",
    preview: "按下 Cmd+Shift+V 唤出剪贴板历史，选择条目即可粘贴。",
    sourceApp: "Notes",
    meta: "Nt",
    timeLabel: "2 分钟前",
    isPinned: false,
  },
  {
    id: "3",
    kind: "image",
    title: "截屏 2026-08-02 14.30.22.png",
    preview: "1600×1200 屏幕截图",
    sourceApp: "系统截屏",
    meta: "IMG",
    timeLabel: "15 分钟前",
    isPinned: false,
  },
  {
    id: "4",
    kind: "text",
    title: "useEffect 清理函数的最佳实践",
    preview: "在 React 18+ 中，useEffect 的清理函数在 StrictMode 下会被调用两次。这是为了帮助你发现副作用中的问题。确保清理函数是幂等的，能够安全地多次执行。",
    sourceApp: "Arc",
    meta: "Arc",
    timeLabel: "1 小时前",
    isPinned: false,
  },
  {
    id: "5",
    kind: "html",
    title: "Tailwind CSS v4 新特性一览",
    preview: "Tailwind CSS v4 引入了全新的 CSS-first 配置方式，无需 tailwind.config.js。主要新特性包括 CSS-first 配置、新的 @theme 指令、改进的性能和更好的 TypeScript 支持。",
    sourceApp: "Safari",
    meta: "SAF",
    timeLabel: "2 小时前",
    isPinned: false,
  },
  {
    id: "6",
    kind: "file",
    title: "project-brief-v2.pdf",
    preview: "Project Brief — 第四版产品需求文档，包含完整的功能规格和交互说明",
    sourceApp: "Finder",
    meta: "PDF",
    timeLabel: "昨天",
    isPinned: false,
  },
  {
    id: "7",
    kind: "text",
    title: "Rust 所有权与生命周期速查表",
    preview: "每个值在任意时刻有且只有一个所有者。当所有者离开作用域，值被丢弃。引用不可变（&T）和可变（&mut T）不能同时存在。",
    sourceApp: "VS Code",
    meta: "RS",
    timeLabel: "昨天",
    isPinned: false,
  },
  {
    id: "8",
    kind: "image",
    title: "截屏 2026-08-01 09.12.05.png",
    preview: "800×600 屏幕截图 — 设计评审会议记录",
    sourceApp: "系统截屏",
    meta: "IMG",
    timeLabel: "昨天",
    isPinned: false,
  },
  {
    id: "9",
    kind: "text",
    title: "Tauri 2.0 跨平台构建指南",
    preview: "Tauri 2.0 支持 macOS、Windows 和 Linux 的跨平台构建。本文档涵盖从开发环境搭建到生产部署的完整流程。",
    sourceApp: "Arc",
    meta: "Arc",
    timeLabel: "2 天前",
    isPinned: false,
  },
  {
    id: "10",
    kind: "text",
    title: "周报 — 2026 年第 31 周",
    preview: "本周完成：Popup 交互优化、Search 性能提升、若干 Bug 修复。下周计划：Main 批量操作、Settings 重构。",
    sourceApp: "Warp",
    meta: "Wrp",
    timeLabel: "3 天前",
    isPinned: false,
  },
];

const VARIANT_KEYS = ["B", "D", "E", "F", "G"];

const VARIANT_LABELS: Record<string, string> = {
  B: "B — Popup 磨砂卡片 · 悬浮预览",
  D: "D — 快捷控制面板 Quick Panel",
  E: "E — 主管理台 Main",
  F: "F — 设置 Settings",
  G: "G — 预览窗口 Preview",
};

function getVariantFromURL(): string {
  if (typeof window === "undefined") return "B";
  const params = new URLSearchParams(window.location.search);
  const v = params.get("variant");
  if (v && VARIANT_KEYS.includes(v)) return v;
  return "B";
}

export function PrototypeShell() {
  const [variant, setVariant] = useState(getVariantFromURL);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(MOCK_ITEMS[0].id);

  const filtered = query
    ? MOCK_ITEMS.filter((i) => i.title.toLowerCase().includes(query.toLowerCase()))
    : MOCK_ITEMS;

  const selectedItem = MOCK_ITEMS.find((i) => i.id === selectedId) ?? null;

  // Sync variant → URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", variant);
    window.history.replaceState({}, "", url.toString());
  }, [variant]);

  const cycle = useCallback(
    (dir: -1 | 1) => {
      const idx = VARIANT_KEYS.indexOf(variant);
      const next = VARIANT_KEYS[(idx + dir + VARIANT_KEYS.length) % VARIANT_KEYS.length];
      setVariant(next);
    },
    [variant],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); cycle(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); cycle(1); }
    },
    [cycle],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#1a1e24",
        fontFamily: `"Inter","SF Pro Text",ui-sans-serif,system-ui,sans-serif`,
      }}
    >
      {variant === "B" && (
        <VariantB_Card
          items={filtered}
          selectedId={selectedId}
          selectedItem={selectedItem}
          query={query}
          onQueryChange={setQuery}
          onSelect={setSelectedId}
        />
      )}
      {variant === "D" && <VariantD_QuickPanel />}
      {variant === "E" && <VariantE_Main />}
      {variant === "F" && <VariantF_Settings />}
      {variant === "G" && <VariantG_Preview />}

      <PrototypeSwitcher
        variant={variant}
        label={VARIANT_LABELS[variant]}
        keys={VARIANT_KEYS}
        onPrev={() => cycle(-1)}
        onNext={() => cycle(1)}
      />
    </div>
  );
}