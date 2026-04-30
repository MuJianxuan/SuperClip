import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import {
  AppWindow,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Copy,
  FileImage,
  Keyboard,
  LockKeyhole,
  MonitorCog,
  Pin,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkle,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  getClipboardIcon,
  getClipboardKindLabel,
  HistoryRow,
} from "./components/history-row";
import { SettingsShell } from "./components/settings-shell";
import type { ClipboardItem } from "./components/history-row";
import { StatusPill } from "./components/status-pill";
import { Button } from "./components/ui/button";
import { ScrollArea } from "./components/ui/scroll-area";
import { Switch } from "./components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip";
import {
  clipboardClear,
  clipboardCopy,
  clipboardDelete,
  diagnosticsExport,
  clipboardPaste,
  clipboardPin,
  clipboardRestore,
  clipboardSearch,
  clipboardUnpin,
  getKindActionLabel,
  monitorToggle,
  permissionCheckAccessibility,
  permissionOpenAccessibility,
  runtimeStateGet,
  windowPlacementRefresh,
  sessionUiStateGet,
  sessionUiStateUpdate,
  rulesClear,
  rulesDelete,
  rulesList,
  rulesUpsert,
  shortcutCancelRecording,
  shortcutGet,
  shortcutRestoreDefault,
  shortcutStartRecording,
  shortcutUpdate,
  shortcutValidate,
  settingsGet,
  settingsUpdate,
  type ClipboardActionResult,
  type DiagnosticsExportResponse,
  type ExclusionRule,
  type PermissionStatus,
  type RuntimeStateResponse,
  type RulesUpsertPayload,
  type SessionUiStateResponse,
  type ShortcutStateResponse,
  type ShortcutValidationResponse,
  type SettingsUpdatePayload,
  type SettingsResponse,
} from "./lib/superclip";
import "./App.css";

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

const initialPermission: PermissionStatus = {
  accessibilityTrusted: true,
  checkedAt: "",
};

const initialShortcut: ShortcutStateResponse = {
  binding: "Cmd+Shift+V",
  isRegistered: true,
  source: "default",
  version: 1,
};

const initialRuntimeState: RuntimeStateResponse = {
  presentationReason: "manual_open",
  lastDisplayId: "main",
  lastWindowMode: "small_window",
  fallbackReason: null,
  migrationPhase: "ready",
  isRecoveryMode: false,
  restoredFromSession: false,
  updatedAt: "",
};

interface FeedbackToast {
  createdAtMs: number;
  title: string;
  message: string;
  tone: "success" | "warning" | "copy";
  timeoutMs: number;
  detail?: string;
  undoToken?: string;
  action?: {
    label: string;
    kind: "copy_path" | "retry_diagnostics";
    value?: string;
  };
}

function buildActionToast(result: ClipboardActionResult): FeedbackToast {
  return {
    createdAtMs: Date.now(),
    title:
      result.mode === "direct_paste"
        ? result.degraded
          ? "已退化执行"
          : "已直接执行"
        : "已复制到剪贴板",
    message: result.message,
    tone: result.fallbackUsed ? "copy" : result.degraded ? "warning" : "success",
    timeoutMs: 3000,
  };
}

function buildDiagnosticsToast(result: DiagnosticsExportResponse): FeedbackToast {
  const isBrowserDownload = result.deliveryMode === "browser_download";

  return {
    createdAtMs: Date.now(),
    title: isBrowserDownload ? "诊断下载已开始" : "诊断已导出",
    message: isBrowserDownload
      ? "浏览器已开始下载诊断包。预览模式下无法回传最终保存目录。"
      : "诊断包已写入本地文件，可复制路径继续排障。",
    detail: isBrowserDownload ? result.fileName : result.filePath,
    tone: "success",
    timeoutMs: 6000,
    action: {
      label: isBrowserDownload ? "复制文件名" : "复制路径",
      kind: "copy_path",
      value: isBrowserDownload ? result.fileName : result.filePath,
    },
  };
}

async function writeTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("COPY_PATH_FAILED");
  }
}

function isTextInputElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

function buildReadOnlyToast(actionLabel: string): FeedbackToast {
  return {
    createdAtMs: Date.now(),
    title: `${actionLabel}已禁用`,
    message: "当前为只读模式，不会修改数据库，可继续浏览 / 搜索 / 复制 / 导出诊断。",
    tone: "warning",
    timeoutMs: 5000,
  };
}

