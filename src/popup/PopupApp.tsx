import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search, X } from "lucide-react";
import { useClipboardData } from "../hooks/useClipboardData";
import { useHoverPreview } from "../hooks/useHoverPreview";
import { PopupContextMenu, PopupHistoryRow } from "./PopupHistoryRow";
import { Toast, type ToastState } from "../components/toast";
import { groupOf, TIME_GROUP_LABELS, TIME_GROUP_ORDER } from "../lib/time-group";
import {
  clipboardCopy,
  clipboardDelete,
  clipboardPaste,
  clipboardPin,
  clipboardRestore,
  clipboardUnpin,
  popupReady,
  previewMouseState,
  previewShow,
  previewHide,
  settingsGet,
  shortcutGet,
  systemAppearanceGet,
  describeActionError,
  type SettingsResponse,
} from "../lib/superclip";
import type { ClipboardItem } from "../components/history-row";

/** Popup 面板宽度（与 Rust 侧 popup panel 的 inner_size 320 保持一致） */
const POPUP_WIDTH = 320;
/** 预览浮窗统一尺寸（与 Rust 侧 preview panel 320×360 一致，文本/图片同高避免尺寸跳变） */
const PREVIEW_WIDTH = 320;
const PREVIEW_HEIGHT = 360;
/** 基础行高（13px 字体时）；行高随列表字体大小联动：每 ±1px 字体 → ±2px 行高 */
const ROW_HEIGHT_BASE_PX = 46;
/** 分组标题高度（「今天 / 昨天 / 更早」） */
const GROUP_HEADER_HEIGHT_PX = 24;
/** 可视区上下额外渲染行数 */
const OVERSCAN_ROWS = 6;
export { OVERSCAN_ROWS };
/** 浏览列表上限：popup 小窗只取最近 N 条（首屏快速就绪），搜索不受限 */
const POPUP_LIST_LIMIT = 200;

/** 三模式主题同步：浅/深/跟随系统。panel 窗口不能用 matchMedia 推断 system 模式——
 * WKWebView 的 prefers-color-scheme 在窗口被 Rust 侧 setAppearance 锁定后停止跟随
 * 系统外观（Sky.app #37/#60），会造成前端主题与磨砂背景错配。改由 Rust 提供有效外观：
 * 挂载/变更时经 systemAppearanceGet 取解析值，运行中订阅 panel-appearance-changed。 */
/** 列表字体大小 → 行高联动（与 ROW_HEIGHT_BASE_PX 注释一致），供虚拟滚动精确计算 */
function rowHeightForFontSize(fontSize: number): number {
  return ROW_HEIGHT_BASE_PX + (fontSize - 13) * 2;
}

/** 把列表字体大小同步为全局 CSS 变量（popup/main 列表共用同一变量渲染） */
function applyListFontSize(size: number) {
  document.documentElement.style.setProperty("--list-font-size", `${size}px`);
}

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

/**
 * 快捷键徽标字形：把 Rust 绑定串（如 Cmd+Shift+V）转成原型一致的 ⌘⇧V 徽标。
 * 保持实际绑定联动，仅做展示层转换。
 */
function formatShortcutGlyph(binding: string): string {
  if (!binding) return "";
  const glyph: Record<string, string> = {
    Cmd: "⌘",
    Command: "⌘",
    Shift: "⇧",
    Option: "⌥",
    Alt: "⌥",
    Ctrl: "⌃",
    Control: "⌃",
    Caps: "⇪",
    Return: "⏎",
    Enter: "⏎",
    Tab: "⇥",
    Space: "␣",
    Escape: "⎋",
    Esc: "⎋",
    Delete: "⌫",
    Backspace: "⌫",
  };
  return binding
    .split("+")
    .map((part) => {
      const p = part.trim();
      return glyph[p] ?? (p.length === 1 ? p.toUpperCase() : p);
    })
    .join("");
}

interface RenderedRow {
  item: ClipboardItem;
  /** 该行在虚拟滚动坐标系里的顶部偏移 */
  top: number;
}

interface RenderedHeader {
  group: string;
  top: number;
}

