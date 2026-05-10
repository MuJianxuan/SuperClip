import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Settings2, Pause, Play, Pin } from "lucide-react";
import { useClipboardData } from "../hooks/useClipboardData";
import { useHoverPreview } from "../hooks/useHoverPreview";
import { PopupHistoryRow } from "./PopupHistoryRow";
import { PopupPreviewPopover } from "./PopupPreviewPopover";
import {
  clipboardCopy,
  clipboardPaste,
  monitorToggle,
  settingsGet,
  shortcutGet,
  type SettingsResponse,
} from "../lib/superclip";
import type { ClipboardItem } from "../components/history-row";

const INITIAL_VISIBLE_COUNT = 8;
const EXPANDED_VISIBLE_COUNT = 20;

export function PopupApp() {
  const { query, setQuery, items, selectedId, setSelectedId, selectedItem } =
    useClipboardData();
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [shortcutBinding, setShortcutBinding] = useState("Cmd+Shift+V");

  const hoverPreview = useHoverPreview<ClipboardItem>({ delay: 300, hideDelay: 100 });

  const visibleCount = isExpanded ? EXPANDED_VISIBLE_COUNT : INITIAL_VISIBLE_COUNT;
  const visibleItems = items.slice(0, visibleCount);
  const pinnedCount = useMemo(() => items.filter((item) => item.isPinned).length, [items]);

  useEffect(() => {
    settingsGet().then(setSettings).catch(() => {});
    shortcutGet().then((sc) => setShortcutBinding(sc.binding)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | null = null;
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen("monitor-status-changed", (event: { payload: { is_monitoring: boolean } }) => {
          if (!disposed) setIsMonitoring(event.payload.is_monitoring);
        }),
      )
      .then((fn) => { if (disposed) void fn(); else unlisten = fn; })
      .catch(() => {});

    return () => { disposed = true; unlisten?.(); };
  }, []);

  const popupKeyStateRef = useRef({ query, selectedId, selectedItem, visibleItems });
  useEffect(() => {
    popupKeyStateRef.current = { query, selectedId, selectedItem, visibleItems };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const { query: q, selectedId: selId, selectedItem: selItem, visibleItems: visible } = popupKeyStateRef.current;

      if (event.key === "Escape") {
        event.preventDefault();
        if (q) {
          setQuery("");
        } else {
          hidePopup();
        }
        return;
      }

      if (event.key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        setIsExpanded((v) => !v);
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = visible.findIndex((item) => item.id === selId);
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex =
          event.key === "ArrowDown"
            ? (safeIndex + 1) % visible.length
            : (safeIndex - 1 + visible.length) % visible.length;
        setSelectedId(visible[nextIndex].id);
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
      hidePopup();
    } catch {
      // fallback to copy
      try {
        await clipboardCopy(item.id);
        hidePopup();
      } catch {}
    }
  }

  async function handleMonitorToggle() {
    try {
      const response = await monitorToggle(!isMonitoring);
      setIsMonitoring(response.isMonitoring);
    } catch {}
  }

  function hidePopup() {
    if ("__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().hide();
      }).catch(() => {});
    }
  }

  function openSettings() {
    if ("__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/event").then(({ emit }) => {
        emit("app:show-settings", { source: "popup" });
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
    <div className="popup-shell h-screen w-screen overflow-hidden rounded-xl border border-[var(--popup-border)] bg-[var(--popup-bg)] shadow-[var(--popup-shadow)] backdrop-blur-[24px] backdrop-saturate-[1.8]">
      {/* Search */}
      <div className="flex h-9 items-center gap-2 border-b border-[var(--border)] px-3">
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="搜索剪贴板..."
          className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
        <span className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
          {shortcutBinding}
        </span>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto" style={{ height: "calc(100vh - 72px)" }}>
        {visibleItems.length ? (
          <div className="py-1">
            {visibleItems.map((item) => (
              <PopupHistoryRow
                key={item.id}
                item={item}
                isSelected={item.id === selectedId}
                onSelect={() => setSelectedId(item.id)}
                onClick={() => handleRowClick(item)}
                onMouseEnter={(rect) => hoverPreview.handleRowEnter(item, rect)}
                onMouseLeave={hoverPreview.handleRowLeave}
              />
            ))}
            {items.length > visibleCount && (
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="w-full px-3 py-1.5 text-center text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                {isExpanded ? "收起" : `Tab 展开更多 (${items.length - visibleCount})`}
              </button>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-4">
            <p className="text-[13px] text-[var(--text-tertiary)]">
              {query ? "没有匹配项" : "暂无记录"}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex h-9 items-center gap-2 border-t border-[var(--border)] px-3">
        <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
          <Pin className="h-3 w-3" />
          {pinnedCount}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={openSettings}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-secondary)]"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleMonitorToggle}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-secondary)]"
        >
          {isMonitoring ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Hover Preview Popover */}
      {hoverPreview.isPreviewVisible && hoverPreview.hoveredItem && hoverPreview.hoveredRect && (
        <PopupPreviewPopover
          item={hoverPreview.hoveredItem}
          anchorRect={hoverPreview.hoveredRect}
          onMouseEnter={hoverPreview.handlePreviewEnter}
          onMouseLeave={hoverPreview.handlePreviewLeave}
        />
      )}
    </div>
  );
}
