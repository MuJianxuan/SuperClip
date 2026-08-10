import { useState } from "react";
import {
  Pause,
  Play,
  ExternalLink,
  Settings2,
  LogOut,
  Monitor,
  Sun,
  Moon,
} from "lucide-react";

/* ================================================================
   Variant D — Quick Control Panel（对齐正式 src/panel/QuickPanelApp.tsx）

   Tray 右键唤出的高频控制表面（非历史列表、非完整设置）。
   固定功能：暂停/恢复监听、默认粘贴模式、主题外观、打开 Main/Settings、退出。

   相对旧版原型的改动（反向补回正式结构）：
   - 宽度 280（与 popup 统一；旧 232 已过时）
   - 去掉顶部品牌 Header + StatusChip；状态迁到底部 h-35 栏
   - 新增「外观」分组：system / light / dark（Monitor / Sun / Moon）
   - 外壳 className quick-panel-shell frost-window + CSS 变量色
   - hover 全部由 React state 驱动
   - 本地 mock：isMonitoring / pasteMode / themeMode
   ================================================================ */

type PasteMode = "direct_paste" | "copy_only";
type ThemeMode = "system" | "light" | "dark";

const PASTE_MODE_LABELS: Record<PasteMode, string> = {
  direct_paste: "直接粘贴",
  copy_only: "仅复制",
};

const PASTE_MODE_DESC: Record<PasteMode, string> = {
  direct_paste: "选中条目后自动粘贴到前台应用",
  copy_only: "仅复制到剪贴板，需手动粘贴",
};

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "跟随系统", icon: <Monitor size={13} /> },
  { value: "light", label: "浅色", icon: <Sun size={13} /> },
  { value: "dark", label: "深色", icon: <Moon size={13} /> },
];

/** 原型演示：system 用 dark 作为默认演示外观（无 systemAppearanceGet） */
function applyThemeMode(mode: ThemeMode) {
  document.documentElement.dataset.themeMode = mode === "system" ? "dark" : mode;
}

export function VariantD_QuickPanel() {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [pasteMode, setPasteMode] = useState<PasteMode>("direct_paste");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyThemeMode(mode);
  };

  return (
    <div
      className="quick-panel-shell frost-window"
      style={{
        /* 原型画布固定宽 ~280（正式窗口 280×420，铺满 100vw/100vh） */
        width: 280,
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        background: "var(--panel-bg)",
        backdropFilter: "blur(36px) saturate(1.6)",
        WebkitBackdropFilter: "blur(36px) saturate(1.6)",
        border: "1px solid var(--popup-border)",
        boxShadow: "var(--panel-shadow)",
        overflow: "hidden",
        animation: "panelPopIn 0.16s ease-out",
      }}
    >
      <div style={{ padding: "2px 10px 8px", flex: 1 }}>
        {/* Group: 监听控制 */}
        <GroupLabel text="监听" />
        <MenuButton
          icon={
            <IconBox
              bg={
                isMonitoring
                  ? "rgba(52, 211, 153, 0.1)"
                  : "rgba(251, 146, 60, 0.1)"
              }
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
        <div style={{ padding: "4px 8px 0" }}>
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
              color: "var(--panel-faint-text)",
              margin: "3px 0 0",
              lineHeight: 1.4,
              paddingLeft: 2,
            }}
          >
            {PASTE_MODE_DESC[pasteMode]}
          </p>
        </div>

        {/* Group: 外观 */}
        <Divider />
        <GroupLabel text="外观" />
        <div style={{ padding: "2px 8px 0" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {THEME_OPTIONS.map((option) => {
              const isActive = themeMode === option.value;
              return (
                <SegButton
                  key={option.value}
                  isActive={isActive}
                  icon={option.icon}
                  onClick={() => handleThemeModeChange(option.value)}
                >
                  {option.label}
                </SegButton>
              );
            })}
          </div>
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

        {/* 退出（无分组标题：底部独立项） */}
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

      {/* 底部状态栏（对齐正式 h-35 + footer-border） */}
      <div
        style={{
          height: 35,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px 2px",
          borderTop: "1px solid var(--footer-border)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
              color: isMonitoring
                ? "var(--panel-status-on-text)"
                : "var(--panel-status-off-text)",
            }}
          >
            {isMonitoring ? "监听中" : "已暂停"}
          </span>
        </span>
        <span style={{ fontSize: 10, color: "var(--panel-faint-text)" }}>
          ⎋ 关闭
        </span>
      </div>
    </div>
  );
}

/* ---------- Sub-components（与正式 QuickPanel 尺寸/间距对齐） ---------- */

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
        width: 30,
        height: 30,
        borderRadius: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg || "var(--panel-icon-bg)",
        color: color || "var(--panel-icon-text)",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function GroupLabel({ text }: { text: string }) {
  return (
    <div style={{ padding: "4px 10px 1px" }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--panel-group-label)",
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
    <div
      style={{
        height: 1,
        background: "var(--panel-divider)",
        margin: "3px 0",
      }}
    />
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
        gap: 12,
        width: "100%",
        padding: "5px 10px",
        border: "none",
        borderRadius: 9,
        background: danger
          ? hovered
            ? "rgba(239, 68, 68, 0.07)"
            : "transparent"
          : hovered
            ? "var(--panel-row-hover)"
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
            fontSize: 13,
            fontWeight: 500,
            color: danger
              ? hovered
                ? "rgba(239, 68, 68, 0.85)"
                : "rgba(239, 68, 68, 0.65)"
              : hovered
                ? "var(--panel-label-hover)"
                : "var(--panel-label)",
            display: "block",
          }}
        >
          {label}
        </span>
        {desc && (
          <span
            style={{
              fontSize: 11,
              color: "var(--panel-desc)",
              display: "block",
              marginTop: 2,
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
            color: "var(--panel-shortcut-text)",
            padding: "3px 7px",
            borderRadius: 4,
            background: "var(--panel-shortcut-bg)",
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
  icon,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
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
        padding: "6px 10px",
        borderRadius: 8,
        border: `1px solid ${
          isActive ? "rgba(56, 189, 248, 0.22)" : "var(--panel-seg-border)"
        }`,
        background: isActive
          ? "rgba(56, 189, 248, 0.08)"
          : hovered
            ? "var(--panel-seg-bg-hover)"
            : "var(--panel-seg-bg)",
        cursor: "pointer",
        textAlign: "center",
        transition: "all 0.12s ease",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          fontSize: 11.5,
          lineHeight: 1,
          fontWeight: isActive ? 600 : 400,
          color: isActive
            ? "rgba(56, 189, 248, 0.9)"
            : hovered
              ? "var(--panel-seg-text-hover)"
              : "var(--panel-seg-text)",
        }}
      >
        {icon}
        {children}
      </span>
    </button>
  );
}