function buildMigrationToast(): FeedbackToast {
  return {
    createdAtMs: Date.now(),
    title: "正在完成本地迁移",
    message: "迁移完成前暂不开放交互写操作，请稍候再试。",
    tone: "warning",
    timeoutMs: 5000,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function findViewportScrollAnchor(viewport: HTMLDivElement) {
  const rows = Array.from(
    viewport.querySelectorAll<HTMLElement>("[data-clipboard-row-id]"),
  );

  if (!rows.length) {
    return null;
  }

  const viewportTop = viewport.getBoundingClientRect().top;
  const firstVisible =
    rows.find((row) => row.getBoundingClientRect().bottom > viewportTop + 8) ?? rows[0];

  return firstVisible.dataset.clipboardRowId ?? null;
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function normalizeShortcutToken(token: string) {
  if (token === "Cmd") {
    return "Meta";
  }

  if (token === "Ctrl") {
    return "Control";
  }

  if (token === "Option") {
    return "Alt";
  }

  if (token === "Shift") {
    return "Shift";
  }

  if (token === "Space") {
    return " ";
  }

  return token.length === 1 ? token.toLowerCase() : token;
}

function matchesShortcutBinding(event: KeyboardEvent, binding: string) {
  const parts = binding.split("+").map(normalizeShortcutToken);
  const key = parts[parts.length - 1];

  return (
    event.metaKey === parts.includes("Meta") &&
    event.ctrlKey === parts.includes("Control") &&
    event.altKey === parts.includes("Alt") &&
    event.shiftKey === parts.includes("Shift") &&
    event.key.toLowerCase() === key.toLowerCase()
  );
}

function App() {
  const [query, setQuery] = useState("");
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [settings, setSettings] = useState<SettingsResponse>(initialSettings);
  const [shortcut, setShortcut] = useState<ShortcutStateResponse>(initialShortcut);
  const [rules, setRules] = useState<ExclusionRule[]>([]);
  const [permission, setPermission] = useState<PermissionStatus>(initialPermission);
  const [runtimeState, setRuntimeState] = useState<RuntimeStateResponse>(initialRuntimeState);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackToast | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const [isClearConfirming, setIsClearConfirming] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShellDismissed, setIsShellDismissed] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [scrollAnchor, setScrollAnchor] = useState<string | null>(null);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  const pendingSessionRestoreRef = useRef<Pick<
    SessionUiStateResponse,
    "selectedItemId" | "scrollAnchor"
  > | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setIsBootstrapping(true);

      try {
        const [
          nextSettings,
          nextRules,
          nextShortcut,
          nextPermission,
        ] = await Promise.all([
          settingsGet(),
          rulesList(),
          shortcutGet(),
          permissionCheckAccessibility(),
        ]);
        const nextRuntimeState = await windowPlacementRefresh().catch(() => runtimeStateGet());
        const nextSessionUiState = await sessionUiStateGet();

        if (!active) {
          return;
        }

        setSettings(nextSettings);
        setRules(nextRules.rules);
        setShortcut(nextShortcut);
        setPermission(nextPermission);
        setRuntimeState({
          ...nextRuntimeState,
          presentationReason: nextSessionUiState.presentationReason,
          restoredFromSession: nextSessionUiState.restoredFromSession,
        });
        setQuery(nextSessionUiState.query);
        setSelectedId(nextSessionUiState.selectedItemId ?? "");
        setScrollAnchor(nextSessionUiState.scrollAnchor);
        pendingSessionRestoreRef.current = {
          selectedItemId: nextSessionUiState.selectedItemId,
          scrollAnchor: nextSessionUiState.scrollAnchor,
        };
        setIsSessionHydrated(true);
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isSessionHydrated) {
      return;
    }

    let active = true;

    const syncRuntimeState = async () => {
      const nextRuntimeState = await runtimeStateGet();

      if (!active) {
        return;
      }

      setRuntimeState((current) => ({
        ...current,
        ...nextRuntimeState,
      }));
    };

    const handleFocus = () => {
      void syncRuntimeState();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, [isSessionHydrated]);

  useEffect(() => {
    let active = true;

    async function refreshClipboard() {
      const response = await clipboardSearch(deferredQuery);

      if (!active) {
        return;
      }

      setClipboardItems(response.results);
    }

    refreshClipboard();

    return () => {
      active = false;
    };
  }, [deferredQuery, refreshNonce]);

  useEffect(() => {
    const root = document.documentElement;

    if (settings.themeMode === "system") {
      delete root.dataset.themeMode;
      return;
    }

    root.dataset.themeMode = settings.themeMode;
  }, [settings.themeMode]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: Array<() => void> = [];
    let disposed = false;

    const syncRuntimeState = () => {
      void runtimeStateGet()
        .then((nextRuntimeState) => {
          if (disposed) {
            return;
          }

          setRuntimeState((current) => ({
            ...current,
            ...nextRuntimeState,
          }));
        })
        .catch(() => {});
    };

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        Promise.all([
          listen("app:show-settings", () => {
            if (!disposed) {
              setIsSettingsOpen(true);
            }
          }),
          listen("window-size-mode-changed", syncRuntimeState),
          listen("window-fallback-used", syncRuntimeState),
        ]),
      )
      .then((cleanupFns) => {
        if (disposed) {
          cleanupFns.forEach((cleanup) => {
            void cleanup();
          });
          return;
        }

        unlisten = cleanupFns;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten.forEach((cleanup) => {
        void cleanup();
      });
    };
  }, []);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = window.setTimeout(() => setFeedback(null), feedback.timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!feedback?.undoToken) {
      setUndoCountdown(0);
      return;
    }

    const syncCountdown = () => {
      const remainingMs = feedback.createdAtMs + feedback.timeoutMs - Date.now();
      setUndoCountdown(Math.max(0, Math.ceil(remainingMs / 1000)));
    };

    syncCountdown();
    const interval = window.setInterval(syncCountdown, 1000);

    return () => window.clearInterval(interval);
  }, [feedback]);

  useEffect(() => {
    if (!clipboardItems.length) {
      setSelectedId("");
      setScrollAnchor(null);
      return;
    }

    if (!clipboardItems.some((item) => item.id === selectedId)) {
      setSelectedId(clipboardItems[0].id);
    }
  }, [clipboardItems, selectedId]);

  useEffect(() => {
    setIsPreviewExpanded(false);
  }, [selectedId]);

  useEffect(() => {
    if (!isSessionHydrated) {
      return;
    }

    const viewport = listViewportRef.current;

    if (!viewport) {
      return;
    }

    const syncAnchor = () => {
      const nextAnchor = findViewportScrollAnchor(viewport);
      setScrollAnchor((current) => (current === nextAnchor ? current : nextAnchor));
    };

    syncAnchor();
    viewport.addEventListener("scroll", syncAnchor, { passive: true });

    return () => viewport.removeEventListener("scroll", syncAnchor);
  }, [clipboardItems, isSessionHydrated]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const viewport = listViewportRef.current;

    if (!viewport) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const row = viewport.querySelector<HTMLElement>(`[data-clipboard-row-id="${selectedId}"]`);
      row?.scrollIntoView({ block: "nearest" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedId]);

  useEffect(() => {
    const pendingRestore = pendingSessionRestoreRef.current;

    if (!pendingRestore || !clipboardItems.length) {
      return;
    }

    const viewport = listViewportRef.current;

    if (!viewport) {
      return;
    }

    const targetId = pendingRestore.scrollAnchor ?? pendingRestore.selectedItemId;

    if (!targetId) {
      pendingSessionRestoreRef.current = null;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const row = viewport.querySelector<HTMLElement>(`[data-clipboard-row-id="${targetId}"]`);
      row?.scrollIntoView({ block: "start" });
      pendingSessionRestoreRef.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [clipboardItems]);

  useEffect(() => {
    if (!isSessionHydrated) {
      return;
    }

    let active = true;

    void sessionUiStateUpdate({
      query,
      selectedItemId: selectedId || null,
      scrollAnchor,
      lastDisplayId: runtimeState.lastDisplayId,
      lastWindowMode: runtimeState.lastWindowMode,
    }).then((nextSessionUiState) => {
      if (!active) {
        return;
      }

      setRuntimeState((current) => ({
        ...current,
        presentationReason: nextSessionUiState.presentationReason,
        lastDisplayId: nextSessionUiState.lastDisplayId,
        lastWindowMode: nextSessionUiState.lastWindowMode,
        restoredFromSession: nextSessionUiState.restoredFromSession,
        updatedAt: nextSessionUiState.updatedAt,
      }));
    });

    return () => {
      active = false;
    };
  }, [isSessionHydrated, query, runtimeState.lastDisplayId, runtimeState.lastWindowMode, scrollAnchor, selectedId]);

  const selectedItem =
    clipboardItems.find((item) => item.id === selectedId) ?? clipboardItems[0] ?? null;

  const pinnedCount = clipboardItems.filter((item) => item.isPinned).length;
  const isRecoveryMode = runtimeState.isRecoveryMode;
  const isMigrationBlocking = runtimeState.migrationPhase === "migration_in_progress";
  const isLargeWindow = runtimeState.lastWindowMode === "large_window";
  const isFallbackWindow = runtimeState.lastWindowMode === "fallback_window";
  const SelectedKindIcon = selectedItem ? getClipboardIcon(selectedItem.kind) : FileImage;
  const selectedKindLabel = selectedItem ? getClipboardKindLabel(selectedItem.kind) : "Item";
  const primaryActionLabel = isRecoveryMode
    ? "仅复制"
    : selectedItem
      ? getKindActionLabel(selectedItem.kind, settings.defaultAction)
      : "直接粘贴";
  const permissionLabel = permission.accessibilityTrusted
    ? "Accessibility 已授权"
    : "Accessibility 未授权";
  const shellMaxWidthClass = isLargeWindow
    ? "max-w-[980px]"
    : isFallbackWindow
      ? "max-w-[960px]"
      : "max-w-[760px]";
  const workspaceGridClass = isLargeWindow
    ? "grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_330px] overflow-hidden"
    : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_278px] overflow-hidden";
  const functionPanelClass = isLargeWindow
    ? "mt-3 flex min-h-0 flex-1 flex-col rounded-[18px] border border-[var(--border)] bg-[var(--surface)]"
    : "mt-2 flex h-[58px] flex-none rounded-[16px] border border-[var(--border)] bg-[var(--surface)]";
  const detailCardClass = isLargeWindow
    ? "rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-3"
    : "rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-2.5";
  const previewShellClass = isLargeWindow
    ? "mt-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface-2)] p-2.5"
    : "mt-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] p-2";

  const functionItems = [
    {
      key: "settings",
      title: "设置",
      description: `${settings.themeMode} · ${settings.historyLimit} 条`,
      icon: Settings2,
    },
    {
      key: "diagnostics",
      title: "导出诊断",
      description: "日志与状态",
      icon: MonitorCog,
    },
    {
      key: "permission",
      title: "权限状态",
      description: permission.accessibilityTrusted
        ? "可直接粘贴"
        : "仅复制",
      icon: permission.accessibilityTrusted ? ShieldCheck : TriangleAlert,
    },
    {
      key: "clear",
      title: "清空历史",
      description: isRecoveryMode ? "已禁用" : "需确认",
      icon: Trash2,
      tone: "danger" as const,
      disabled: isRecoveryMode || isMigrationBlocking,
    },
  ];

  function enqueueRefresh() {
    setRefreshNonce((value) => value + 1);
  }

  function blockMutatingAction(actionLabel: string) {
    if (isMigrationBlocking) {
      setFeedback(buildMigrationToast());
      return true;
    }

    if (isRecoveryMode) {
      setFeedback(buildReadOnlyToast(actionLabel));
      return true;
    }

    return false;
  }

  function handleMutationError(error: unknown, actionLabel: string) {
    const message = getErrorMessage(error);

    if (message.includes("RECOVERY_MODE_READ_ONLY")) {
      setRuntimeState((current) => ({
        ...current,
        isRecoveryMode: true,
        migrationPhase: "recovery_mode",
      }));
      setFeedback(buildReadOnlyToast(actionLabel));
      return;
    }

    if (message.includes("LOGIN_ITEM_UPDATE_FAILED")) {
      setFeedback({
        createdAtMs: Date.now(),
        title: "登录启动更新失败",
        message: "系统登录项未更新，请稍后重试；当前不会影响应用继续使用。",
        tone: "warning",
        timeoutMs: 5000,
      });
      return;
    }

    if (message.includes("UNDO_EXPIRED")) {
      setFeedback({
        createdAtMs: Date.now(),
        title: "撤销已过期",
        message: "这条删除记录已超过 30 秒恢复窗口，无法继续恢复。",
        tone: "warning",
        timeoutMs: 5000,
      });
      return;
    }

    if (message.includes("RULE_DUPLICATE")) {
      return;
    }

    setFeedback({
      createdAtMs: Date.now(),
      title: `${actionLabel}失败`,
      message: "当前操作未完成，请重试。",
      tone: "warning",
      timeoutMs: 5000,
    });
  }

  function handleRecoveryGuide() {
    setFeedback({
      createdAtMs: Date.now(),
      title: "恢复模式说明",
      message: "为了保护已有历史记录，当前只开放浏览、搜索、复制和导出诊断。",
      tone: "warning",
      timeoutMs: 5000,
    });
  }

  async function handlePermissionGuide() {
    try {
      const opened = await permissionOpenAccessibility();

      if (opened) {
        setFeedback({
          createdAtMs: Date.now(),
          title: "已打开系统设置",
          message: "在隐私与安全性 > 辅助功能中为 SuperClip 授权。",
          tone: "success",
          timeoutMs: 5000,
        });
        return;
      }

      setFeedback({
        createdAtMs: Date.now(),
        title: "当前为预览环境",
        message: "浏览器预览无法直接打开系统设置；Tauri 宿主中会跳转到 Accessibility。",
        tone: "warning",
        timeoutMs: 5000,
      });
    } catch {
      setFeedback({
        createdAtMs: Date.now(),
        title: "打开系统设置失败",
        message: "可继续搜索、浏览和仅复制。",
        tone: "warning",
        timeoutMs: 5000,
      });
    }
  }

  async function handleShellDismiss() {
    setIsClearConfirming(false);

    if (isTauriRuntime()) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().hide();
        return;
      } catch {
        setFeedback({
          createdAtMs: Date.now(),
          title: "宿主关闭失败",
          message: "当前窗口未能隐藏，已退化为预览内的模拟关闭。",
          tone: "warning",
          timeoutMs: 4000,
        });
      }
    }

    setIsShellDismissed(true);
  }

  function handleShellRestore() {
    setIsShellDismissed(false);
  }

  async function handlePrimaryAction() {
    if (!selectedItem) {
      return;
    }

    try {
      if (isMigrationBlocking) {
        setFeedback(buildMigrationToast());
        return;
      }

      if (isRecoveryMode) {
        const result = await clipboardCopy(selectedItem.id);
        setFeedback({
          ...buildActionToast(result),
          title: "恢复模式已复制",
          message: "只读模式下已改为仅复制。",
          tone: "warning",
        });
        return;
      }

      const result =
        settings.defaultAction === "copy_only"
          ? await clipboardCopy(selectedItem.id)
          : await clipboardPaste(selectedItem.id);

      setFeedback(buildActionToast(result));
    } catch (error) {
      handleMutationError(error, settings.defaultAction === "copy_only" ? "复制" : "直接粘贴");
    }
  }

  async function handleCopyAction() {
    if (!selectedItem) {
      return;
    }

    try {
      if (isMigrationBlocking) {
        setFeedback(buildMigrationToast());
        return;
      }

      const result = await clipboardCopy(selectedItem.id);
      setFeedback(buildActionToast(result));
    } catch (error) {
      handleMutationError(error, "复制");
    }
  }

  async function handleAlternateAction() {
    if (!selectedItem) {
      return;
    }

    try {
      if (isMigrationBlocking) {
        setFeedback(buildMigrationToast());
        return;
      }

      if (isRecoveryMode) {
        await handleCopyAction();
        return;
      }

      if (selectedItem.kind === "file") {
        await handleCopyAction();
        return;
      }

      if (settings.defaultAction === "copy_only") {
        const result = await clipboardPaste(selectedItem.id);
        setFeedback(buildActionToast(result));
        return;
      }

      await handleCopyAction();
    } catch (error) {
      handleMutationError(error, settings.defaultAction === "copy_only" ? "直接粘贴" : "复制");
    }
  }

  async function handlePinToggle() {
    if (!selectedItem) {
      return;
    }

    if (blockMutatingAction(selectedItem.isPinned ? "取消置顶" : "置顶")) {
      return;
    }

    try {
      const result = selectedItem.isPinned
        ? await clipboardUnpin(selectedItem.id)
        : await clipboardPin(selectedItem.id);

      enqueueRefresh();
      setSelectedId(result.item.id);
      setFeedback({
        createdAtMs: Date.now(),
        title: result.item.isPinned ? "已置顶记录" : "已取消置顶",
        message: result.item.isPinned
          ? `${result.item.title} 已固定到列表顶部。`
          : `${result.item.title} 已回到普通历史排序。`,
        tone: "success",
        timeoutMs: 3000,
      });
    } catch (error) {
      handleMutationError(error, selectedItem.isPinned ? "取消置顶" : "置顶");
    }
  }

  async function handleDeleteAction() {
    if (!selectedItem) {
      return;
    }

    if (blockMutatingAction("删除")) {
      return;
    }

    try {
      const deletedTitle = selectedItem.title;
      const result = await clipboardDelete(selectedItem.id);

      enqueueRefresh();
      setIsClearConfirming(false);
      setFeedback({
        createdAtMs: Date.now(),
        title: "已删除记录",
        message: `${deletedTitle} 已移出历史列表，30 秒内可撤销。`,
        tone: "warning",
        timeoutMs: 30000,
        undoToken: result.undoToken,
      });
    } catch (error) {
      handleMutationError(error, "删除");
    }
  }

  async function handleRestoreAction() {
    if (!feedback?.undoToken) {
      return;
    }

    try {
      const result = await clipboardRestore(feedback.undoToken);

      enqueueRefresh();
      setSelectedId(result.item.id);
      setFeedback({
        createdAtMs: Date.now(),
        title: "已恢复记录",
        message: `${result.item.title} 已返回历史列表。`,
        tone: "success",
        timeoutMs: 3000,
      });
    } catch (error) {
      handleMutationError(error, "恢复");
    }
  }

  async function handleClearHistory() {
    if (blockMutatingAction("清空历史")) {
      return;
    }

    try {
      const result = await clipboardClear();

      enqueueRefresh();
      setSelectedId("");
      setIsClearConfirming(false);
      setFeedback({
        createdAtMs: Date.now(),
        title: "历史已清空",
        message: `已清除 ${result.clearedCount} 条记录。`,
        tone: "success",
        timeoutMs: 3000,
      });
    } catch (error) {
      handleMutationError(error, "清空历史");
    }
  }

  async function handleMonitorToggle(nextState: boolean) {
    if (blockMutatingAction("监听状态切换")) {
      return;
    }

    try {
      const response = await monitorToggle(nextState);
      setIsMonitoring(response.isMonitoring);
    } catch (error) {
      handleMutationError(error, "监听状态切换");
    }
  }

  async function handleSettingsUpdate(patch: SettingsUpdatePayload) {
    if (blockMutatingAction("设置更新")) {
      return;
    }

    try {
      const nextSettings = await settingsUpdate(patch);
      setSettings(nextSettings);
    } catch (error) {
      handleMutationError(error, "设置更新");
      throw error;
    }
  }

  async function handleDiagnosticsAction() {
    try {
      const response = await diagnosticsExport();
      setFeedback(buildDiagnosticsToast(response));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        createdAtMs: Date.now(),
        title: "诊断导出失败",
        message: message.includes("DIAGNOSTICS_EXPORT_FAILED")
          ? "诊断文件写入失败，请检查保存目录权限后重试。"
          : "诊断导出未完成，请重试。",
        tone: "warning",
        timeoutMs: 5000,
        action: {
          label: "重试",
          kind: "retry_diagnostics",
        },
      });
    }
  }

  async function handleRuleUpsert(payload: RulesUpsertPayload) {
    if (blockMutatingAction(payload.id ? "规则更新" : "规则新增")) {
      return;
    }

    try {
      const response = await rulesUpsert(payload);

      setRules((currentRules) => {
        const remaining = currentRules.filter((rule) => rule.id !== response.rule.id);
        const nextRules = [response.rule, ...remaining];

        return [...nextRules].sort((left, right) => {
          const enabledDelta = Number(right.enabled) - Number(left.enabled);

          if (enabledDelta !== 0) {
            return enabledDelta;
          }

          return left.kind.localeCompare(right.kind) || left.value.localeCompare(right.value);
        });
      });

      setFeedback({
        createdAtMs: Date.now(),
        title: payload.id ? "排除规则已更新" : "排除规则已创建",
        message: `${response.rule.value} 已纳入 ${response.rule.kind} 规则集。`,
        tone: "success",
        timeoutMs: 3000,
      });
    } catch (error) {
      handleMutationError(error, payload.id ? "规则更新" : "规则新增");
      throw error;
    }
  }

  async function handleRuleDelete(ruleId: string) {
    if (blockMutatingAction("规则删除")) {
      return;
    }

    try {
      await rulesDelete(ruleId);
      setRules((currentRules) => currentRules.filter((rule) => rule.id !== ruleId));
      setFeedback({
        createdAtMs: Date.now(),
        title: "排除规则已删除",
        message: "该规则已从本地规则集中移除。",
        tone: "success",
        timeoutMs: 3000,
      });
    } catch (error) {
      handleMutationError(error, "规则删除");
      throw error;
    }
  }

  async function handleRulesClear() {
    if (blockMutatingAction("规则清空")) {
      return;
    }

    try {
      const response = await rulesClear();
      setRules([]);
      setFeedback({
        createdAtMs: Date.now(),
        title: "排除规则已清空",
        message: `已清除 ${response.clearedCount} 条规则。`,
        tone: "warning",
        timeoutMs: 3000,
      });
    } catch (error) {
      handleMutationError(error, "规则清空");
      throw error;
    }
  }

  async function handleShortcutStart() {
    if (blockMutatingAction("快捷键录入")) {
      return;
    }

    try {
      const response = await shortcutStartRecording();
      setShortcut({
        binding: response.binding,
        isRegistered: response.isRegistered,
        source: response.source,
        version: response.version,
      });
    } catch (error) {
      handleMutationError(error, "快捷键录入");
      throw error;
    }
  }

  async function handleShortcutCancel() {
    const response = await shortcutCancelRecording();
    setShortcut({
      binding: response.binding,
      isRegistered: response.isRegistered,
      source: response.source,
      version: response.version,
    });
  }

  async function handleShortcutValidate(binding: string): Promise<ShortcutValidationResponse> {
    return shortcutValidate(binding);
  }

  async function handleShortcutUpdate(binding: string) {
    if (blockMutatingAction("快捷键更新")) {
      return;
    }

    try {
      const response = await shortcutUpdate(binding);
      setShortcut(response);
      setFeedback({
        createdAtMs: Date.now(),
        title: "快捷键已更新",
        message: `新的全局快捷键已设置为 ${response.binding}。`,
        tone: "success",
        timeoutMs: 3000,
      });
    } catch (error) {
      handleMutationError(error, "快捷键更新");
      throw error;
    }
  }

  async function handleShortcutRestoreDefault() {
    if (blockMutatingAction("快捷键恢复默认")) {
      return;
    }

    try {
      const response = await shortcutRestoreDefault();
      setShortcut(response);
      setFeedback({
        createdAtMs: Date.now(),
        title: "已恢复默认快捷键",
        message: `当前绑定已恢复为 ${response.binding}。`,
        tone: "success",
        timeoutMs: 3000,
      });
    } catch (error) {
      handleMutationError(error, "快捷键恢复默认");
      throw error;
    }
  }

  async function handleFeedbackAction() {
    if (!feedback?.action) {
      return;
    }

    if (feedback.action.kind === "retry_diagnostics") {
      await handleDiagnosticsAction();
      return;
    }

    if (!feedback.action.value) {
      return;
    }

    try {
      await writeTextToClipboard(feedback.action.value);
      setFeedback({
        createdAtMs: Date.now(),
        title: feedback.action.label === "复制文件名" ? "文件名已复制" : "路径已复制",
        message: "可用于排障记录。",
        detail: feedback.action.value,
        tone: "copy",
        timeoutMs: 3000,
      });
    } catch {
      setFeedback({
        createdAtMs: Date.now(),
        title: "复制失败",
        message: "当前环境无法写入剪贴板，请手动复制下方路径或文件名。",
        detail: feedback.action.value,
        tone: "warning",
        timeoutMs: 5000,
      });
    }
  }

  function handleUtilityAction(key: string) {
    if (key === "clear") {
      if (blockMutatingAction("清空历史")) {
        return;
      }

      setIsClearConfirming(true);
      return;
    }

    if (key === "settings") {
      setIsSettingsOpen(true);
      return;
    }

    if (key === "diagnostics") {
      void handleDiagnosticsAction();
      return;
    }

    if (!permission.accessibilityTrusted) {
      void handlePermissionGuide();
      return;
    }

    setFeedback({
      createdAtMs: Date.now(),
      title: "权限状态正常",
      message: "直接粘贴可用。",
      tone: "success",
      timeoutMs: 3000,
    });
  }

  useEffect(() => {
    if (!isShellDismissed) {
      return;
    }

    function handleDismissedShortcut(event: KeyboardEvent) {
      if (event.isComposing) {
        return;
      }

      if (!matchesShortcutBinding(event, shortcut.binding)) {
        return;
      }

      event.preventDefault();
      setIsShellDismissed(false);
    }

    window.addEventListener("keydown", handleDismissedShortcut);
    return () => window.removeEventListener("keydown", handleDismissedShortcut);
  }, [isShellDismissed, shortcut.binding]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.isComposing || isSettingsOpen || isShellDismissed || !clipboardItems.length) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();

        const currentIndex = clipboardItems.findIndex((item) => item.id === selectedItem?.id);
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex =
          event.key === "ArrowDown"
            ? (safeIndex + 1) % clipboardItems.length
            : (safeIndex - 1 + clipboardItems.length) % clipboardItems.length;

        setSelectedId(clipboardItems[nextIndex].id);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void (event.metaKey ? handleAlternateAction() : handlePrimaryAction());
        return;
      }

      if (event.code === "Space" && !isTextInputElement(event.target) && selectedItem?.kind !== "image") {
        event.preventDefault();
        setIsPreviewExpanded((value) => !value);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && !isTextInputElement(event.target)) {
        event.preventDefault();
        void handleDeleteAction();
        return;
      }

      if (event.key === "Escape" && isPreviewExpanded) {
        event.preventDefault();
        setIsPreviewExpanded(false);
        return;
      }

      if (event.key === "Escape" && query) {
        event.preventDefault();
        setQuery("");
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        void handleShellDismiss();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    clipboardItems,
    isMigrationBlocking,
    isPreviewExpanded,
    isRecoveryMode,
    isShellDismissed,
    isSettingsOpen,
    query,
    selectedItem,
    settings.defaultAction,
  ]);

  return (
    <TooltipProvider delayDuration={180}>
      <main className="h-screen overflow-hidden p-3 text-[var(--text-primary)]">
        {isShellDismissed ? (
          <section className="mx-auto flex h-full w-full max-w-[420px] items-center justify-center">
            <div className="w-full rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-6 py-7 text-center shadow-[0_18px_48px_rgba(25,31,38,0.12)]">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[16px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--accent)]">
                <AppWindow className="h-5 w-5" />
              </div>
              <h1 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">
                面板已隐藏
              </h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                按 {shortcut.binding} 或点击按钮恢复。
              </p>
              <Button className="mt-5 w-full" onClick={handleShellRestore} autoFocus>
                <ArrowUpRight className="h-4 w-4" />
                打开面板
              </Button>
            </div>
          </section>
        ) : (
        <section
          className={`relative mx-auto flex h-full w-full ${shellMaxWidthClass} flex-col overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_54px_rgba(25,31,38,0.12)] backdrop-blur-xl`}
        >
          <header className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                  <AppWindow className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-[18px] font-semibold leading-none text-[var(--text-primary)]">
                    SuperClip
                  </h1>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">本地 · 快捷 · 固定窗口</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                <StatusPill
                  tone={isMonitoring ? "success" : "warning"}
                  label={isMonitoring ? "正在监听" : "已暂停监听"}
                  icon={Sparkle}
                />
                <StatusPill tone="neutral" label={permissionLabel} icon={LockKeyhole} />
                <StatusPill
                  tone="neutral"
                  label={settings.defaultAction === "copy_only" ? "默认复制" : "默认粘贴"}
                  icon={ArrowUpRight}
                />
                <Button variant="ghost" size="sm" onClick={() => void handleShellDismiss()}>
                  关闭
                </Button>
              </div>
            </div>

            <label className="flex h-11 items-center gap-3 rounded-[16px] border border-[var(--border-strong)] bg-white px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-colors focus-within:bg-[var(--surface)]">
              <Search className="h-4 w-4 text-[var(--text-tertiary)]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  startTransition(() => {
                    setQuery(nextValue);
                  });
                }}
                placeholder="搜索剪贴板、来源应用、文件名"
                className="w-full bg-transparent text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
              <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] sm:inline-flex">
                {shortcut.binding}
              </span>
            </label>
          </header>

          {!permission.accessibilityTrusted || isRecoveryMode || isFallbackWindow ? (
            <div className="space-y-2 border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
              {!permission.accessibilityTrusted ? (
                <div className="flex flex-col gap-3 rounded-[18px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 min-[920px]:flex-row min-[920px]:items-center min-[920px]:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--warning-text)]">
                      需要 Accessibility 才能直接粘贴
                    </p>
                    <p className="mt-1 text-sm text-[var(--warning-text)]">当前仍可搜索和复制。</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void handlePermissionGuide()}>
                    <LockKeyhole className="h-4 w-4" />
                    打开系统设置
                  </Button>
                </div>
              ) : null}

              {isRecoveryMode ? (
                <div className="flex flex-col gap-3 rounded-[18px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 min-[920px]:flex-row min-[920px]:items-center min-[920px]:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--warning-text)]">恢复模式</p>
                    <p className="mt-1 text-sm text-[var(--warning-text)]">只开放浏览、搜索、复制和诊断。</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" size="sm" onClick={() => void handleDiagnosticsAction()}>
                      <MonitorCog className="h-4 w-4" />
                      导出诊断
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleRecoveryGuide}>
                      查看恢复说明
                    </Button>
                  </div>
                </div>
              ) : null}

              {isFallbackWindow ? (
                <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  已切换为居中窗口。
                  {runtimeState.fallbackReason ? ` ${runtimeState.fallbackReason}` : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={workspaceGridClass}>
            <section className="flex min-h-0 flex-col px-3.5 py-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">历史</h2>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {isBootstrapping
                      ? "加载中"
                      : `${clipboardItems.length} 条 · 置顶优先`}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]"
                    >
                      <Pin className="h-3.5 w-3.5" />
                      {pinnedCount}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    置顶项数量
                  </TooltipContent>
                </Tooltip>
              </div>

              <ScrollArea className="min-h-0 flex-1 pr-1" viewportRef={listViewportRef}>
                <div className="space-y-2 pb-2 pr-2">
                  {clipboardItems.length ? (
                    clipboardItems.map((item) => (
                      <HistoryRow
                        key={item.id}
                        item={item}
                        rowId={item.id}
                        selected={item.id === selectedItem?.id}
                        onSelect={setSelectedId}
                      />
                    ))
                  ) : isRecoveryMode ? (
                    <div className="rounded-[20px] border border-dashed border-[var(--warning-border)] bg-[var(--warning-bg)] px-5 py-10 text-center">
                      <p className="text-base font-semibold text-[var(--warning-text)]">恢复模式</p>
                      <p className="mt-2 text-sm text-[var(--warning-text)]">只开放浏览、搜索、复制和诊断。</p>
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                        <Button size="sm" onClick={() => void handleDiagnosticsAction()}>
                          导出诊断
                        </Button>
                        <Button size="sm" variant="secondary" onClick={handleRecoveryGuide}>
                          查看恢复说明
                        </Button>
                      </div>
                    </div>
                  ) : runtimeState.presentationReason === "no_history" ? (
                    <div className="rounded-[20px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-5 py-10 text-center">
                      <p className="text-base font-semibold text-[var(--text-primary)]">还没有记录</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">复制内容后会出现在这里。</p>
                    </div>
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-5 py-10 text-center">
                      <p className="text-base font-semibold text-[var(--text-primary)]">没找到匹配项</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">试试更短的关键词。</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-5"
                        onClick={() => setQuery("")}
                      >
                        清空搜索
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-3.5">
              <div className={detailCardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
                        {selectedItem?.title ?? "选择一条记录"}
                      </h2>
                      {selectedItem?.isPinned ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                          <Pin className="h-3 w-3" />
                          置顶
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--text-tertiary)]">
                      {selectedItem ? `${selectedItem.sourceApp} · ${selectedItem.timeLabel}` : "无选中项"}
                    </p>
                    {isLargeWindow ? (
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {selectedItem?.meta ?? "左侧选择后预览"}
                      </p>
                    ) : null}
                  </div>
                  {isLargeWindow ? (
                    <StatusPill tone="neutral" label={selectedKindLabel} icon={SelectedKindIcon} />
                  ) : null}
                </div>

                <div className={previewShellClass}>
                  {selectedItem?.kind === "image" ? (
                    <div className="flex aspect-[16/10] items-center justify-center rounded-[16px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)]">
                      <div className="text-center">
                        <FileImage className="mx-auto h-8 w-8 text-[var(--text-secondary)]" />
                        <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">图片预览</p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">支持时直接粘贴</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[13px] border border-transparent bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={`min-w-0 flex-1 whitespace-pre-wrap leading-5 ${
                            isPreviewExpanded || isLargeWindow ? "" : "line-clamp-2"
                          }`}
                        >
                          {selectedItem?.preview ?? "暂无预览。"}
                        </p>
                        {selectedItem && isLargeWindow ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0"
                            onClick={() => setIsPreviewExpanded((value) => !value)}
                          >
                            {isPreviewExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {isPreviewExpanded ? "收起" : "展开"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {isLargeWindow ? (
                    <div className="mt-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                      {!selectedItem
                        ? "选择记录后显示动作边界。"
                        : selectedItem.kind === "file"
                        ? "文件固定仅复制。"
                        : selectedItem.kind === "image"
                          ? "图片粘贴失败会回退复制。"
                          : selectedItem.kind === "html" || selectedItem.kind === "rtf"
                            ? "富文本可退化为纯文本。"
                            : "文本优先直接粘贴。"}
                    </div>
                  ) : null}
                </div>

                {isRecoveryMode ? (
                  <div className="mt-3 rounded-[16px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning-text)]">
                    只读模式：写操作已禁用。
                  </div>
                ) : null}

                <div className="mt-2 grid gap-1.5">
                  <Button className="h-8 w-full" onClick={handlePrimaryAction} disabled={!selectedItem || isMigrationBlocking}>
                    {isRecoveryMode ? <Copy className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    {primaryActionLabel}
                  </Button>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 px-2 text-[11px]"
                      onClick={isRecoveryMode ? () => void handleDiagnosticsAction() : handleCopyAction}
                      disabled={isMigrationBlocking || (!selectedItem && !isRecoveryMode)}
                    >
                      {isRecoveryMode ? <MonitorCog className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {isRecoveryMode ? "诊断" : "复制"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[11px]"
                      onClick={handlePinToggle}
                      disabled={!selectedItem || isRecoveryMode || isMigrationBlocking}
                    >
                      <Pin className="h-4 w-4" />
                      {selectedItem?.isPinned ? "取消" : "置顶"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[11px]"
                      onClick={handleDeleteAction}
                      disabled={!selectedItem || isRecoveryMode || isMigrationBlocking}
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </Button>
                  </div>
                </div>
              </div>

              <div className={functionPanelClass}>
                {isLargeWindow ? (
                  <>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div>
                        <h2 className="text-sm font-semibold text-[var(--text-primary)]">工具</h2>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">设置、诊断、权限</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5">
                        <Switch
                          checked={isMonitoring}
                          disabled={isRecoveryMode || isMigrationBlocking}
                          onCheckedChange={handleMonitorToggle}
                        />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {isMonitoring ? "监听中" : "已暂停"}
                        </span>
                      </div>
                    </div>

                    <ScrollArea className="min-h-0 flex-1 px-2">
                      <div className="grid grid-cols-2 gap-1.5 p-1.5">
                        {functionItems.map((item) => (
                          <button
                            key={item.title}
                            type="button"
                            onClick={() => handleUtilityAction(item.key)}
                            disabled={item.disabled}
                            className={`flex w-full items-center gap-2 rounded-[12px] border border-transparent bg-transparent px-2.5 py-2 text-left transition-colors ${
                              item.disabled
                                ? "cursor-not-allowed opacity-60"
                                : "hover:border-[var(--border)] hover:bg-[var(--surface-2)]"
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border ${
                                item.tone === "danger"
                                  ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]"
                                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--accent)]"
                              }`}
                            >
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-[var(--text-primary)]">{item.title}</p>
                              <p className="truncate text-[11px] text-[var(--text-secondary)]">
                                {item.description}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="grid h-full grid-cols-4 gap-1 p-1.5">
                    {functionItems.map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => handleUtilityAction(item.key)}
                        disabled={item.disabled}
                        className={`grid min-w-0 place-items-center rounded-[12px] border text-[10px] font-medium transition-colors ${
                          item.disabled
                            ? "cursor-not-allowed border-transparent opacity-50"
                            : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                        }`}
                        title={item.title}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="max-w-full truncate">{item.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {isClearConfirming ? (
                  <div className="border-t border-[var(--border)] px-5 py-4">
                    <div className="rounded-[16px] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-4">
                      <p className="text-sm font-medium text-[var(--danger-text)]">确认清空全部历史？</p>
                      <p className="mt-2 text-sm text-[var(--warning-text)]">不会改动系统当前剪贴板。</p>
                      <div className="mt-4 flex items-center gap-3">
                        <Button size="sm" onClick={handleClearHistory}>
                          确认清空
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setIsClearConfirming(false)}>
                          取消
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          {isMigrationBlocking ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(17,22,30,0.42)] px-6 backdrop-blur-sm">
              <div className="w-full max-w-[420px] rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-6 py-6 text-center shadow-[0_24px_80px_rgba(17,22,30,0.22)]">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[16px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--accent)]">
                  <MonitorCog className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">正在完成本地迁移</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">完成前暂不开放写操作。</p>
              </div>
            </div>
          ) : null}

          <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1">
                <Keyboard className="h-3.5 w-3.5" />
                ↑↓ 切换
              </span>
              <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1">
                Enter 默认动作
              </span>
              <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1">
                Cmd+Enter 相反动作
              </span>
              <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1">
                Space 摘要展开
              </span>
              <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1">
                Esc 关闭
              </span>
            </div>
            <div className="shrink-0 text-[11px] leading-5 text-[var(--text-secondary)]">
              本地运行，不上传内容。
            </div>
          </footer>
        </section>
        )}

        {isSettingsOpen ? (
          <SettingsShell
            settings={settings}
            shortcut={shortcut}
            rules={rules}
            pinnedCount={pinnedCount}
            permissionTrusted={permission.accessibilityTrusted}
            readOnlyMode={isRecoveryMode || isMigrationBlocking}
            onClose={() => setIsSettingsOpen(false)}
            onUpdate={handleSettingsUpdate}
            onDiagnosticsClick={() => void handleDiagnosticsAction()}
            onPermissionGuideClick={() => void handlePermissionGuide()}
            onRuleUpsert={handleRuleUpsert}
            onRuleDelete={handleRuleDelete}
            onRulesClear={handleRulesClear}
            onShortcutStart={handleShortcutStart}
            onShortcutCancel={handleShortcutCancel}
            onShortcutValidate={handleShortcutValidate}
            onShortcutUpdate={handleShortcutUpdate}
            onShortcutRestoreDefault={handleShortcutRestoreDefault}
          />
        ) : null}

        {feedback ? (
          <div className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[0_18px_50px_rgba(19,24,30,0.18)] backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-[var(--surface-2)] p-2 text-[var(--accent)]">
                {feedback.tone === "copy" ? (
                  <Copy className="h-4 w-4" />
                ) : feedback.tone === "warning" ? (
                  <TriangleAlert className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)]">{feedback.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{feedback.message}</p>
                {feedback.detail ? (
                  <div className="mt-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                    <code className="break-all font-mono">{feedback.detail}</code>
                  </div>
                ) : null}
                {feedback.undoToken ? (
                  <div className="mt-3 flex items-center gap-3">
                    <Button size="sm" variant="secondary" onClick={handleRestoreAction} disabled={undoCountdown <= 0}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      撤销
                    </Button>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      还可撤销 {undoCountdown}s
                    </span>
                  </div>
                ) : feedback.action ? (
                  <div className="mt-3 flex items-center gap-3">
                    <Button size="sm" variant="secondary" onClick={() => void handleFeedbackAction()}>
                      {feedback.action.kind === "retry_diagnostics" ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {feedback.action.label}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </TooltipProvider>
  );
}

export default App;
