import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { Copy, LockKeyhole, MonitorCog, ShieldCheck, TriangleAlert } from "lucide-react";
import { MainTopBar } from "./MainTopBar";
import { MainTabNavigation } from "./MainTabNavigation";
import type { TabId } from "./MainTabNavigation";
import { MainListView } from "./MainListView";
import { MainGridView } from "./MainGridView";
import { MainBulkActionBar } from "./MainBulkActionBar";
import { SettingsShell } from "../../components/settings-shell";
import { useClipboardData } from "../../hooks/useClipboardData";
import {
  clipboardCopy,
  clipboardPaste,
  clipboardPin,
  clipboardUnpin,
  clipboardDelete,
  settingsGet,
  settingsUpdate,
  rulesList,
  rulesUpsert,
  rulesDelete,
  rulesClear,
  shortcutGet,
  shortcutStartRecording,
  shortcutCancelRecording,
  shortcutValidate,
  shortcutUpdate,
  shortcutRestoreDefault,
  permissionCheckAccessibility,
  permissionOpenAccessibility,
  diagnosticsExport,
  runtimeStateGet,
  mainWindowReady,
  type SettingsResponse,
  type SettingsUpdatePayload,
  type ShortcutStateResponse,
  type ShortcutValidationResponse,
  type ExclusionRule,
  type RulesUpsertPayload,
} from "../../lib/superclip";

// --- PLACEHOLDER_MAIN_APP_BODY ---

interface FeedbackToast {
  createdAtMs: number;
  title: string;
  message: string;
  tone: "success" | "warning" | "copy";
  timeoutMs: number;
}

const initialSettings: SettingsResponse = {
  schemaVersion: 1,
  exposedKeys: [],
  reservedKeys: [],
  defaultAction: "direct_paste",
  themeMode: "system",
  historyLimit: 1000,
  launchAtLogin: false,
  showOnStartup: false,
};

const initialShortcut: ShortcutStateResponse = {
  binding: "Cmd+Shift+V",
  isRegistered: true,
  source: "default",
  version: 1,
};

