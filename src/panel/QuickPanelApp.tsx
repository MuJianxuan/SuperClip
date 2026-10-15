import { useCallback, useEffect, useState } from "react";
import { Pause, Play, ExternalLink, Settings2, LogOut } from "lucide-react";
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
   Quick Control Panel (D8) — Tray 右键唤起的 248×400 高频控制面板

   固定功能：暂停/恢复监听、默认粘贴模式、打开 Main/Settings、退出。
   外观主题改由 Main → 设置 → 通用 承载（本面板不再放主题切换，避免底部溢出与职责重叠）。
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
           内容高度与窗口 248x400 一致，任何亚像素差异都由本层覆盖，
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
      {/* 头部：状态胶囊（监听中 = 实心点；暂停 = 描边胶囊） */}
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2.5 pt-3">
        <span
          data-testid="panel-status-pill"
          data-paused={!isMonitoring || undefined}
          className="ml-auto inline-flex h-[19px] items-center gap-[5px] rounded-[10px] px-2 text-[10.5px]"
          style={{
            background: isMonitoring ? "var(--bg-elevated, var(--surface-2))" : "transparent",
            border: isMonitoring ? "1px solid transparent" : "1px solid var(--border-strong)",
            color: "var(--text-secondary)",
          }}
        >
          <span
            style={{
              width: isMonitoring ? 5 : 6,
              height: isMonitoring ? 5 : 6,
              borderRadius: "50%",
              background: isMonitoring ? "var(--success)" : "transparent",
              border: isMonitoring ? "none" : "1.5px solid var(--text-tertiary)",
            }}
          />
          {isMonitoring ? "监听中" : "已暂停"}
        </span>
      </div>

      <div className="h-px shrink-0" style={{ background: "var(--divider)" }} />

      {/* 操作区（内容精确排布到 400 高，底部不再裁切） */}
      <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-2 pt-1">
        <MenuButton
          icon={
            <IconBox
              bg={
                isMonitoring
                  ? "color-mix(in srgb, var(--success) 10%, transparent)"
                  : "color-mix(in srgb, var(--accent) 12%, transparent)"
              }
              color={isMonitoring ? "var(--success)" : "var(--accent-text)"}
            >
              {isMonitoring ? <Pause size={13} /> : <Play size={13} />}
            </IconBox>
          }
          label={isMonitoring ? "暂停监听" : "恢复监听"}
          desc={isMonitoring ? "停止记录新内容" : "继续记录复制内容"}
          highlight={!isMonitoring}
          onClick={handleToggleMonitoring}
        />

        <div className="h-px" style={{ background: "var(--divider)" }} />

        <MenuButton
          icon={<IconBox>{<ExternalLink size={13} />}</IconBox>}
          label="打开主管理台"
          desc="浏览、搜索与批量整理"
          shortcut="⌘M"
          onClick={handleOpenMain}
        />
        <MenuButton
          icon={<IconBox>{<Settings2 size={13} />}</IconBox>}
          label="设置"
          desc="快捷键、排除规则与外观"
          shortcut="⌘,"
          onClick={handleOpenSettings}
        />

        <div className="h-px" style={{ background: "var(--divider)" }} />

        {/* 默认动作分段（一行说明跟随） */}
        <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--panel-group-label)" }}>
          默认动作
        </div>
        <div className="flex gap-1 px-2">
          {(["direct_paste", "copy_only"] as PasteMode[]).map((mode) => (
            <SegButton
              key={mode}
              isActive={pasteMode === mode}
              onClick={() => handlePasteModeChange(mode)}
            >
              {PASTE_MODE_LABELS[mode]}
            </SegButton>
          ))}
        </div>
        <p
          className="px-2 pb-1 pt-1.5 text-[10px] leading-[1.4]"
          style={{ color: "var(--panel-faint-text)" }}
        >
          {PASTE_MODE_DESC[pasteMode]}
        </p>

        {/* 暂停态补充说明（只在暂停时出现，对齐设计稿的暂停态文案） */}
        {!isMonitoring ? (
          <p
            data-testid="panel-paused-note"
            className="mx-2 mt-1 rounded-[8px] px-2.5 py-2 text-[10px] leading-[1.5]"
            style={{
              background: "var(--bg-elevated, var(--panel-icon-bg))",
              color: "var(--panel-faint-text)",
            }}
          >
            暂停期间复制的内容不会被记录，已有历史不受影响。
          </p>
        ) : null}

        {/* 退出（红色语义色，独立底部） */}
        <div className="mt-auto">
          <div className="h-px" style={{ background: "var(--divider)" }} />
          <MenuButton
            icon={
              <IconBox bg="color-mix(in srgb, var(--danger) 8%, transparent)" color="color-mix(in srgb, var(--danger) 55%, transparent)">
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

function MenuButton({
  icon,
  label,
  desc,
  shortcut,
  danger,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  shortcut?: string;
  danger?: boolean;
  /** 需要引导注意的项（如暂停态的「恢复监听」）用浅底高亮 */
  highlight?: boolean;
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
            ? "color-mix(in srgb, var(--danger) 7%, transparent)"
            : "transparent"
          : hovered
            ? "var(--panel-row-hover)"
            : highlight
              ? "var(--bg-elevated, var(--panel-icon-bg))"
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
                ? "color-mix(in srgb, var(--danger) 85%, transparent)"
                : "color-mix(in srgb, var(--danger) 65%, transparent)"
              : highlight
                ? "var(--accent-text)"
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
          isActive ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "var(--panel-seg-border)"
        }`,
        background: isActive
          ? "var(--accent-soft)"
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
            ? "var(--accent-text)"
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