/** 分组 + 行高统一布局：返回渲染窗口、行/组头偏移与总高度（导出供虚拟滚动回归测试） */
export function buildLayout(items: ClipboardItem[], rowHeight: number, scrollTop: number, viewportH: number) {
  const entries: Array<{ type: "header"; group: string; top: number } | { type: "row"; item: ClipboardItem; top: number }> = [];
  let offset = 0;

  // 按组顺序重排后再布局：置顶项与按时间分组的项会交错（后端按 is_pinned DESC 排序），
  // 若按输入顺序「组变了就发组头」，同一组会重复发头（已置顶…今天…已置顶…）。
  // 先按 TIME_GROUP_ORDER 归组、组内保持后端顺序，保证每组的行连续、组头唯一。
  for (const group of TIME_GROUP_ORDER) {
    const groupItems = items.filter((item) => groupOf(item.timeLabel, item.isPinned) === group);
    if (!groupItems.length) continue;
    entries.push({ type: "header", group, top: offset });
    offset += GROUP_HEADER_HEIGHT_PX;
    for (const item of groupItems) {
      entries.push({ type: "row", item, top: offset });
      offset += rowHeight;
    }
  }

  const totalHeight = offset;
  const effectiveViewport = viewportH || rowHeight * 8;
  const minTop = scrollTop - OVERSCAN_ROWS * rowHeight;
  const maxTop = scrollTop + effectiveViewport + OVERSCAN_ROWS * rowHeight;

  const headers: RenderedHeader[] = [];
  const rows: RenderedRow[] = [];
  const rowsByld = new Map<string, number>();
  for (const entry of entries) {
    // 组头在窗口上方但组内仍有可见行时保留（避免滚动中组头闪烁）
    if (entry.top + (entry.type === "header" ? GROUP_HEADER_HEIGHT_PX : rowHeight) < minTop) continue;
    if (entry.top > maxTop) {
      if (entry.type === "row") break;
      continue;
    }
    if (entry.type === "header") headers.push({ group: entry.group, top: entry.top });
    else rows.push({ item: entry.item, top: entry.top });
  }
  // 绝对偏移表必须在窗口裁剪**之前**建（用全量 entries），否则键盘导航到窗口外时找不到行
  for (const entry of entries) {
    if (entry.type === "row") rowsByld.set(entry.item.id, entry.top);
  }

  return { headers, rows, totalHeight, rowsByld };
}

