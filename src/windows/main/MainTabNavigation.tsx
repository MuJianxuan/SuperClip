import { memo } from "react";

export type TabId = "all" | "text" | "image" | "file";

interface MainTabNavigationProps {
  activeTab: TabId;
  counts: Record<TabId, number>;
  onTabChange: (tab: TabId) => void;
}

/* D4：左侧栏已承载「已置顶」入口，chips 只保留类型过滤（全部/文本/图片/文件） */
const tabs: { id: TabId; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "text", label: "文本" },
  { id: "image", label: "图片" },
  { id: "file", label: "文件" },
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
              {counts[tab.id]}
            </span>
          </button>
        );
      })}
    </nav>
  );
});
