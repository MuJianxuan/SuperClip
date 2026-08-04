import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search, X } from "lucide-react";
import { useClipboardData } from "../hooks/useClipboardData";
import { useHoverPreview } from "../hooks/useHoverPreview";
import { PopupHistoryRow } from "./PopupHistoryRow";
import {
  clipboardCopy,
  clipboardPaste,
  popupReady,
  previewShow,
  previewHide,
  settingsGet,
  shortcutGet,
  type SettingsResponse,
} from "../lib/superclip";
import type { ClipboardItem } from "../components/history-row";

/** Popup 面板宽度（与 Rust 侧 popup panel 的 inner_size 320 保持一致） */
const POPUP_WIDTH = 320;
/** 固定行高（Popup 列表虚拟滚动用；行外层以 h-[46px] 固定对齐，见下） */
const ROW_HEIGHT_PX = 46;
/** 可视区上下额外渲染行数 */
const OVERSCAN_ROWS = 6;

/** 三模式主题同步：浅/深/跟随系统（与 MainApp 同一套逻辑） */
function applyThemeMode(mode: string) {
  const root = document.documentElement;
  if (mode === "system") {
    delete root.dataset.themeMode;
  } else {
    root.dataset.themeMode = mode;
  }
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

export function PopupApp() {
  const { query, setQuery, items, selectedId, setSelectedId, selectedItem } =
    useClipboardData();
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [shortcutBinding, setShortcutBinding] = useState("Cmd+Shift+V");

  // B2：悬停 200ms 显示预览，移入浮窗 150ms 容错
  const hoverPreview = useHoverPreview<ClipboardItem>({ delay: 200, hideDelay: 150 });

  useEffect(() => {
    if (hoverPreview.isPreviewVisible && hoverPreview.hoveredItem && hoverPreview.hoveredRect) {
      const item = hoverPreview.hoveredItem;
      const rect = hoverPreview.hoveredRect;
      if (!("__TAURI_INTERNALS__" in window)) return;

      void (async () => {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const win = getCurrentWindow();
          const pos = await win.outerPosition();
          const scale = await win.scaleFactor();
          const logicalX = pos.x / scale;
          const logicalY = pos.y / scale;

          // G2：独立 Preview 浮窗统一 320 宽；右侧优先定位（gap 8），越界切左与视口 clamp 由 Rust preview_show 兜底
          const isImage = item.kind === "image";
          const previewW = 320;
          const previewH = isImage ? 280 : 360;
          const previewX = logicalX + POPUP_WIDTH + 8;
          const previewY = logicalY + rect.top;

          await previewShow(previewX, previewY, previewW, previewH);

          const { emit } = await import("@tauri-apps/api/event");
          await emit("preview:show", { item });
        } catch {}
      })();
    } else {
      void previewHide().catch(() => {});
    }
  }, [hoverPreview.isPreviewVisible, hoverPreview.hoveredItem, hoverPreview.hoveredRect]);

  // ---- 虚拟滚动状态（固定行高，仅渲染可视窗 + overscan）----
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

  // 选中行不在可视区时（键盘导航）滚到该行
  useEffect(() => {
    const el = listRef.current;
    if (!el || !items.length) return;
    const idx = items.findIndex((i) => i.id === selectedId);
    if (idx < 0) return;
    const rowTop = idx * ROW_HEIGHT_PX;
    const rowBottom = rowTop + ROW_HEIGHT_PX;
    if (rowTop < el.scrollTop || rowBottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.max(
        0,
        Math.min(rowTop - (el.clientHeight - ROW_HEIGHT_PX) / 2, el.scrollHeight - el.clientHeight),
      );
    }
  }, [selectedId, items]);

  const renderedWindow = useMemo(() => {
    const total = items.length;
    if (!total) return { startIndex: 0, endIndex: 0, total: 0, items: [] as ClipboardItem[] };
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN_ROWS);
    // jsdom/未测量时 fallback 高度，保证测试与真实皆有内容渲染
    const visibleCount = Math.ceil((viewportH || ROW_HEIGHT_PX * 8) / ROW_HEIGHT_PX);
    const endIndex = Math.min(total, startIndex + visibleCount + OVERSCAN_ROWS * 2);
    return { startIndex, endIndex, total, items: items.slice(startIndex, endIndex) };
  }, [items, scrollTop, viewportH]);

  const setScroll = useCallback(() => {
    const el = listRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  useEffect(() => {
    settingsGet().then((s) => {
      setSettings(s);
      applyThemeMode(s.themeMode);
    }).catch(() => {});
    shortcutGet().then((sc) => setShortcutBinding(sc.binding)).catch(() => {});
    popupReady().catch(() => {});
  }, []);

  // 三模式主题同步：监听 settings-updated（Main/Settings 里改动时联动）
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | null = null;
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<{ theme_mode?: string }>("settings-updated", (event) => {
          if (!disposed && event.payload.theme_mode) {
            applyThemeMode(event.payload.theme_mode);
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

  const popupKeyStateRef = useRef({ query, selectedId, selectedItem, items });
  useEffect(() => {
    popupKeyStateRef.current = { query, selectedId, selectedItem, items };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const { query: q, selectedId: selId, selectedItem: selItem, items: list } = popupKeyStateRef.current;

      if (event.key === "Escape") {
        event.preventDefault();
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
        void handleAction(selItem, event.metaKey);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleAction(item: ClipboardItem, alternate = false) {
    try {
      const defaultAction = settings?.defaultAction ?? "direct_paste";
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

  return (
    <div className={`popup-shell flex h-screen w-screen flex-col overflow-hidden rounded-[12px] border border-[var(--popup-border)] shadow-[var(--popup-shadow)] ${"__TAURI_INTERNALS__" in window ? "bg-transparent" : "bg-[var(--popup-bg)] frost-window"}`}>
      {/* 单行紧凑搜索（含窗口拖拽区；输入框与清空按钮自身不可拖拽） */}
      <div data-tauri-drag-region className="flex h-12 shrink-0 cursor-grab items-center gap-2 px-3 active:cursor-grabbing">
        <div
          data-tauri-drag-region
          className="flex h-8 w-full items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] px-2.5 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus-within:border-[var(--selection-accent)]"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="搜索..."
            className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
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
          <span className="shrink-0 rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--text-tertiary)]">
            {formatShortcutGlyph(shortcutBinding)}
          </span>
        </div>
      </div>

      {/* 历史列表（固定行高虚拟滚动） */}
      {items.length ? (
        <div
          ref={listRef}
          onScroll={setScroll}
          className="animate-[rowSlideIn_0.2s_ease-out] flex-1 overflow-y-auto"
          style={{ height: "calc(100vh - 80px)" }}
        >
          {/* 上下 spacer 占位保持滚动条比例 */}
          <div
            style={{
              paddingTop: renderedWindow.startIndex * ROW_HEIGHT_PX,
              paddingBottom: (renderedWindow.total - renderedWindow.endIndex) * ROW_HEIGHT_PX,
            }}
          >
            {renderedWindow.items.map((item) => (
              <div key={item.id} className="h-[46px]">
                <PopupHistoryRow
                  item={item}
                  isSelected={item.id === selectedId}
                  onSelect={() => setSelectedId(item.id)}
                  onClick={() => handleRowClick(item)}
                  onMouseEnter={(rect) => hoverPreview.handleRowEnter(item, rect)}
                  onMouseLeave={hoverPreview.handleRowLeave}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-[calc(100vh-80px)] flex-col items-center justify-center gap-2 px-4">
          <FileText aria-hidden className="h-[26px] w-[26px] opacity-15" />
          <p className="text-[13px] text-[var(--text-tertiary)]">
            {query ? "没有匹配的内容" : "剪贴板暂无记录"}
          </p>
        </div>
      )}

      {/* 单行信息底栏（纯信息，无任何按钮） */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-[var(--border)] px-3">
        <span className="text-[10.5px] text-[var(--text-tertiary)]">共 {items.length} 条</span>
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
          悬停预览
        </span>
      </div>
    </div>
  );
}
