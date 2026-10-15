import { memo, useState } from "react";
import { Grid3X3, List, Search, X } from "lucide-react";

interface MainTopBarProps {
  viewMode: "list" | "grid";
  query: string;
  /** 当前视图标题（侧栏切换「全部记录 / 已置顶」时联动） */
  title?: string;
  onViewModeChange: (mode: "list" | "grid") => void;
  onQueryChange: (query: string) => void;
}

/**
 * 内容区标题栏（D3）：标题 + 副标题 + 搜索 + 视图分段。
 * 设置入口移到左侧栏；主窗口拖拽区由本顶栏（含标题区）与左侧栏顶部 44px 拖拽条承担。
 * 拖拽属性必须写在鼠标下的元素上：内容区顶栏只有自身内边距带可拖，标题容器与标题也要带（tauri 2.10.3 不支持 "deep" 子树匹配）。
 */
export const MainTopBar = memo(function MainTopBar({
  viewMode,
  query,
  title,
  onViewModeChange,
  onQueryChange,
}: MainTopBarProps) {
  const [searchHovered, setSearchHovered] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const searchActive = searchFocused || searchHovered;

  return (
    <header data-tauri-drag-region className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-4">
      <div data-tauri-drag-region className="min-w-0 flex-1">
        <h1
          data-tauri-drag-region
          className="truncate text-[18px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]"
        >
          {title ?? (viewMode === "grid" ? "网格视图" : "全部记录")}
        </h1>
      </div>

      {/* 搜索框（固定宽，与设计稿的 196px 一致） */}
      <label
        className="flex w-[196px] shrink-0 items-center gap-[7px] rounded-[9px] border px-[10px] py-[7px] transition-[border-color,background-color] duration-150"
        style={{
          borderColor: searchActive ? "var(--accent)" : "transparent",
          background: searchActive ? "var(--accent-soft)" : "var(--card-bg)",
        }}
        onMouseEnter={() => setSearchHovered(true)}
        onMouseLeave={() => setSearchHovered(false)}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
      >
        <Search className="h-[13px] w-[13px] shrink-0 text-[var(--text-tertiary)]" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          placeholder="搜索…"
          aria-label="搜索剪贴板"
          className="w-full min-w-0 bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
        {query ? (
          <button
            type="button"
            title="清空"
            aria-label="清空"
            onClick={() => onQueryChange("")}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        ) : null}
      </label>

      {/* 视图分段（选中态强调色填充，与设计稿 .seg .on 一致） */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-[8px] bg-[var(--card-bg)] p-0.5">
        <ViewButton active={viewMode === "list"} onClick={() => onViewModeChange("list")} title="列表视图">
          <List className="h-[13px] w-[13px]" />
        </ViewButton>
        <ViewButton active={viewMode === "grid"} onClick={() => onViewModeChange("grid")} title="网格视图">
          <Grid3X3 className="h-[13px] w-[13px]" />
        </ViewButton>
      </div>
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
      className="flex h-[24px] w-[28px] items-center justify-center rounded-[7px] transition-colors"
      style={{
        background: active ? "var(--accent)" : hovered ? "var(--row-hover)" : "transparent",
        color: active
          ? "var(--accent-contrast)"
          : hovered
            ? "var(--text-primary)"
            : "var(--seg-text, var(--text-tertiary))",
      }}
    >
      {children}
    </button>
  );
}
