import { memo } from "react";

export type TabId = "all" | "text" | "rich" | "image" | "file" | "link" | "other";

interface MainTabNavigationProps {
  activeTab: TabId;
  counts: Record<TabId, number>;
  onTabChange: (tab: TabId) => void;
}

/* D4：左侧栏已承载「已置顶」入口，chips 只保留类型过滤；
   富文本把 html+rtf 合并为一个 chip，行内仍显示精确标签（HTML/RTF）。
   链接/其他仅在有记录时出现（否则多数用户看到空 chip 只会困惑）。 */
const baseTabs: { id: TabId; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "text", label: "文本" },
  { id: "rich", label: "富文本" },
  { id: "image", label: "图片" },
  { id: "file", label: "文件" },
];

const conditionalTabs: { id: TabId; label: string }[] = [
  { id: "link", label: "链接" },
  { id: "other", label: "其他" },
];

/**
 * E2 过滤 chips：药丸形 + 计数徽标；置顶 chip 用琥珀强调，其余选中态为蓝底蓝边。
 * 计数基于当前数据集的分布（MainApp 计算传入）。
 */
export const MainTabNavigation = memo(function MainTabNavigation({
  activeTab,
  counts,
  onTabChange,
}: MainTabNavigationProps) {
  const tabs = [
    ...baseTabs,
    // 条件 chip：有记录才显示；若当前正停在该 tab（记录被删到 0），仍保留以免过滤器无法切回
    ...conditionalTabs.filter((tab) => (counts[tab.id] ?? 0) > 0 || activeTab === tab.id),
  ];

  return (
    <nav className="flex shrink-0 items-center gap-1.5 px-5 pb-3" aria-label="内容过滤">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const accent = "var(--accent-text)";
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-[5px] text-[11.5px] transition-all"
            style={{
              borderColor: isActive
                ? "color-mix(in srgb, var(--accent) 35%, transparent)"
                : "var(--border)",
              background: isActive ? "var(--accent-soft)" : "var(--chip-bg, transparent)",
              color: isActive ? accent : "var(--chip-text, var(--text-tertiary))",
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {tab.label}
            <span
              className="rounded-full px-[5px] tabular-nums"
              style={{
                fontSize: 9.5,
                background: isActive ? "var(--chip-badge-active-bg, rgba(255,255,255,0.1))" : "var(--chip-badge-bg, var(--surface-2))",
                color: isActive ? "var(--chip-badge-active-text, var(--text-secondary))" : "var(--chip-badge-text, var(--text-tertiary))",
              }}
            >
              {counts[tab.id] ?? 0}
            </span>
          </button>
        );
      })}
    </nav>
  );
});
