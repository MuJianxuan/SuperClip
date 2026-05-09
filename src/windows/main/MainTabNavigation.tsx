import { memo } from "react";

export type TabId = "all" | "text" | "image" | "file" | "pinned";

interface MainTabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "text", label: "文本" },
  { id: "image", label: "图片" },
  { id: "file", label: "文件" },
  { id: "pinned", label: "置顶" },
];

export const MainTabNavigation = memo(function MainTabNavigation({
  activeTab,
  onTabChange,
}: MainTabNavigationProps) {
  return (
    <nav className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-2)] p-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`relative rounded-md px-3 py-1.5 text-[13px] font-medium transition-all ${
            activeTab === tab.id
              ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
});
