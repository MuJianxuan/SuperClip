import { useCallback, useEffect, useState } from "react";
import { Pause, Play, ExternalLink, Settings2, LogOut, Monitor, Sun, Moon } from "lucide-react";
import {
  appQuit,
  monitorStatusGet,
  monitorToggle,
  quickPanelHide,
  quickPanelReady,
  settingsGet,
  settingsUpdate,
  showMain,
  systemAppearanceGet,
  type SettingsResponse,
} from "../lib/superclip";

/* ================================================================
   Quick Control Panel (D2) — Tray 右键唤起的 300px 高频控制面板（与 popup 统一尺寸）

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

type ThemeMode = SettingsResponse["themeMode"];

/** 主题快捷切换选项：与 settings-shell 的 ThemeSegButton 同语言（图标 + 文字） */
const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "跟随系统", icon: <Monitor size={13} /> },
  { value: "light", label: "浅色", icon: <Sun size={13} /> },
  { value: "dark", label: "深色", icon: <Moon size={13} /> },
];

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
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  // 初始状态：监听状态 + 默认粘贴模式
  useEffect(() => {
    let disposed = false;
    Promise.all([monitorStatusGet(), settingsGet()])
      .then(([monitor, settings]) => {
        if (disposed) return;
        setIsMonitoring(monitor.isMonitoring);
        setPasteMode(settings.defaultAction);
        setThemeMode(settings.themeMode ?? "system");
      })
      .catch(() => {})
      .finally(() => {
        // 内容就绪信号：数据加载完成（或失败降级）后 + 首帧绘制（双 rAF），
        // 通知 Rust 侧可安全显示，避免首次打开时「空白→内容突然出现」的闪屏
        if (disposed) return;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!disposed) quickPanelReady().catch(() => {});
          });
        });
      });
    return () => {
      disposed = true;
    };
  }, []);

  // 兜底：数据加载异常（如恢复模式）时 2.5s 后仍放行（就绪信号是体验优化，不能阻塞面板显示）
  useEffect(() => {
    const t = window.setTimeout(() => {
      quickPanelReady().catch(() => {});
    }, 2500);
    return () => window.clearTimeout(t);
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
      setThemeMode(s?.themeMode ?? "system");
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
              if (event.payload.theme_mode) {
                applyThemeMode(event.payload.theme_mode);
                setThemeMode(event.payload.theme_mode as ThemeMode);
              }
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

  const handleThemeModeChange = useCallback((mode: ThemeMode) => {
    // 本地立即生效（不等 settings-updated 广播回环），后端持久化后广播给其他窗口
    setThemeMode(mode);
    applyThemeMode(mode);
    void settingsUpdate({ themeMode: mode }).catch(() => {});
  }, []);

  const handleOpenMain = useCallback(() => {
    void showMain().catch(() => {});
    // 与 handleOpenSettings 的 app:show-settings 对称：主窗口可能停留在设置分区，
    // 显式通知切回主页视图，避免 showMain 只显示窗口而停留在设置页
    void import("@tauri-apps/api/event")
      .then(({ emit }) => emit("app:show-home", { source: "quick_panel" }))
      .catch(() => {});
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
           内容高度与窗口 280x420 一致，任何亚像素差异都由本层覆盖，
           不露出未填充区域 */
        width: "100vw",
        height: "100vh",
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
          onClick={handleToggleMonitoring}
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
              margin: "3px 0 0",
              lineHeight: 1.4,
              paddingLeft: 2,
            }}
          >
            {PASTE_MODE_DESC[pasteMode]}
          </p>
        </div>

        {/* Group: 外观（主题快捷切换；settings-updated 广播后 Main/popup/preview 实时同步） */}
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
          onClick={handleOpenMain}
        />
        <MenuButton
          icon={<IconBox>{<Settings2 size={13} />}</IconBox>}
          label="设置"
          shortcut="⌘,"
          onClick={handleOpenSettings}
        />

        {/* 退出（无分组标题：底部独立项，Divider 隔离——macOS 菜单惯例，为面板内容高度腾出余量） */}
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

      {/* 底部状态栏（popup 底部栏同尺寸同风格：h-35 + footer-border 分隔线） */}
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

/* ---------- Sub-components ---------- */

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
