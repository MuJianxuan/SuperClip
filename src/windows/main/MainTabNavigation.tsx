import { memo } from "react";
import { Star } from "lucide-react";

export type TabId = "all" | "text" | "image" | "file" | "pinned";

interface MainTabNavigationProps {
  activeTab: TabId;
  counts: Record<TabId, number>;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "text", label: "文本" },
  { id: "image", label: "图片" },
  { id: "file", label: "文件" },
  { id: "pinned", label: "置顶" },
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
    <nav className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 pt-1" aria-label="内容过滤">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isPinned = tab.id === "pinned";
        const accent = isPinned ? "#fbbf24" : "var(--selection-accent)";
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] transition-all"
            style={{
              borderColor: isActive
                ? isPinned
                  ? "rgba(251,191,36,0.35)"
                  : "rgba(56,189,248,0.3)"
                : "var(--border)",
              background: isActive
                ? isPinned
                  ? "rgba(251,191,36,0.1)"
                  : "rgba(56,189,248,0.08)"
                : "var(--surface-2)",
              color: isActive ? accent : "var(--text-tertiary)",
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {isPinned && (
              <Star
                className="h-2.5 w-2.5"
                style={{ fill: isActive ? "#fbbf24" : "none", color: isActive ? "#fbbf24" : "var(--text-tertiary)" }}
                aria-hidden="true"
              />
            )}
            {tab.label}
            <span
              className="rounded-full px-1.5 tabular-nums"
              style={{
                fontSize: 9.5,
                background: isActive
                  ? isPinned
                    ? "rgba(251,191,36,0.16)"
                    : "rgba(56,189,248,0.14)"
                  : "var(--surface)",
                color: isActive ? (isPinned ? "#fbbf24" : "var(--selection-accent)") : "var(--text-tertiary)",
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
