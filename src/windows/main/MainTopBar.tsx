import { memo } from "react";
import { Search, Settings2, LayoutList, LayoutGrid } from "lucide-react";
import { MainTabNavigation, type TabId } from "./MainTabNavigation";

interface MainTopBarProps {
  activeTab: TabId;
  viewMode: "list" | "grid";
  query: string;
  onTabChange: (tab: TabId) => void;
  onViewModeChange: (mode: "list" | "grid") => void;
  onQueryChange: (query: string) => void;
  onSettingsClick: () => void;
}

export const MainTopBar = memo(function MainTopBar({
  activeTab,
  viewMode,
  query,
  onTabChange,
  onViewModeChange,
  onQueryChange,
  onSettingsClick,
}: MainTopBarProps) {
  return (
    <header className="flex h-[52px] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 backdrop-blur-[20px] backdrop-saturate-[1.6]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
          <span className="text-[14px] font-bold text-[var(--accent)]">S</span>
        </div>
        <span className="text-[14px] font-semibold text-[var(--text-primary)]">SuperClip</span>
      </div>

      <MainTabNavigation activeTab={activeTab} onTabChange={onTabChange} />

      <div className="flex-1" />

      {/* View Toggle */}
      <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] p-0.5">
        <button
          type="button"
          onClick={() => onViewModeChange("list")}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            viewMode === "list"
              ? "bg-[var(--tab-active-bg)] text-[var(--text-primary)]"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <LayoutList className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("grid")}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            viewMode === "grid"
              ? "bg-[var(--tab-active-bg)] text-[var(--text-primary)]"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <label className="flex h-8 w-[240px] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 transition-colors focus-within:border-[var(--selection-accent)]">
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          placeholder="搜索..."
          className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
      </label>

      {/* Settings */}
      <button
        type="button"
        onClick={onSettingsClick}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]"
      >
        <Settings2 className="h-4 w-4" />
      </button>
    </header>
  );
});
