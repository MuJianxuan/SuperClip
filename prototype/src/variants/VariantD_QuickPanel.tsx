import { useState } from "react";
import { Pause, Play, ExternalLink, Settings2, LogOut, Monitor } from "lucide-react";

/* ================================================================
   Variant D2 — Quick Control Panel (快捷控制面板 · 重设计)

   Tray 右键唤出的高频控制表面（非历史列表、非完整设置）。
   固定功能：暂停/恢复监听、默认粘贴模式、打开 Main/Settings、退出。

   相对旧版 D 的改动：
   - hover 全部由 React state 驱动，移除直接操作 DOM style
     （旧实现 onMouseLeave 恢复 transparent 会与 React 冲突产生变白）
   - 暂停/恢复图标语义修正：监听中 = 播放可"暂停"；已暂停 = 恢复
   - Header 压扁 + 右侧实时状态点（绿=监听中 / 橘=已暂停）
   - 面板弹出动画 panelPopIn（与 B/E 一致进入语言）
   - 粘贴模式分段控件对齐 Main 的选中态语言
   - 危险操作（退出）hover 红底
   ================================================================ */

type PasteMode = "direct_paste" | "copy_only";

const PASTE_MODE_LABELS: Record<PasteMode, string> = {
  direct_paste: "直接粘贴",
  copy_only: "仅复制",
};

const PASTE_MODE_DESC: Record<PasteMode, string> = {
  direct_paste: "选中条目后自动粘贴到前台应用",
  copy_only: "仅复制到剪贴板，需手动粘贴",
};

export function VariantD_QuickPanel() {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [pasteMode, setPasteMode] = useState<PasteMode>("direct_paste");

  return (
    <div
      style={{
        width: 232,
        borderRadius: 12,
        background: "rgba(18, 23, 30, 0.82)",
        backdropFilter: "blur(36px) saturate(1.6)",
        WebkitBackdropFilter: "blur(36px) saturate(1.6)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.04)",
        overflow: "hidden",
        animation: "panelPopIn 0.16s ease-out",
      }}
    >
      {/* --- Header: brand + monitoring status --- */}
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Monitor size={13} color="rgba(255,255,255,0.25)" />
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: "-0.01em",
            }}
          >
            SuperClip
          </span>
        </div>
        <StatusChip isMonitoring={isMonitoring} />
      </div>

      <div style={{ padding: "2px 6px 6px" }}>
        {/* Group: 监听控制 */}
        <GroupLabel text="监听" />
        <MenuButton
          icon={
            <IconBox
              bg={isMonitoring ? "rgba(52, 211, 153, 0.1)" : "rgba(251, 146, 60, 0.1)"}
              color={isMonitoring ? "#34d399" : "#fb923c"}
            >
              {isMonitoring ? <Pause size={13} /> : <Play size={13} />}
            </IconBox>
          }
          label={isMonitoring ? "暂停监听" : "恢复监听"}
          desc={isMonitoring ? "停止记录新内容" : "重新开始记录剪贴板"}
          onClick={() => setIsMonitoring(!isMonitoring)}
        />

        {/* Group: 粘贴行为 */}
        <Divider />
        <GroupLabel text="粘贴模式" />
        <div style={{ padding: "2px 8px 0" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(["direct_paste", "copy_only"] as PasteMode[]).map((mode) => {
              const isActive = pasteMode === mode;
              return (
                <SegButton
                  key={mode}
                  isActive={isActive}
                  onClick={() => setPasteMode(mode)}
                >
                  {PASTE_MODE_LABELS[mode]}
                </SegButton>
              );
            })}
          </div>
          <p
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.18)",
              margin: "5px 0 0",
              lineHeight: 1.4,
              paddingLeft: 2,
            }}
          >
            {PASTE_MODE_DESC[pasteMode]}
          </p>
        </div>

        {/* Group: 导航 */}
        <Divider />

        <GroupLabel text="打开" />
        <MenuButton
          icon={<IconBox>{<ExternalLink size={13} />}</IconBox>}
          label="主管理台"
          shortcut="⌘M"
        />
        <MenuButton
          icon={<IconBox>{<Settings2 size={13} />}</IconBox>}
          label="设置"
          shortcut="⌘,"
        />

        {/* Group: 退出 */}
        <Divider />

        <MenuButton
          icon={
            <IconBox bg="rgba(239, 68, 68, 0.08)" color="rgba(239, 68, 68, 0.55)">
              <LogOut size={13} />
            </IconBox>
          }
          label="退出 SuperClip"
          shortcut="⌘Q"
          danger
        />
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function StatusChip({ isMonitoring }: { isMonitoring: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 100,
        background: isMonitoring
          ? "rgba(52, 211, 153, 0.08)"
          : "rgba(251, 146, 60, 0.08)",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: isMonitoring ? "#34d399" : "#fb923c",
          boxShadow: isMonitoring
            ? "0 0 6px rgba(52,211,153,0.5)"
            : "0 0 6px rgba(251,146,60,0.5)",
        }}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: isMonitoring ? "rgba(52,211,153,0.75)" : "rgba(251,146,60,0.75)",
        }}
      >
        {isMonitoring ? "监听中" : "已暂停"}
      </span>
    </div>
  );
}

function IconBox({
  bg,
  color,
  children,
}: {
  bg?: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg || "rgba(255,255,255,0.04)",
        color: color || "rgba(255,255,255,0.35)",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function GroupLabel({ text }: { text: string }) {
  return (
    <div style={{ padding: "7px 8px 3px" }}>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 600,
          color: "rgba(255,255,255,0.15)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div style={{ height: 1, background: "rgba(255,255,255,0.035)", margin: "5px 0" }} />
  );
}

function MenuButton({
  icon,
  label,
  desc,
  shortcut,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  shortcut?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "7px 8px",
        border: "none",
        borderRadius: 8,
        background: danger
          ? hovered
            ? "rgba(239, 68, 68, 0.07)"
            : "transparent"
          : hovered
            ? "rgba(255,255,255,0.035)"
            : "transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.1s ease",
      }}
    >
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: danger
              ? hovered
                ? "rgba(239, 68, 68, 0.85)"
                : "rgba(239, 68, 68, 0.65)"
              : hovered
                ? "rgba(255,255,255,0.85)"
                : "rgba(255,255,255,0.65)",
            display: "block",
          }}
        >
          {label}
        </span>
        {desc && (
          <span
            style={{
              fontSize: 10.5,
              color: "rgba(255,255,255,0.22)",
              display: "block",
              marginTop: 1,
            }}
          >
            {desc}
          </span>
        )}
      </div>
      {shortcut && (
        <span
          style={{
            fontSize: 9.5,
            color: "rgba(255,255,255,0.2)",
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(255,255,255,0.03)",
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}

function SegButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        padding: "6px 8px",
        borderRadius: 8,
        border: `1px solid ${
          isActive ? "rgba(56, 189, 248, 0.22)" : "rgba(255,255,255,0.04)"
        }`,
        background: isActive
          ? "rgba(56, 189, 248, 0.08)"
          : hovered
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.02)",
        cursor: "pointer",
        textAlign: "center",
        transition: "all 0.12s ease",
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          fontWeight: isActive ? 600 : 400,
          color: isActive
            ? "rgba(56, 189, 248, 0.9)"
            : hovered
              ? "rgba(255,255,255,0.6)"
              : "rgba(255,255,255,0.35)",
        }}
      >
        {children}
      </span>
    </button>
  );
}