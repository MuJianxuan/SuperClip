import { memo, useState } from "react";
import {
  ClipboardList,
  Settings2,
  ShieldOff,
  Star,
  Trash2,
} from "lucide-react";

export type MainSectionId = "all" | "pinned" | "trash" | "rules" | "settings";

interface MainSidebarProps {
  active: MainSectionId;
  counts: {
    all: number;
    pinned: number;
    trash: number;
    rules: number;
  };
  /** 监听状态与默认动作，用于底部状态卡 */
  isMonitoring: boolean;
  defaultActionLabel: string;
  onNavigate: (section: MainSectionId) => void;
}

/**
 * Main 左侧导航栏（192px）：历史（全部记录 / 已置顶 / 回收站）+ 管理（排除规则 / 设置），
 * 底部监听状态卡。替代原顶栏 + chips 的双层结构。hover/选中一律 React state 驱动。
 */
export const MainSidebar = memo(function MainSidebar({
  active,
  counts,
  isMonitoring,
  defaultActionLabel,
  onNavigate,
}: MainSidebarProps) {
  return (
    <aside
      data-testid="main-sidebar"
      className="flex w-[192px] shrink-0 flex-col border-r px-[10px] pb-[10px] pt-[10px]"
      style={{ background: "var(--card-bg)", borderColor: "var(--divider)" }}
    >
      {/* 品牌行（拖拽区）。顶部另留 38px：原生红绿灯固定在窗口左上角 (x:20,y:20)，
          而侧栏宽 192 > 74，不避让就会压住 logo；同时这段空白继续承担拖动窗口 */}
      <div
        data-tauri-drag-region
        className="flex cursor-grab items-center gap-2 px-2 pb-2 pt-[38px] active:cursor-grabbing"
      >
        <span
          className="flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-[6px]"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          <ClipboardList size={12} />
        </span>
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">SuperClip</span>
      </div>

      <NavCaption>历史</NavCaption>
      <NavItem
        icon={<ClipboardList size={15} />}
        label="全部记录"
        tail={counts.all}
        active={active === "all"}
        onClick={() => onNavigate("all")}
      />
      <NavItem
        icon={<Star size={15} />}
        label="已置顶"
        tail={counts.pinned}
        active={active === "pinned"}
        onClick={() => onNavigate("pinned")}
      />
      <NavItem
        icon={<Trash2 size={15} />}
        label="回收站"
        tail={counts.trash}
        active={active === "trash"}
        onClick={() => onNavigate("trash")}
      />

      <NavCaption>管理</NavCaption>
      <NavItem
        icon={<ShieldOff size={15} />}
        label="排除规则"
        tail={counts.rules}
        active={active === "rules"}
        onClick={() => onNavigate("rules")}
      />
      <NavItem
        icon={<Settings2 size={15} />}
        label="设置"
        active={active === "settings"}
        onClick={() => onNavigate("settings")}
      />

      {/* 底部监听状态卡 */}
      <div
        data-testid="main-sidebar-status"
        className="mt-auto flex items-center gap-[7px] rounded-[8px] px-[9px] py-2 text-[10.5px]"
        style={{ background: "var(--card-bg)", color: "var(--text-secondary)" }}
      >
        <span
          className="h-[5px] w-[5px] shrink-0 rounded-full"
          style={{ background: isMonitoring ? "var(--success)" : "var(--warn)" }}
        />
        <span className="truncate">
          {isMonitoring ? "监听中" : "已暂停"} · {defaultActionLabel}
        </span>
      </div>
    </aside>
  );
});

function NavCaption({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-[9px] pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-tertiary)]">
      {children}
    </div>
  );
}

function NavItem({
  icon,
  label,
  tail,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tail?: number;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="mb-px flex w-full items-center gap-[9px] rounded-[8px] px-[9px] py-[7px] text-left text-[13px] transition-colors"
      style={{
        background: active ? "var(--accent-soft)" : hovered ? "var(--row-hover)" : "transparent",
        color: active || hovered ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: active ? 600 : 400,
      }}
    >
      <span
        className="shrink-0"
        style={{ color: active ? "var(--accent-text)" : "inherit" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof tail === "number" ? (
        <span className="shrink-0 tabular-nums text-[11px] text-[var(--text-tertiary)]">{tail}</span>
      ) : null}
    </button>
  );
}

