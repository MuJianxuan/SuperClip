import { memo, useState } from "react";
import { Copy, Grid3X3, List, Search, Settings2, X } from "lucide-react";

interface MainTopBarProps {
  viewMode: "list" | "grid";
  query: string;
  onViewModeChange: (mode: "list" | "grid") => void;
  onQueryChange: (query: string) => void;
  onSettingsClick: () => void;
}

/** E2 单行工具条：identity + 主导搜索 + 视图分段 + 设置。hover/focus 均由 React state 驱动。 */
export const MainTopBar = memo(function MainTopBar({
  viewMode,
  query,
  onViewModeChange,
  onQueryChange,
  onSettingsClick,
}: MainTopBarProps) {
  const [searchHovered, setSearchHovered] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [settingsHovered, setSettingsHovered] = useState(false);

  const searchActive = searchFocused || searchHovered;

  return (
    <header className="flex items-center gap-3 px-4 pb-2.5 pt-3.5">
      {/* identity */}
      <div className="flex shrink-0 items-center gap-2">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[rgba(56,189,248,0.35)] to-[rgba(167,139,250,0.25)] shadow-[0_0_12px_rgba(56,189,248,0.2)]"
          aria-hidden="true"
        >
          <Copy className="h-3 w-3 text-white/85" />
        </div>
        <span className="text-[13px] font-semibold text-[var(--text-secondary)]">剪贴板</span>
      </div>

      {/* dominant search */}
      <label
        className="flex min-w-0 flex-1 items-center gap-2 rounded-[11px] border bg-[var(--surface)] px-3 py-[7px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-[border-color,box-shadow] duration-150"
        style={{
          borderColor: searchActive ? "rgba(56,189,248,0.25)" : "var(--search-border, var(--border))",
        }}
        onMouseEnter={() => setSearchHovered(true)}
        onMouseLeave={() => setSearchHovered(false)}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--search-icon, var(--text-tertiary))]" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          placeholder="搜索剪贴板..."
          className="w-full min-w-0 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
        {query && (
          <button
            type="button"
            title="清空"
            onClick={() => onQueryChange("")}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </label>

      {/* view toggle */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-[9px] bg-[var(--toggle-bg,var(--surface-2))] p-0.5">
        <ViewButton active={viewMode === "list"} onClick={() => onViewModeChange("list")} title="列表视图">
          <List className="h-[13px] w-[13px]" />
        </ViewButton>
        <ViewButton active={viewMode === "grid"} onClick={() => onViewModeChange("grid")} title="网格视图">
          <Grid3X3 className="h-[13px] w-[13px]" />
        </ViewButton>
      </div>

      {/* settings */}
      <button
        type="button"
        title="设置"
        onClick={onSettingsClick}
        onMouseEnter={() => setSettingsHovered(true)}
        onMouseLeave={() => setSettingsHovered(false)}
        className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[9px] border transition-all"
        style={{
          borderColor: settingsHovered ? "rgba(56,189,248,0.3)" : "var(--border)",
          background: settingsHovered ? "rgba(56,189,248,0.06)" : "var(--surface-2)",
          color: settingsHovered ? "rgba(56,189,248,0.6)" : "var(--text-tertiary)",
        }}
      >
        <Settings2 className="h-[13px] w-[13px]" />
      </button>
    </header>
  );
});

function ViewButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex h-[21px] w-[25px] items-center justify-center rounded-[7px] transition-colors"
      style={{
        background: active ? "var(--tab-active-bg)" : "transparent",
        color: active ? "var(--seg-active-text, var(--text-primary))" : hovered ? "var(--text-secondary)" : "var(--seg-text, var(--text-tertiary))",
      }}
    >
      {children}
    </button>
  );
}