export function MainApp() {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    try {
      const saved = localStorage.getItem("superclip:viewMode");
      return saved === "grid" ? "grid" : "list";
    } catch { return "list"; }
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsResponse>(initialSettings);
  const [shortcut, setShortcut] = useState<ShortcutStateResponse>(initialShortcut);
  const [rules, setRules] = useState<ExclusionRule[]>([]);
  const [permissionTrusted, setPermissionTrusted] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isMigrationBlocking, setIsMigrationBlocking] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackToast | null>(null);

  const readOnlyRef = useRef({ isRecoveryMode, isMigrationBlocking });
  readOnlyRef.current = { isRecoveryMode, isMigrationBlocking };

  const { query, setQuery, items, itemsRef, selectedId, setSelectedId, enqueueRefresh } = useClipboardData();

  // E2：chips 计数基于当前数据集的分布；前端按 tab 过滤（后端不再传 kindFilter）
  const counts = useMemo(() => {
    return {
      all: items.length,
      text: items.filter((i) => i.kind === "text").length,
      image: items.filter((i) => i.kind === "image").length,
      file: items.filter((i) => i.kind === "file").length,
      pinned: items.filter((i) => i.isPinned).length,
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    if (activeTab === "all") return items;
    if (activeTab === "pinned") return items.filter((i) => i.isPinned);
    return items.filter((i) => i.kind === activeTab);
  }, [items, activeTab]);

  const pinnedCount = useMemo(() => items.filter((i) => i.isPinned).length, [items]);

  // 内容就绪信号：bootstrap 完成（或失败降级）后 + 首帧绘制（双 rAF）通知 Rust 侧，
  // 避免从快捷面板/Dock 首次打开主页时「空白→内容突然出现」的闪屏；数据异常时 2.5s 兜底放行
  const mainReadyRef = useRef(false);
  const signalMainReady = useCallback(() => {
    if (mainReadyRef.current) return;
    mainReadyRef.current = true;
    mainWindowReady().catch(() => {});
  }, []);

  useEffect(() => {
    const t = window.setTimeout(signalMainReady, 2500);
    return () => window.clearTimeout(t);
  }, [signalMainReady]);

  // Bootstrap: load settings, rules, shortcut, permission, runtime state
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const [s, r, sc, p] = await Promise.all([
          settingsGet(),
          rulesList(),
          shortcutGet(),
          permissionCheckAccessibility(),
        ]);
        if (!active) return;
        setSettings(s);
        setRules(r.rules);
        setShortcut(sc);
        setPermissionTrusted(p.accessibilityTrusted);

        try {
          const rs = await runtimeStateGet();
          if (!active) return;
          setIsRecoveryMode(rs.isRecoveryMode);
          setIsMigrationBlocking(rs.migrationPhase === "migration_in_progress");
        } catch {}
      } finally {
        // 内容就绪信号：bootstrap 完成（或异常降级）后 + 首帧绘制（双 rAF）
        if (active) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => signalMainReady());
          });
        }
      }
    }
    bootstrap();
    return () => { active = false; };
  }, [signalMainReady]);

  // Persist view mode
  useEffect(() => {
    try { localStorage.setItem("superclip:viewMode", viewMode); } catch {}
  }, [viewMode]);

  // Theme sync：system 模式用 matchMedia 显式判断并写入具体 data-theme-mode，
  // 不依赖 CSS @media (prefers-color-scheme) 的匹配行为（WKWebView 中该媒体查询
  // 跟随窗口外观，不可靠）；监听系统外观变化实时更新，effect 清理时移除监听。
  useEffect(() => {
    const root = document.documentElement;
    if (settings.themeMode === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => {
        root.dataset.themeMode = media.matches ? "dark" : "light";
      };
      apply();
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    root.dataset.themeMode = settings.themeMode;
    return undefined;
  }, [settings.themeMode]);

  // Tauri events
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: Array<() => void> = [];
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        Promise.all([
          listen("app:show-settings", () => { if (!disposed) setIsSettingsOpen(true); }),
          // 主题/设置外部变更（如 QuickPanel）时保持 Main 本地状态与 data-theme-mode 同步
          listen<{ theme_mode?: string; default_action?: SettingsResponse["defaultAction"] }>("settings-updated", (event) => {
            if (disposed) return;
            const payload = event.payload;
            if (payload.theme_mode) {
              setSettings((prev) => ({ ...prev, themeMode: payload.theme_mode as SettingsResponse["themeMode"] }));
            }
            if (payload.default_action) {
              setSettings((prev) => ({ ...prev, defaultAction: payload.default_action as SettingsResponse["defaultAction"] }));
            }
          }),
        ]),
      )
      .then((fns) => { if (disposed) fns.forEach((f) => void f()); else unlisten = fns; })
      .catch(() => {});

    return () => { disposed = true; unlisten.forEach((f) => void f()); };
  }, []);

  // Feedback auto-dismiss
  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), feedback.timeoutMs);
    return () => window.clearTimeout(t);
  }, [feedback]);

  // Keyboard shortcuts
  const keyStateRef = useRef<{
    isSettingsOpen: boolean;
    items: typeof visibleItems;
    selectedId: string;
    handlePin: (id: string) => void;
    handleDelete: (id: string) => void;
  }>({ isSettingsOpen, items: visibleItems, selectedId, handlePin: () => {}, handleDelete: () => {} });
  useEffect(() => {
    keyStateRef.current = { isSettingsOpen, items: visibleItems, selectedId, handlePin, handleDelete };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const { isSettingsOpen: settingsOpen, items: currentItems, selectedId: currentSelectedId, handlePin: pin, handleDelete: del } = keyStateRef.current;
      if (settingsOpen) return;

      const isInput = event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement;
      // 输入态下全部放行，让浏览器默认行为（如 ⌘A 全选搜索文本）正常工作，避免误触全局快捷键
      if (isInput) return;

      if (event.metaKey && event.key >= "1" && event.key <= "5") {
        event.preventDefault();
        const tabMap: TabId[] = ["all", "text", "image", "file", "pinned"];
        setActiveTab(tabMap[parseInt(event.key) - 1]);
        return;
      }
      if (event.metaKey && event.key === "l") {
        event.preventDefault();
        setViewMode((m) => (m === "list" ? "grid" : "list"));
        return;
      }
      if (event.metaKey && event.key === "a") {
        event.preventDefault();
        setSelectedIds(new Set(currentItems.map((i) => i.id)));
        return;
      }
      if (event.metaKey && event.key === "p") {
        event.preventDefault();
        if (currentSelectedId) void pin(currentSelectedId);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (currentSelectedId) void del(currentSelectedId);
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // E2：单击行 = 单选（驱动 ⌘P/⌘⌫）+ 计入批量集合，使「勾选框 + 浅蓝底」联动
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const blockIfReadOnly = useCallback((label: string): boolean => {
    if (readOnlyRef.current.isMigrationBlocking) {
      setFeedback({ createdAtMs: Date.now(), title: `${label}已禁用`, message: "迁移完成前暂不开放写操作。", tone: "warning", timeoutMs: 4000 });
      return true;
    }
    if (readOnlyRef.current.isRecoveryMode) {
      setFeedback({ createdAtMs: Date.now(), title: `${label}已禁用`, message: "恢复模式下不可修改数据。", tone: "warning", timeoutMs: 4000 });
      return true;
    }
    return false;
  }, []);

  const handleAction = useCallback(async (id: string) => {
    if (blockIfReadOnly("粘贴")) return;
    try { await clipboardPaste(id); } catch { try { await clipboardCopy(id); } catch {} }
  }, [blockIfReadOnly]);

  const handleCopy = useCallback(async (id: string) => {
    try { await clipboardCopy(id); } catch {}
  }, []);

  const handlePin = useCallback(async (id: string) => {
    if (blockIfReadOnly("置顶")) return;
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    try {
      if (item.isPinned) await clipboardUnpin(id); else await clipboardPin(id);
      enqueueRefresh();
    } catch {}
  }, [itemsRef, enqueueRefresh, blockIfReadOnly]);

  const handleDelete = useCallback(async (id: string) => {
    if (blockIfReadOnly("删除")) return;
    try { await clipboardDelete(id); enqueueRefresh(); } catch {}
  }, [enqueueRefresh, blockIfReadOnly]);

  const handleBulkCopy = useCallback(async () => {
    for (const id of selectedIds) { try { await clipboardCopy(id); break; } catch {} }
  }, [selectedIds]);

  const handleBulkPin = useCallback(async () => {
    if (blockIfReadOnly("批量置顶")) return;
    for (const id of selectedIds) { try { await clipboardPin(id); } catch {} }
    enqueueRefresh(); setSelectedIds(new Set());
  }, [selectedIds, enqueueRefresh, blockIfReadOnly]);

  const handleBulkDelete = useCallback(async () => {
    if (blockIfReadOnly("批量删除")) return;
    for (const id of selectedIds) { try { await clipboardDelete(id); } catch {} }
    enqueueRefresh(); setSelectedIds(new Set());
  }, [selectedIds, enqueueRefresh, blockIfReadOnly]);

  // Settings handlers
  async function handleSettingsUpdate(patch: SettingsUpdatePayload) {
    const next = await settingsUpdate(patch);
    setSettings(next);
  }

  async function handleRuleUpsert(payload: RulesUpsertPayload) {
    const response = await rulesUpsert(payload);
    setRules((prev) => {
      const remaining = prev.filter((r) => r.id !== response.rule.id);
      return [response.rule, ...remaining];
    });
  }

  async function handleRuleDelete(ruleId: string) {
    await rulesDelete(ruleId);
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  }

  async function handleRulesClear() {
    await rulesClear();
    setRules([]);
  }

  async function handleShortcutStart() {
    const r = await shortcutStartRecording();
    setShortcut({ binding: r.binding, isRegistered: r.isRegistered, source: r.source, version: r.version });
  }

  async function handleShortcutCancel() {
    const r = await shortcutCancelRecording();
    setShortcut({ binding: r.binding, isRegistered: r.isRegistered, source: r.source, version: r.version });
  }

  async function handleShortcutValidate(binding: string): Promise<ShortcutValidationResponse> {
    return shortcutValidate(binding);
  }

  async function handleShortcutUpdate(binding: string) {
    const r = await shortcutUpdate(binding);
    setShortcut(r);
  }

  async function handleShortcutRestoreDefault() {
    const r = await shortcutRestoreDefault();
    setShortcut(r);
  }

  async function handleDiagnosticsClick() {
    try {
      await diagnosticsExport();
      setFeedback({ createdAtMs: Date.now(), title: "诊断已导出", message: "诊断包已写入本地。", tone: "success", timeoutMs: 3000 });
    } catch {
      setFeedback({ createdAtMs: Date.now(), title: "导出失败", message: "请重试。", tone: "warning", timeoutMs: 4000 });
    }
  }

  async function handlePermissionGuideClick() {
    try { await permissionOpenAccessibility(); } catch {}
  }

  return (
    <main className="frost-window relative flex h-screen w-screen flex-col overflow-hidden rounded-none border border-[var(--window-inset-border)] bg-[var(--bg)] text-[var(--text-primary)] shadow-[var(--window-drop-shadow)]">
      {/* F2：settings 打开时 MainTopBar 隐藏，由 SettingsShell 的 header 作为唯一工具条（identity + 返回列表） */}
      {!isSettingsOpen && (
        <MainTopBar
          viewMode={viewMode}
          query={query}
          onViewModeChange={setViewMode}
          onQueryChange={setQuery}
          onSettingsClick={() => setIsSettingsOpen(true)}
        />
      )}

      {/* 主体分区：剪贴板列表 或 设置分区（Settings 为 Main 内分区视图） */}
      {isSettingsOpen ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <SettingsShell
            settings={settings}
            shortcut={shortcut}
            rules={rules}
            pinnedCount={pinnedCount}
            permissionTrusted={permissionTrusted}
            readOnlyMode={isRecoveryMode || isMigrationBlocking}
            onClose={() => setIsSettingsOpen(false)}
            onUpdate={handleSettingsUpdate}
            onDiagnosticsClick={handleDiagnosticsClick}
            onPermissionGuideClick={handlePermissionGuideClick}
            onRuleUpsert={handleRuleUpsert}
            onRuleDelete={handleRuleDelete}
            onRulesClear={handleRulesClear}
            onShortcutStart={handleShortcutStart}
            onShortcutCancel={handleShortcutCancel}
            onShortcutValidate={handleShortcutValidate}
            onShortcutUpdate={handleShortcutUpdate}
            onShortcutRestoreDefault={handleShortcutRestoreDefault}
          />
        </div>
      ) : (
        <>
          {/* E2 过滤 chips 行（独立于工具条） */}
          <MainTabNavigation activeTab={activeTab} counts={counts} onTabChange={setActiveTab} />

      {/* Status Banners（E2 保留槽位：工具条/列表之间的浮动圆角横幅卡） */}
      {(!permissionTrusted || isRecoveryMode) && (
        <div className="mx-4 mb-2 space-y-2">
          {!permissionTrusted && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2">
              <p className="text-xs font-medium text-[var(--warning-text)]">仅复制模式 — 辅助功能权限未授权</p>
              <button
                type="button"
                onClick={() => void handlePermissionGuideClick()}
                className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
              >
                <LockKeyhole className="h-3.5 w-3.5" />
                授权
              </button>
            </div>
          )}
          {isRecoveryMode && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2">
              <div>
                <p className="text-xs font-medium text-[var(--warning-text)]">恢复模式</p>
                <p className="mt-0.5 text-xs text-[var(--warning-text)]">只开放浏览、搜索、复制和诊断。</p>
              </div>
              <button
                type="button"
                onClick={() => void handleDiagnosticsClick()}
                className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
              >
                <MonitorCog className="h-3.5 w-3.5" />
                导出诊断
              </button>
            </div>
          )}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        {viewMode === "list" ? (
          <MainListView
            items={visibleItems}
            selectedId={selectedId}
            selectedIds={selectedIds}
            hasQuery={!!query.trim()}
            onClearSearch={() => setQuery("")}
            onSelect={handleSelect}
            onToggleSelect={handleToggleSelect}
            onAction={handleAction}
            onCopy={handleCopy}
            onPin={handlePin}
            onDelete={handleDelete}
          />
        ) : (
          <MainGridView
            items={visibleItems}
            selectedId={selectedId}
            selectedIds={selectedIds}
            hasQuery={!!query.trim()}
            onClearSearch={() => setQuery("")}
            onSelect={handleSelect}
            onToggleSelect={handleToggleSelect}
            onAction={handleAction}
            onPin={handlePin}
            onDelete={handleDelete}
          />
        )}

          <MainBulkActionBar
            selectedCount={selectedIds.size}
            totalCount={visibleItems.length}
            onSelectAll={() => setSelectedIds(new Set(visibleItems.map((i) => i.id)))}
            onDeselectAll={() => setSelectedIds(new Set())}
            onBulkCopy={handleBulkCopy}
            onBulkPin={handleBulkPin}
            onBulkDelete={handleBulkDelete}
          />
        </div>
        </>
      )}

      {/* Migration Blocking Overlay */}
      {isMigrationBlocking && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(17,22,30,0.42)] px-6 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-6 text-center shadow-[0_24px_80px_rgba(17,22,30,0.22)]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--accent)]">
              <MonitorCog className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">正在完成本地迁移</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">完成前暂不开放写操作。</p>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedback && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-[var(--surface-2)] p-2 text-[var(--accent)]">
              {feedback.tone === "warning" ? (
                <TriangleAlert className="h-4 w-4" />
              ) : feedback.tone === "copy" ? (
                <Copy className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">{feedback.title}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{feedback.message}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