export function PopupApp() {
  const { query, setQuery, items, selectedId, setSelectedId, selectedItem, itemsRef, enqueueRefresh, isLoading } =
    // 首次浏览列表只取最近 POPUP_LIST_LIMIT 条（加速首次就绪），搜索不受限
    useClipboardData({ listLimit: POPUP_LIST_LIMIT });
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [shortcutBinding, setShortcutBinding] = useState("Cmd+Shift+V");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: ClipboardItem } | null>(null);

  // 列表字体大小（默认 13）；行高随其联动，虚拟滚动与渲染共用同一派生值
  const listFontSize = settings?.listFontSize ?? 13;
  const rowHeightPx = rowHeightForFontSize(listFontSize);

  // B2：悬停 200ms 显示预览。popup 悬浮窗在窗口右缘外（行 320 宽 + 8px gap），
  // 行→悬浮窗路径较长，hideOnRowLeave 关闭行级计时，改由「离开窗口」handlePanelLeave
  // 触发隐藏（350ms 容错），避免慢移时悬浮窗中途消失；进入悬浮窗则 handlePreviewEnter 取消
  const hoverPreview = useHoverPreview<ClipboardItem>({ delay: 200, hideDelay: 350, hideOnRowLeave: false });

  useEffect(() => {
    // popup 是 NSPanel，失焦自动隐藏但 React 组件仍运行——隐藏期间必须停止响应
    // hover 状态（否则残留的 isPreviewVisible 会在收到全局 preview:mouse-* 事件时
    // 误调用 previewHide，干扰 Main 共享的同一悬浮窗）；每次状态变化异步检查窗口可见性
    let cancelled = false;
    void (async () => {
      if (!("__TAURI_INTERNALS__" in window)) return;
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        let visible = true;
        try {
          visible = await win.isVisible();
        } catch {}
        if (cancelled || !visible) return;

        if (hoverPreview.isPreviewVisible && hoverPreview.hoveredItem && hoverPreview.hoveredRect) {
          const item = hoverPreview.hoveredItem;
          const rect = hoverPreview.hoveredRect;
          const pos = await win.outerPosition();
          const scale = await win.scaleFactor();
          const logicalX = pos.x / scale;
          const logicalY = pos.y / scale;

          // G2：独立 Preview 浮窗统一 320×360（图片/文本同高，避免尺寸跳变）；右侧优先定位（gap 8），
          // 越界切左与视口 clamp 由 Rust preview_show 兜底
          const previewW = PREVIEW_WIDTH;
          const previewH = PREVIEW_HEIGHT;
          const previewX = logicalX + POPUP_WIDTH + 8;
          const previewY = logicalY + rect.top;

          await previewShow(previewX, previewY, previewW, previewH, "popup");

          const { emit } = await import("@tauri-apps/api/event");
          void emit("preview:show", { item });
        } else {
          await previewHide();
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [hoverPreview.isPreviewVisible, hoverPreview.hoveredItem, hoverPreview.hoveredRect]);

  // ---- 虚拟滚动状态（固定行高 + 分组头，仅渲染可视窗 + overscan）----
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => setViewportH(el.clientHeight);
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);

  // 查询变化时列表回到顶部
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query]);

  const layout = useMemo(
    () => buildLayout(items, rowHeightPx, scrollTop, viewportH),
    [items, rowHeightPx, scrollTop, viewportH],
  );

  // 选中行不在可视区时（键盘导航）滚到该行
  useEffect(() => {
    const el = listRef.current;
    if (!el || !items.length) return;
    // 用全量绝对偏移表定位：渲染窗口子集在键盘导航越窗后查不到目标行，
    // 会导致选中行不滚入视野（HEAD 用绝对下标，这里必须保持等价能力）
    const rowTop = layout.rowsByld.get(selectedId);
    if (rowTop === undefined) return;
    const rowBottom = rowTop + rowHeightPx;
    if (rowTop < el.scrollTop || rowBottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.max(
        0,
        Math.min(rowTop - (el.clientHeight - rowHeightPx) / 2, el.scrollHeight - el.clientHeight),
      );
    }
    // rowsByld 随 layout 每次滚动重建，仅在选中项变化时触发滚动（items 变化时也要重新定位）
  }, [selectedId, items, rowHeightPx]);

  const setScroll = useCallback(() => {
    const el = listRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  // 分组顺序（用于渲染时的组标题文本）

  useEffect(() => {
    settingsGet().then((s) => {
      setSettings(s);
      applyListFontSize(s?.listFontSize ?? 13);
      applyThemeMode(s?.themeMode ?? "system");
    }).catch(() => applyThemeMode("system"));
    shortcutGet().then((sc) => setShortcutBinding(sc.binding)).catch(() => {});
  }, []);

  // 内容就绪信号：首批数据加载完成 + 首帧绘制（双 rAF）后通知 Rust 侧，
  // 避免首次打开时「空白→内容突然出现」的闪屏；数据异常时 2.5s 兜底放行
  const popupReadyRef = useRef(false);
  useEffect(() => {
    if (popupReadyRef.current || isLoading) return;
    let disposed = false;
    let rafId = 0;
    const fire = () => {
      if (!disposed && !popupReadyRef.current) {
        popupReadyRef.current = true;
        popupReady().catch(() => {});
      }
    };
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(fire);
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
    };
  }, [isLoading]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!popupReadyRef.current) {
        popupReadyRef.current = true;
        popupReady().catch(() => {});
      }
    }, 2500);
    return () => window.clearTimeout(t);
  }, []);

  // 三模式主题同步：监听 settings-updated（Main/Settings 里改动时联动）+
  // panel-appearance-changed（Rust 侧外观同步后广播的有效外观，system 模式下系统切换的唯一可靠来源）
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: Array<() => void> = [];
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        Promise.all([
          listen<{ theme_mode?: string; list_font_size?: number }>("settings-updated", (event) => {
            if (!disposed && event.payload.theme_mode) {
              applyThemeMode(event.payload.theme_mode);
            }
            if (!disposed && typeof event.payload.list_font_size === "number") {
              applyListFontSize(event.payload.list_font_size);
              setSettings((prev) => (prev ? { ...prev, listFontSize: event.payload.list_font_size as number } : prev));
            }
          }),
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

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlistenEnter: (() => void) | null = null;
    let unlistenLeave: (() => void) | null = null;
    let disposed = false;

    void import("@tauri-apps/api/event").then(({ listen }) => {
      listen("preview:mouse-enter", () => {
        if (!disposed) hoverPreview.handlePreviewEnter();
      }).then((fn) => { if (disposed) void fn(); else unlistenEnter = fn; });

      listen("preview:mouse-leave", () => {
        if (!disposed) hoverPreview.handlePreviewLeave();
      }).then((fn) => { if (disposed) void fn(); else unlistenLeave = fn; });
    });

    return () => { disposed = true; unlistenEnter?.(); unlistenLeave?.(); };
  }, [hoverPreview.handlePreviewEnter, hoverPreview.handlePreviewLeave]);

  // 悬浮窗鼠标状态轮询：preview 窗口（focused(false) 非激活 NSPanel）的 webview
  // mouseleave 事件在非激活状态不可靠（点击激活后才正常派发），导致「鼠标离开悬浮窗
  // 仍停留」。改由 Rust 全局鼠标位置判定「鼠标是否在悬浮窗窗口内」，独立于 webview
  // 事件驱动隐藏。每次 off 都触发 handlePreviewLeave（scheduleHide 幂等，计时器不会
  // 被高频调用重置）——覆盖「hover 行后鼠标移开却不经过悬浮窗」的行级隐藏缺失场景。
  useEffect(() => {
    if (!hoverPreview.isPreviewVisible) return;
    let disposed = false;
    const check = async () => {
      if (disposed) return;
      const state = await previewMouseState();
      if (disposed) return;
      if (state === "on") {
        hoverPreview.handlePreviewEnter();
      } else if (state === "off") {
        hoverPreview.handlePreviewLeave();
      }
    };
    void check();
    const t = window.setInterval(check, 300);
    return () => { disposed = true; window.clearInterval(t); };
  }, [hoverPreview.isPreviewVisible, hoverPreview.handlePreviewEnter, hoverPreview.handlePreviewLeave]);

  const popupKeyStateRef = useRef({ query, selectedId, selectedItem, items, contextMenu });
  useEffect(() => {
    popupKeyStateRef.current = { query, selectedId, selectedItem, items, contextMenu };
  });

  // keydown 监听器只挂载一次（deps=[]），直接闭包 settings 会永远拿到首帧的 null，
  // 导致 ↵ 忽略用户设置的 default_action=copy_only；改由 ref 读取最新值
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const { query: q, selectedId: selId, selectedItem: selItem, items: list } = popupKeyStateRef.current;

      if (event.key === "Escape") {
        event.preventDefault();
        // 右键菜单开着时 Esc 只关菜单：菜单自身监听器也会关一次，但不能把整个弹窗藏掉
        if (popupKeyStateRef.current.contextMenu) {
          setContextMenu(null);
          return;
        }
        if (q) {
          setQuery("");
        } else {
          hidePopup();
        }
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!list.length) return;
        const currentIndex = list.findIndex((item) => item.id === selId);
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex =
          event.key === "ArrowDown"
            ? (safeIndex + 1) % list.length
            : (safeIndex - 1 + list.length) % list.length;
        setSelectedId(list[nextIndex].id);
        return;
      }

      if (event.key === "Enter" && selItem) {
        event.preventDefault();
        // ⌥↵ = 粘贴为纯文本；⌘↵ = 仅复制；↵ = 默认动作
        if (event.altKey) {
          void handlePastePlainText(selItem);
          return;
        }
        void handleAction(selItem, event.metaKey);
        return;
      }

      // ⌘⌫ 删除选中项（Toast 可撤销）
      if (event.metaKey && (event.key === "Backspace" || event.key === "Delete") && selItem) {
        event.preventDefault();
        void handleDelete(selItem);
        return;
      }

      // ⌘P 置顶/取消置顶
      if (event.metaKey && event.key.toLowerCase() === "p" && selItem) {
        event.preventDefault();
        void handlePin(selItem);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleAction(item: ClipboardItem, alternate = false) {
    // D-07/D-13：「其他」类型固定仅复制；popup 不立即关闭，先显示行内一次性提示，
    // 1.5s 后再关闭（后端对应路径已跳过 hide_popup_window）
    if (item.kind === "other") {
      try {
        const result = await clipboardCopy(item.id);
        setToast({ id: Date.now(), tone: "success", message: result.message });
      } catch (error) {
        setToast({ id: Date.now(), tone: "warning", message: describeActionError(error) });
      }
      window.setTimeout(hidePopup, 1500);
      return;
    }

    try {
      const defaultAction = settingsRef.current?.defaultAction ?? "direct_paste";
      if (alternate || defaultAction === "copy_only") {
        await clipboardCopy(item.id);
      } else {
        await clipboardPaste(item.id);
      }
    } catch {
      try { await clipboardCopy(item.id); } catch {}
    } finally {
      hidePopup();
    }
  }

  async function handlePastePlainText(item: ClipboardItem) {
    try {
      await clipboardPaste(item.id, true);
    } catch {
      try { await clipboardCopy(item.id); } catch {}
    } finally {
      hidePopup();
    }
  }

  async function handleCopy(item: ClipboardItem) {
    try {
      await clipboardCopy(item.id);
      setToast({ id: Date.now(), tone: "success", message: "已复制到剪贴板" });
    } catch {}
  }

  /** 查看详情：弹出与 hover 预览同一套 320×360 只读浮窗（弹窗自身保留，不关闭） */
  async function handleDetail(item: ClipboardItem) {
    if (!("__TAURI_INTERNALS__" in window)) return;
    try {
      // 定位到 popup 左侧（gap 8）：hover 预览放右侧是因 popup 靠屏幕左缘时右侧有空间，
      // 而详情入口的 popup 通常停靠屏幕右缘，右侧放不下 → previewShow 只在溢出时才借用
      // popup 位置换算，传 (0,0) 会被原样放到屏幕左上角
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const scale = await win.scaleFactor();
      const logicalX = pos.x / scale;
      const logicalY = pos.y / scale;
      await previewShow(
        logicalX - PREVIEW_WIDTH - 8,
        logicalY,
        PREVIEW_WIDTH,
        PREVIEW_HEIGHT,
        "popup",
      );
      const { emit } = await import("@tauri-apps/api/event");
      void emit("preview:show", { item });
    } catch {}
  }

  async function handlePin(item: ClipboardItem) {
    try {
      if (item.isPinned) await clipboardUnpin(item.id);
      else await clipboardPin(item.id);
      enqueueRefresh();
    } catch {}
  }

  async function handleDelete(item: ClipboardItem) {
    try {
      const result = await clipboardDelete(item.id);
      enqueueRefresh();
      setToast({
        id: Date.now(),
        tone: "undo",
        message: "已删除 1 条",
        onUndo: () => {
          void clipboardRestore(result.undoToken)
            .then(() => enqueueRefresh())
            .catch(() => setToast({ id: Date.now(), tone: "warning", message: "撤销失败" }));
        },
      });
    } catch {}
  }

  function hidePopup() {
    void previewHide().catch(() => {});
    if ("__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().hide();
      }).catch(() => {});
    }
  }

  const handleRowClick = useCallback(
    (item: ClipboardItem) => {
      setSelectedId(item.id);
      void handleAction(item);
    },
    [settings],
  );

  const handleContextMenu = useCallback((event: React.MouseEvent, item: ClipboardItem) => {
    event.preventDefault();
    setSelectedId(item.id);
    const menuWidth = 178;
    const menuHeight = 250;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 6);
    const y = Math.min(event.clientY, Math.max(6, window.innerHeight - menuHeight));
    setContextMenu({ x, y, item });
  }, []);

  const totalCount = itemsRef.current.length || items.length;

  return (
    <div
      className="popup-shell relative flex h-screen w-screen flex-col overflow-hidden rounded-[12px] border border-[var(--popup-border)] bg-[var(--popup-bg)] shadow-[var(--popup-shadow)] frost-window"
      onMouseLeave={(e) => {
        // 鼠标真正离开 popup 窗口（relatedTarget 不在窗口内）才开始隐藏计时；
        // 行↔行/行↔搜索栏等窗口内移动不会误触发，给「行→悬浮窗」路径充足时间
        const related = e.relatedTarget as Node | null;
        if (!related || !e.currentTarget.contains(related)) {
          hoverPreview.handlePanelLeave();
        }
      }}
    >
      {/* 单行紧凑搜索（含窗口拖拽区；输入框与清空按钮自身不可拖拽） */}
      <div data-tauri-drag-region className="flex h-12 shrink-0 cursor-grab items-center px-[10px] pb-[2px] active:cursor-grabbing">
        <div
          data-tauri-drag-region
          className="flex h-8 w-full items-center gap-[7px] rounded-[10px] border border-[var(--border)] bg-[var(--search-box-bg)] px-[10px] transition-colors hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus-within:border-[var(--selection-accent)]"
        >
          <Search className="h-[13px] w-[13px] shrink-0 text-[var(--text-tertiary)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="搜索剪贴板…"
            className="w-full bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清空搜索"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--border)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-secondary)]"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          ) : null}
          <span className="shrink-0 rounded-[5px] border border-[var(--badge-border)] bg-[var(--badge-bg)] px-[5px] py-[2px] font-mono text-[9px] font-semibold text-[var(--badge-text)]">
            {formatShortcutGlyph(shortcutBinding)}
          </span>
        </div>
      </div>

      {/* 历史列表（固定行高 + 分组头虚拟滚动） */}
      {items.length ? (
        <div
          ref={listRef}
          onScroll={setScroll}
          // 高度交给 flex-1（父容器 flex-col：头 48px + 列表 + 底栏 32px），
          // 写死 calc(100vh-77px) 会与 48+32=80 差 3px 造成溢出/裁切
          className="min-h-0 flex-1 overflow-y-auto pb-1"
          data-testid="popup-list"
        >
          {/* 用绝对定位承载分组头与行，总高度由 spacer 撑起，保持滚动条比例 */}
          <div style={{ height: layout.totalHeight, position: "relative" }}>
            {layout.headers.map((header) => (
              <div
                key={`header-${header.group}-${header.top}`}
                className="absolute left-0 right-0 flex items-center px-[13px] pb-[5px] pt-2 text-[10.5px] font-semibold tracking-[0.05em] text-[var(--text-tertiary)]"
                style={{ top: header.top, height: GROUP_HEADER_HEIGHT_PX }}
              >
                {TIME_GROUP_LABELS[header.group as keyof typeof TIME_GROUP_LABELS] ?? header.group}
              </div>
            ))}
            {layout.rows.map((row) => (
              <div
                key={row.item.id}
                className="absolute left-0 right-0"
                style={{ top: row.top, height: rowHeightPx }}
              >
                <PopupHistoryRow
                  item={row.item}
                  isSelected={row.item.id === selectedId}
                  onSelect={() => setSelectedId(row.item.id)}
                  onClick={() => handleRowClick(row.item)}
                  onMouseEnter={(rect) => hoverPreview.handleRowEnter(row.item, rect)}
                  onMouseLeave={hoverPreview.handleRowLeave}
                  onPin={() => void handlePin(row.item)}
                  onDelete={() => void handleDelete(row.item)}
                  onContextMenu={(event) => handleContextMenu(event, row.item)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4">
          <FileText aria-hidden className="h-[26px] w-[26px] opacity-15" />
          <p className="text-[13px] text-[var(--text-tertiary)]">
            {query ? "没有匹配的内容" : "剪贴板暂无记录"}
          </p>
          {query ? <p className="text-[11px] text-[var(--text-tertiary)]">试试更短的关键词，或按 Esc 清空</p> : null}
        </div>
      )}

      {/* 键盘提示条 + 计数 */}
      <div className="flex h-[32px] shrink-0 items-center gap-[13px] border-t border-[var(--divider)] px-3 text-[10.5px] text-[var(--text-tertiary)]">
        <span className="flex items-center gap-1">
          <span className="font-mono">↑↓</span> 选择
        </span>
        <span className="flex items-center gap-1">
          <span className="font-mono">↵</span> 粘贴
        </span>
        <span className="flex items-center gap-1">
          <span className="font-mono">⌘⌫</span> 删除
        </span>
        <span className="ml-auto tabular-nums">共 {totalCount} 条</span>
      </div>

      {/* 撤销 / 反馈 Toast（浮在列表上方） */}
      <div className="pointer-events-none absolute inset-x-3 bottom-[40px] z-40">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>

      {/* 右键菜单 */}
      {contextMenu ? (
        <PopupContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onCopy={() => void handleCopy(contextMenu.item)}
          onPaste={() => void handleAction(contextMenu.item)}
          onPastePlainText={() => void handlePastePlainText(contextMenu.item)}
          onPin={() => void handlePin(contextMenu.item)}
          onDetail={() => void handleDetail(contextMenu.item)}
          onDelete={() => void handleDelete(contextMenu.item)}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  );
}
