import { useCallback, useEffect, useState } from "react";
import { Pause, Play, ExternalLink, Settings2, LogOut, Monitor } from "lucide-react";
import {
  appQuit,
  monitorStatusGet,
  monitorToggle,
  quickPanelHide,
  settingsGet,
  settingsUpdate,
  showMain,
  systemAppearanceGet,
  type SettingsResponse,
} from "../lib/superclip";

/* ================================================================
   Quick Control Panel (D2) — Tray 右键唤起的 232px 高频控制面板

   固定功能：暂停/恢复监听、默认粘贴模式、打开 Main/Settings、退出。
   交互铁律：hover/选中一律由 React state 驱动，禁止直接改 DOM style。
   ================================================================ */

type PasteMode = SettingsResponse["defaultAction"];

const PASTE_MODE_LABELS: Record<PasteMode, string> = {
  direct_paste: "直接粘贴",
  copy_only: "仅复制",
};

const PASTE_MODE_DESC: Record<PasteMode, string> = {
  direct_paste: "选中条目后自动粘贴到前台应用",
  copy_only: "仅复制到剪贴板，需手动粘贴",
};

/** 三模式主题同步：浅/深/跟随系统。panel 窗口不能用 matchMedia 推断 system 模式——
 * WKWebView 的 prefers-color-scheme 在窗口被 Rust 侧 setAppearance 锁定后停止跟随
 * 系统外观（Sky.app #37/#60），会造成前端主题与磨砂背景错配。改由 Rust 提供有效外观：
 * 挂载/变更时经 systemAppearanceGet 取解析值，运行中订阅 panel-appearance-changed。 */
function applyThemeMode(mode: string) {
  const root = document.documentElement;
  if (mode !== "system") {
    root.dataset.themeMode = mode;
    return;
  }
  void systemAppearanceGet()
    .then((appearance) => {
      if (appearance === "dark" || appearance === "light") {
        root.dataset.themeMode = appearance;
      }
    })
    .catch(() => {
      root.dataset.themeMode = "light";
    });
}

export function QuickPanelApp() {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [pasteMode, setPasteMode] = useState<PasteMode>("direct_paste");

  // 初始状态：监听状态 + 默认粘贴模式
  useEffect(() => {
    let disposed = false;
    Promise.all([monitorStatusGet(), settingsGet()])
      .then(([monitor, settings]) => {
        if (disposed) return;
        setIsMonitoring(monitor.isMonitoring);
        setPasteMode(settings.defaultAction);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);

  // 实时监听全局监听状态变化（暂停/恢复来自其他入口时同步）
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | null = null;
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<{ is_monitoring: boolean }>("monitor-status-changed", (event) => {
          if (!disposed) {
            setIsMonitoring(event.payload.is_monitoring);
          }
        }),
      )
      .then((fn) => {
        if (disposed) void fn();
        else unlisten = fn;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // 三模式主题同步 + 默认粘贴模式实时联动（监听 settings-updated / panel-appearance-changed）
  useEffect(() => {
    settingsGet().then((s) => {
      applyThemeMode(s?.themeMode ?? "system");
      setPasteMode(s?.defaultAction ?? "direct_paste");
    }).catch(() => applyThemeMode("system"));

    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: Array<() => void> = [];
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        Promise.all([
          listen<{ theme_mode?: string; default_action?: PasteMode }>(
            "settings-updated",
            (event) => {
              if (disposed) return;
              if (event.payload.theme_mode) applyThemeMode(event.payload.theme_mode);
              if (event.payload.default_action) setPasteMode(event.payload.default_action);
            },
          ),
          listen<{ appearance?: string }>("panel-appearance-changed", (event) => {
            if (disposed) return;
            const appearance = event.payload.appearance;
            if (appearance === "dark" || appearance === "light") {
              document.documentElement.dataset.themeMode = appearance;
            }
          }),
        ]),
      )
      .then((fns) => {
        if (disposed) fns.forEach((f) => void f());
        else unlisten = fns;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten.forEach((f) => f());
    };
  }, []);

  // Escape 关闭面板
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        void quickPanelHide();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToggleMonitoring = useCallback(() => {
    void monitorToggle(!isMonitoring).then((next) => setIsMonitoring(next.isMonitoring)).catch(() => {});
  }, [isMonitoring]);

  const handlePasteModeChange = useCallback((mode: PasteMode) => {
    setPasteMode(mode);
    void settingsUpdate({ defaultAction: mode }).catch(() => {});
  }, []);

  const handleOpenMain = useCallback(() => {
    void showMain().catch(() => {});
  }, []);

  const handleOpenSettings = useCallback(() => {
    void showMain().catch(() => {});
    void import("@tauri-apps/api/event")
      .then(({ emit }) => emit("app:show-settings", { source: "quick_panel" }))
      .catch(() => {});
  }, []);

  const handleQuit = useCallback(() => {
    void appQuit().catch(() => {});
  }, []);

  return (
    <div
      className="quick-panel-shell frost-window"
      style={{
        /* 铺满整个窗口（对齐 popup 的 h-screen w-screen 模式）：
           内容高度与窗口 232x380 一致，任何亚像素差异都由本层覆盖，
           不露出未填充区域 */
        width: "100vw",
        height: "100vh",
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
      {/* Header: brand + monitoring status */}
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Monitor size={13} color="var(--panel-icon-faint)" />
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--text-secondary)",
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
          onClick={handleToggleMonitoring}
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
                  onClick={() => handlePasteModeChange(mode)}
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
          onClick={handleOpenMain}
        />
        <MenuButton
          icon={<IconBox>{<Settings2 size={13} />}</IconBox>}
          label="设置"
          shortcut="⌘,"
          onClick={handleOpenSettings}
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
          onClick={handleQuit}
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
          color: isMonitoring ? "var(--panel-status-on-text)" : "var(--panel-status-off-text)",
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
    <div style={{ padding: "7px 8px 3px" }}>
      <span
        style={{
          fontSize: 9.5,
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
        margin: "5px 0",
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
            fontSize: 12.5,
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
              fontSize: 10.5,
              color: "var(--panel-desc)",
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
            color: "var(--panel-shortcut-text)",
            padding: "2px 6px",
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
        {children}
      </span>
    </button>
  );
}
