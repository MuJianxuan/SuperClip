import { invoke } from "@tauri-apps/api/core";
import type { ClipboardItem, ClipboardKind } from "../components/history-row";

interface CommandMap {
  clipboardSearch: "clipboard_search";
  clipboardList: "clipboard_list";
  clipboardGet: "clipboard_get";
  clipboardCopy: "clipboard_copy";
  clipboardPaste: "clipboard_paste";
  clipboardPin: "clipboard_pin";
  clipboardUnpin: "clipboard_unpin";
  clipboardDelete: "clipboard_delete";
  clipboardRestore: "clipboard_restore";
  clipboardClear: "clipboard_clear";
  settingsGet: "settings_get";
  settingsUpdate: "settings_update";
  rulesList: "rules_list";
  rulesUpsert: "rules_upsert";
  rulesDelete: "rules_delete";
  rulesClear: "rules_clear";
  sessionUiStateGet: "session_ui_state_get";
  sessionUiStateUpdate: "session_ui_state_update";
  runtimeStateGet: "runtime_state_get";
  windowPlacementRefresh: "window_placement_refresh";
  diagnosticsExport: "diagnostics_export";
  shortcutGet: "shortcut_get";
  shortcutStartRecording: "shortcut_start_recording";
  shortcutCancelRecording: "shortcut_cancel_recording";
  shortcutValidate: "shortcut_validate";
  shortcutUpdate: "shortcut_update";
  shortcutRestoreDefault: "shortcut_restore_default";
  permissionCheckAccessibility: "permission_check_accessibility";
  permissionOpenAccessibility: "permission_open_accessibility";
  showMain: "show_main";
  previewShow: "preview_show";
  previewHide: "preview_hide";
  popupReady: "popup_ready";
  quickPanelReady: "quick_panel_ready";
  mainWindowReady: "main_window_ready";
  systemAppearanceGet: "system_appearance_get";
  monitorToggle: "monitor_toggle";
  monitorStatusGet: "monitor_status_get";
  appQuit: "app_quit";
  quickPanelHide: "quick_panel_hide";
}

const COMMANDS: CommandMap = {
  clipboardSearch: "clipboard_search",
  clipboardList: "clipboard_list",
  clipboardGet: "clipboard_get",
  clipboardCopy: "clipboard_copy",
  clipboardPaste: "clipboard_paste",
  clipboardPin: "clipboard_pin",
  clipboardUnpin: "clipboard_unpin",
  clipboardDelete: "clipboard_delete",
  clipboardRestore: "clipboard_restore",
  clipboardClear: "clipboard_clear",
  settingsGet: "settings_get",
  settingsUpdate: "settings_update",
  rulesList: "rules_list",
  rulesUpsert: "rules_upsert",
  rulesDelete: "rules_delete",
  rulesClear: "rules_clear",
  sessionUiStateGet: "session_ui_state_get",
  sessionUiStateUpdate: "session_ui_state_update",
  runtimeStateGet: "runtime_state_get",
  windowPlacementRefresh: "window_placement_refresh",
  diagnosticsExport: "diagnostics_export",
  shortcutGet: "shortcut_get",
  shortcutStartRecording: "shortcut_start_recording",
  shortcutCancelRecording: "shortcut_cancel_recording",
  shortcutValidate: "shortcut_validate",
  shortcutUpdate: "shortcut_update",
  shortcutRestoreDefault: "shortcut_restore_default",
  permissionCheckAccessibility: "permission_check_accessibility",
  permissionOpenAccessibility: "permission_open_accessibility",
  showMain: "show_main",
  previewShow: "preview_show",
  previewHide: "preview_hide",
  popupReady: "popup_ready",
  quickPanelReady: "quick_panel_ready",
  mainWindowReady: "main_window_ready",
  systemAppearanceGet: "system_appearance_get",
  monitorToggle: "monitor_toggle",
  monitorStatusGet: "monitor_status_get",
  appQuit: "app_quit",
  quickPanelHide: "quick_panel_hide",
};

export interface ClipboardSearchResponse {
  query: string;
  normalizedQuery: string;
  results: ClipboardItem[];
  total: number;
  searchTimeMs: number;
  version: number;
}

export interface ClipboardPayloadSnapshot {
  textPlain: string | null;
  textHtml: string | null;
  textRtf: string | null;
  imageBytes: number[] | null;
  imageWidth: number | null;
  imageHeight: number | null;
  fileUrls: string[] | null;
  extraJson: unknown | null;
}

export interface ClipboardItemDetail {
  item: ClipboardItem;
  payload: ClipboardPayloadSnapshot;
  version: number;
}

export interface SettingsResponse {
  schemaVersion: number;
  exposedKeys: string[];
  reservedKeys: string[];
  defaultAction: "direct_paste" | "copy_only";
  themeMode: "light" | "dark" | "system";
  historyLimit: number;
  listFontSize: number;
  launchAtLogin: boolean;
  showOnStartup: boolean;
}

export interface PermissionStatus {
  accessibilityTrusted: boolean;
  checkedAt: string;
}

export interface MonitorStatus {
  isMonitoring: boolean;
}

export type PresentationReason =
  | "manual_open"
  | "startup_autoshow"
  | "no_history"
  | "search_empty"
  | "recovery_mode";

export type WindowMode = "small_window" | "large_window" | "fallback_window";
export type MigrationPhase = "ready" | "migration_in_progress" | "recovery_mode";

export interface RuntimeStateResponse {
  presentationReason: PresentationReason;
  lastDisplayId: string;
  lastWindowMode: WindowMode;
  fallbackReason: string | null;
  migrationPhase: MigrationPhase;
  isRecoveryMode: boolean;
  restoredFromSession: boolean;
  updatedAt: string;
}

export interface SessionUiStateResponse {
  query: string;
  selectedItemId: string | null;
  scrollAnchor: string | null;
  layoutSidebarWidthPx: number | null;
  presentationReason: PresentationReason;
  lastDisplayId: string;
  lastWindowMode: WindowMode;
  restoredFromSession: boolean;
  updatedAt: string;
}

export interface SessionUiStateUpdatePayload {
  query: string;
  selectedItemId: string | null;
  scrollAnchor: string | null;
  layoutSidebarWidthPx: number | null;
  lastDisplayId: string;
  lastWindowMode: WindowMode;
}

export interface ClipboardActionResult {
  itemId: string;
  status: "completed";
  mode: "direct_paste" | "copy_only";
  message: string;
  fallbackUsed: boolean;
  degraded: boolean;
  errorCode?: string | null;
}

export interface ClipboardPinResult {
  item: ClipboardItem;
  version: number;
}

export interface ClipboardDeleteResult {
  itemId: string;
  undoToken: string;
  expiresAt: string;
  version: number;
}

export interface ClipboardRestoreResult {
  item: ClipboardItem;
  version: number;
}

export interface ClipboardClearResult {
  clearedCount: number;
  version: number;
}

export interface SettingsUpdatePayload {
  defaultAction?: SettingsResponse["defaultAction"];
  themeMode?: SettingsResponse["themeMode"];
  historyLimit?: number;
  listFontSize?: number;
  launchAtLogin?: boolean;
  showOnStartup?: boolean;
}

export type ExclusionRuleKind = "bundle_id" | "content_kind" | "keyword";

export interface ExclusionRule {
  id: string;
  kind: ExclusionRuleKind;
  value: string;
  enabled: boolean;
  version: number;
}

export interface RulesListResponse {
  rules: ExclusionRule[];
  total: number;
  enabledCount: number;
  version: number;
}

export interface RulesUpsertPayload {
  id?: string;
  kind: ExclusionRuleKind;
  value: string;
  enabled: boolean;
}

export interface RulesUpsertResponse {
  rule: ExclusionRule;
  version: number;
}

export interface RulesDeleteResponse {
  ruleId: string;
  version: number;
}

export interface RulesClearResponse {
  clearedCount: number;
  version: number;
}

export type DiagnosticsSection =
  | "app_info"
  | "os_info"
  | "permissions"
  | "migration_summary"
  | "db_health_summary"
  | "recent_errors"
  | "settings_summary"
  | "window_fallback_records";

export interface DiagnosticsExportResponse {
  filePath: string;
  fileName: string;
  exportedAt: string;
  includedSections: DiagnosticsSection[];
  version: number;
  deliveryMode: "file_path" | "browser_download";
  downloadUrl?: string | null;
}

export type ShortcutSource = "user" | "default";
export type ShortcutConflictType = "system" | "app";

export interface ShortcutStateResponse {
  binding: string;
  isRegistered: boolean;
  source: ShortcutSource;
  version: number;
}

export interface ShortcutRecordingResponse extends ShortcutStateResponse {
  isRecording: boolean;
}

export interface ShortcutValidationResponse extends ShortcutStateResponse {
  conflictType: ShortcutConflictType | null;
  conflictTarget: string | null;
}

const initialFallbackItems: ClipboardItem[] = [
  {
    id: "clip-1",
    kind: "text",
    title: "发布命令片段",
    preview:
      "npm run tauri dev -- --no-watch，先验证壳体与焦点行为，再接 Rust IPC。",
    sourceApp: "Warp",
    meta: "2 行文本 · 87 字符",
    timeLabel: "刚刚",
    isPinned: true,
  },
  {
    id: "clip-2",
    kind: "html",
    title: "客户邮件摘要",
    preview:
      "本周只交付本地壳体、搜索路径与诊断导出，不开启云同步或 AI 功能。",
    sourceApp: "Mail",
    meta: "富文本 · 退化为 plain text 可用",
    timeLabel: "2 分钟前",
    isPinned: false,
  },
  {
    id: "clip-3",
    kind: "image",
    title: "发布预览截图",
    preview:
      "标准双栏 popover 预览图，包含历史列表、详情摘要与功能列表。",
    sourceApp: "Figma",
    meta: "PNG · 1920×1080",
    timeLabel: "8 分钟前",
    isPinned: false,
  },
  {
    id: "clip-4",
    kind: "file",
    title: "交付清单.pdf",
    preview:
      "包含 P0 风险关闭门、演示脚本、录屏证据要求与回归检查项。",
    sourceApp: "Finder",
    meta: "1 个文件 · copy-only",
    timeLabel: "13 分钟前",
    isPinned: true,
  },
  {
    id: "clip-5",
    kind: "rtf",
    title: "会议纪要片段",
    preview:
      "多显示器回退、恢复模式只读与 diagnostics export 字段映射必须同时完成。",
    sourceApp: "Notes",
    meta: "RTF · 可退化为纯文本",
    timeLabel: "27 分钟前",
    isPinned: false,
  },
];

let fallbackItems: ClipboardItem[] = initialFallbackItems.map((item) => ({ ...item }));

const fallbackPayloads: Record<string, ClipboardPayloadSnapshot> = {
  "clip-1": {
    textPlain:
      "npm run tauri dev -- --no-watch\nnpm run build\ncargo test --manifest-path src-tauri/Cargo.toml\n\n这条文本用于验证右侧详情能够显示完整多行内容，而不是只显示列表摘要。",
    textHtml: null,
    textRtf: null,
    imageBytes: null,
    imageWidth: null,
    imageHeight: null,
    fileUrls: null,
    extraJson: null,
  },
  "clip-2": {
    textPlain:
      "本周只交付本地壳体、搜索路径与诊断导出，不开启云同步或 AI 功能。\n\nHTML 原文不会直接渲染，右侧详情只展示可信纯文本。",
    textHtml:
      "<p>本周只交付<strong>本地壳体</strong>、搜索路径与诊断导出，不开启云同步或 AI 功能。</p>",
    textRtf: null,
    imageBytes: null,
    imageWidth: null,
    imageHeight: null,
    fileUrls: null,
    extraJson: null,
  },
  "clip-3": {
    textPlain: null,
    textHtml: null,
    textRtf: null,
    imageBytes: [
      23, 26, 31, 255, 229, 231, 235, 255, 229, 231, 235, 255, 23, 26, 31, 255,
      229, 231, 235, 255, 125, 128, 136, 255, 125, 128, 136, 255, 229, 231, 235, 255,
      229, 231, 235, 255, 125, 128, 136, 255, 125, 128, 136, 255, 229, 231, 235, 255,
      23, 26, 31, 255, 229, 231, 235, 255, 229, 231, 235, 255, 23, 26, 31, 255,
    ],
    imageWidth: 4,
    imageHeight: 4,
    fileUrls: null,
    extraJson: null,
  },
  "clip-4": {
    textPlain:
      "/Users/rao/Documents/SuperClip/交付清单.pdf\n/Users/rao/Documents/SuperClip/演示脚本.md\n/Users/rao/Documents/SuperClip/回归检查项.xlsx\n/Users/rao/Documents/SuperClip/录屏证据.mov\n/Users/rao/Documents/SuperClip/风险关闭门.md\n/Users/rao/Documents/SuperClip/质量报告.json",
    textHtml: null,
    textRtf: null,
    imageBytes: null,
    imageWidth: null,
    imageHeight: null,
    fileUrls: [
      "/Users/rao/Documents/SuperClip/交付清单.pdf",
      "/Users/rao/Documents/SuperClip/演示脚本.md",
      "/Users/rao/Documents/SuperClip/回归检查项.xlsx",
      "/Users/rao/Documents/SuperClip/录屏证据.mov",
      "/Users/rao/Documents/SuperClip/风险关闭门.md",
      "/Users/rao/Documents/SuperClip/质量报告.json",
    ],
    extraJson: null,
  },
  "clip-5": {
    textPlain:
      "多显示器回退、恢复模式只读与 diagnostics export 字段映射必须同时完成。\n\nRTF 内容在预览区按纯文本展示，复制/粘贴时仍保留后端可用 payload。",
    textHtml: null,
    textRtf: "{\\rtf1\\ansi 多显示器回退、恢复模式只读与 diagnostics export 字段映射必须同时完成。}",
    imageBytes: null,
    imageWidth: null,
    imageHeight: null,
    fileUrls: null,
    extraJson: null,
  },
};

let fallbackMonitoring = true;
let fallbackPermissionTrusted = true;
let fallbackUndoCounter = 0;
let fallbackRuleCounter = 3;
const fallbackTrash = new Map<string, ClipboardItem>();
const initialFallbackRules: ExclusionRule[] = [
  {
    id: "rule-1",
    kind: "bundle_id",
    value: "com.1password.1password",
    enabled: true,
    version: 1,
  },
  {
    id: "rule-2",
    kind: "keyword",
    value: "验证码",
    enabled: true,
    version: 1,
  },
  {
    id: "rule-3",
    kind: "content_kind",
    value: "image",
    enabled: false,
    version: 1,
  },
];

let fallbackRules: ExclusionRule[] = initialFallbackRules.map((rule) => ({ ...rule }));
const defaultShortcutBinding = "Cmd+Shift+V";
let fallbackShortcutState: ShortcutStateResponse = {
  binding: defaultShortcutBinding,
  isRegistered: true,
  source: "default",
  version: 1,
};
let fallbackShortcutRecording = false;
let fallbackSettings: SettingsResponse = {
  schemaVersion: 1,
  exposedKeys: [
    "global_shortcut",
    "history_limit",
    "default_action",
    "theme_mode",
    "list_font_size",
    "launch_at_login",
    "show_on_startup",
  ],
  reservedKeys: [
    "restore_clipboard_delay_ms",
    "density_mode",
    "row_height_mode",
    "hover_emphasis",
    "thumbnail_density",
  ],
  defaultAction: "direct_paste",
  themeMode: "system",
  historyLimit: 1000,
  listFontSize: 13,
  launchAtLogin: false,
  showOnStartup: false,
};
let fallbackRuntimeState: RuntimeStateResponse = {
  presentationReason: "manual_open",
  lastDisplayId: "main",
  lastWindowMode: "small_window",
  fallbackReason: null,
  migrationPhase: "ready",
  isRecoveryMode: false,
  restoredFromSession: false,
  updatedAt: "2026-04-25T20:10:00+08:00",
};
let fallbackSessionUiState: SessionUiStateResponse = {
  query: "",
  selectedItemId: null,
  scrollAnchor: null,
  layoutSidebarWidthPx: null,
  presentationReason: "manual_open",
  lastDisplayId: "main",
  lastWindowMode: "small_window",
  restoredFromSession: false,
  updatedAt: "2026-04-25T20:10:00+08:00",
};
type FallbackRecentError = {
  error_code: string;
  context: string;
  occurred_at: string;
  startup_phase?: string;
  setting_value?: boolean;
};

type FallbackWindowFallbackRecord = {
  display_id: string;
  fallback_reason: string;
  window_mode: WindowMode;
  occurred_at: string;
  safe_area_snapshot?: {
    origin_x: number;
    origin_y: number;
    width: number;
    height: number;
    scale_factor: number;
  };
};

const FALLBACK_RECENT_ERROR_LIMIT = 50;
const FALLBACK_WINDOW_FALLBACK_LIMIT = 20;

let fallbackRecentErrors: FallbackRecentError[] = [];
let fallbackWindowFallbackRecords: FallbackWindowFallbackRecord[] = [];
const diagnosticsSections: DiagnosticsSection[] = [
  "app_info",
  "os_info",
  "permissions",
  "migration_summary",
  "db_health_summary",
  "recent_errors",
  "settings_summary",
  "window_fallback_records",
];

export function __resetSuperClipFallbackForTests() {
  fallbackItems = initialFallbackItems.map((item) => ({ ...item }));
  fallbackMonitoring = true;
  fallbackPermissionTrusted = true;
  fallbackUndoCounter = 0;
  fallbackRuleCounter = 3;
  fallbackTrash.clear();
  fallbackRules = initialFallbackRules.map((rule) => ({ ...rule }));
  fallbackShortcutState = buildShortcutState(defaultShortcutBinding);
  fallbackShortcutRecording = false;
  fallbackSettings = {
    schemaVersion: 1,
    exposedKeys: [
      "global_shortcut",
      "history_limit",
      "default_action",
      "theme_mode",
      "list_font_size",
      "launch_at_login",
      "show_on_startup",
    ],
    reservedKeys: [
      "restore_clipboard_delay_ms",
      "density_mode",
      "row_height_mode",
      "hover_emphasis",
      "thumbnail_density",
    ],
    defaultAction: "direct_paste",
    themeMode: "system",
    historyLimit: 1000,
    listFontSize: 13,
    launchAtLogin: false,
    showOnStartup: false,
  };
  fallbackRuntimeState = {
    presentationReason: "manual_open",
    lastDisplayId: "main",
    lastWindowMode: "small_window",
    fallbackReason: null,
    migrationPhase: "ready",
    isRecoveryMode: false,
    restoredFromSession: false,
    updatedAt: "2026-04-25T20:10:00+08:00",
  };
  fallbackSessionUiState = {
    query: "",
    selectedItemId: null,
    scrollAnchor: null,
    layoutSidebarWidthPx: null,
    presentationReason: "manual_open",
    lastDisplayId: "main",
    lastWindowMode: "small_window",
    restoredFromSession: false,
    updatedAt: "2026-04-25T20:10:00+08:00",
  };
  fallbackRecentErrors = [];
  fallbackWindowFallbackRecords = [];
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function filterItems(query: string) {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [...fallbackItems];
  }

  return fallbackItems.filter((item) =>
    [item.title, item.preview, item.sourceApp, item.meta].join(" ").toLowerCase().includes(normalized),
  );
}

function getItem(id: string) {
  const item = fallbackItems.find((entry) => entry.id === id);

  if (!item) {
    throw new Error(`Unknown clipboard item: ${id}`);
  }

  return item;
}

function buildFallbackAction(item: ClipboardItem, mode: "copy" | "paste"): ClipboardActionResult {
  if (mode === "copy") {
    return {
      itemId: item.id,
      status: "completed",
      mode: "copy_only",
      message: "已复制到剪贴板，可手动粘贴。",
      fallbackUsed: false,
      degraded: false,
      errorCode: null,
    };
  }

  if (!fallbackPermissionTrusted && item.kind !== "file") {
    return {
      itemId: item.id,
      status: "completed",
      mode: "copy_only",
      message: "未授予 Accessibility，已回退为仅复制。",
      fallbackUsed: true,
      degraded: false,
      errorCode: "NO_ACCESSIBILITY",
    };
  }

  if (item.kind === "file") {
    return {
      itemId: item.id,
      status: "completed",
      mode: "copy_only",
      message: "文件在 P0 固定走仅复制，不承诺 direct paste。",
      fallbackUsed: false,
      degraded: false,
      errorCode: null,
    };
  }

  if (item.kind === "image") {
    return {
      itemId: item.id,
      status: "completed",
      mode: "copy_only",
      message: "目标应用不接受图片 pasteboard，已回退为仅复制。",
      fallbackUsed: true,
      degraded: false,
      errorCode: "PAYLOAD_UNSUPPORTED",
    };
  }

  if (item.kind === "html" || item.kind === "rtf") {
    return {
      itemId: item.id,
      status: "completed",
      mode: "direct_paste",
      message: "目标应用未保留富文本格式，已退化为纯文本粘贴。",
      fallbackUsed: false,
      degraded: true,
      errorCode: "RICH_TEXT_DEGRADED",
    };
  }

  return {
    itemId: item.id,
    status: "completed",
    mode: "direct_paste",
    message: "已直接粘贴到目标应用。",
    fallbackUsed: false,
    degraded: false,
    errorCode: null,
  };
}

function sortFallbackItems(items: ClipboardItem[]) {
  return [...items].sort((left, right) => Number(right.isPinned) - Number(left.isPinned));
}

function normalizeRuleValue(kind: ExclusionRuleKind, value: string) {
  const normalized = value.trim();

  return kind === "content_kind" ? normalized : normalized.toLowerCase();
}

function sortFallbackRules(rules: ExclusionRule[]) {
  return [...rules].sort((left, right) => {
    const enabledDelta = Number(right.enabled) - Number(left.enabled);

    if (enabledDelta !== 0) {
      return enabledDelta;
    }

    return left.kind.localeCompare(right.kind) || left.value.localeCompare(right.value);
  });
}

function buildDiagnosticsFileName(exportedAt: string) {
  return `superclip-diagnostics-${exportedAt.replace(/[:.]/g, "-")}.json`;
}

function triggerBrowserDownload(fileName: string, payload: unknown) {
  const body = JSON.stringify(payload, null, 2);
  const blob = new Blob([body], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);

  return downloadUrl;
}

function buildShortcutState(binding: string): ShortcutStateResponse {
  return {
    binding,
    isRegistered: true,
    source: binding === defaultShortcutBinding ? "default" : "user",
    version: 1,
  };
}

function hasSavedSessionState(sessionState: Pick<SessionUiStateResponse, "query" | "selectedItemId" | "scrollAnchor">) {
  return Boolean(sessionState.query.trim() || sessionState.selectedItemId || sessionState.scrollAnchor);
}

function derivePresentationReason(query: string): PresentationReason {
  if (fallbackRuntimeState.isRecoveryMode) {
    return "recovery_mode";
  }

  if (!fallbackItems.length && !query.trim()) {
    return "no_history";
  }

  if (query.trim() && !filterItems(query).length) {
    return "search_empty";
  }

  return "manual_open";
}

function syncRuntimeStateFromSession(sessionState: SessionUiStateResponse) {
  fallbackRuntimeState = {
    ...fallbackRuntimeState,
    presentationReason: sessionState.presentationReason,
    lastDisplayId: sessionState.lastDisplayId,
    lastWindowMode: sessionState.lastWindowMode,
    restoredFromSession: sessionState.restoredFromSession,
    updatedAt: sessionState.updatedAt,
  };
}

function assertNotRecoveryMode(context: string) {
  if (fallbackRuntimeState.isRecoveryMode) {
    pushFallbackRecentError({
      error_code: "RECOVERY_MODE_READ_ONLY",
      context: `recovery-mode-blocked/${context}`,
      occurred_at: new Date().toISOString(),
    });
    throw new Error("RECOVERY_MODE_READ_ONLY");
  }
}

function pushFallbackRecentError(record: FallbackRecentError) {
  fallbackRecentErrors = [...fallbackRecentErrors, record].slice(-FALLBACK_RECENT_ERROR_LIMIT);
}

function pushFallbackWindowFallbackRecord(record: FallbackWindowFallbackRecord) {
  fallbackWindowFallbackRecords = [...fallbackWindowFallbackRecords, record].slice(
    -FALLBACK_WINDOW_FALLBACK_LIMIT,
  );
}

function recordFallbackPasteOutcome(result: ClipboardActionResult) {
  if (!result.errorCode) {
    return;
  }

  const context =
    result.errorCode === "NO_ACCESSIBILITY"
      ? "paste-failed/no_accessibility"
      : result.degraded
        ? "paste-failed/degraded_plain_text"
        : result.fallbackUsed
          ? "paste-failed/fallback_copy_only"
          : "paste-failed/unknown";

  pushFallbackRecentError({
    error_code: result.errorCode,
    context,
    occurred_at: new Date().toISOString(),
  });
}

function validateFallbackShortcut(binding: string): ShortcutValidationResponse {
  const normalized = binding.trim();

  const conflictMap: Record<string, { type: ShortcutConflictType; target: string }> = {
    "Cmd+Space": { type: "system", target: "macOS Spotlight" },
    "Cmd+Tab": { type: "system", target: "系统应用切换" },
    "Cmd+Option+Esc": { type: "system", target: "强制退出应用" },
    "Cmd+,": { type: "app", target: "SuperClip 设置窗口" },
  };

  const conflict = conflictMap[normalized];
  const validation = {
    ...buildShortcutState(normalized),
    isRegistered: !conflict,
    conflictType: conflict?.type ?? null,
    conflictTarget: conflict?.target ?? null,
  };

  if (validation.conflictType) {
    pushFallbackRecentError({
      error_code:
        validation.conflictType === "system" ? "SHORTCUT_CONFLICT_SYSTEM" : "SHORTCUT_CONFLICT_APP",
      context: `shortcut-conflict-detected/${normalized}/${validation.conflictTarget ?? "unknown"}`,
      occurred_at: new Date().toISOString(),
    });
  }

  return validation;
}

async function invokeOrFallback<T>(command: keyof CommandMap, args: Record<string, unknown>, fallback: () => T) {
  if (!isTauriRuntime()) {
    return fallback();
  }

  return invoke<T>(COMMANDS[command], args);
}

export async function clipboardList() {
  return invokeOrFallback("clipboardList", {}, () => [...fallbackItems]);
}

export async function clipboardGet(id: string) {
  return invokeOrFallback<ClipboardItemDetail>("clipboardGet", { id }, () => ({
    item: getItem(id),
    payload: fallbackPayloads[id] ?? {
      textPlain: getItem(id).preview,
      textHtml: null,
      textRtf: null,
      imageBytes: null,
      imageWidth: null,
      imageHeight: null,
      fileUrls: getItem(id).kind === "file" ? [getItem(id).title] : null,
      extraJson: null,
    },
    version: 1,
  }));
}

export async function clipboardSearch(
  query: string,
  kindFilter?: string,
  pinnedOnly?: boolean,
) {
  return invokeOrFallback<ClipboardSearchResponse>(
    "clipboardSearch",
    { query, kindFilter: kindFilter ?? null, pinnedOnly: pinnedOnly ?? false },
    () => {
      let results = filterItems(query);
      if (kindFilter) {
        results = results.filter((item) => item.kind === kindFilter);
      }
      if (pinnedOnly) {
        results = results.filter((item) => item.isPinned);
      }

      return {
        query,
        normalizedQuery: normalizeQuery(query),
        results,
        total: results.length,
        searchTimeMs: normalizeQuery(query) ? 6 : 2,
        version: 1,
      };
    },
  );
}

export async function settingsGet() {
  return invokeOrFallback<SettingsResponse>("settingsGet", {}, () => ({ ...fallbackSettings }));
}

/** 系统有效外观（dark/light）。WKWebView 的 prefers-color-scheme 在窗口被 Rust 侧
 * setAppearance 锁定后停止跟随系统（Sky.app #37/#60），panel 前端不能用 matchMedia
 * 推断主题，改由后端读 NSApp.effectiveAppearance；浏览器开发环境才用 matchMedia。 */
export async function systemAppearanceGet(): Promise<"dark" | "light"> {
  return invokeOrFallback("systemAppearanceGet", {}, () =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
}

export async function settingsUpdate(patch: SettingsUpdatePayload) {
  return invokeOrFallback<SettingsResponse>("settingsUpdate", { patch }, () => {
    assertNotRecoveryMode("settings:update");

    fallbackSettings = {
      ...fallbackSettings,
      ...patch,
    };

    return { ...fallbackSettings };
  });
}

export async function rulesList() {
  return invokeOrFallback<RulesListResponse>("rulesList", {}, () => ({
    rules: [...fallbackRules],
    total: fallbackRules.length,
    enabledCount: fallbackRules.filter((rule) => rule.enabled).length,
    version: 1,
  }));
}

export async function rulesUpsert(payload: RulesUpsertPayload) {
  return invokeOrFallback<RulesUpsertResponse>("rulesUpsert", { payload }, () => {
    assertNotRecoveryMode("rules:upsert");

    const normalizedValue = payload.value.trim();
    const duplicate = fallbackRules.find(
      (rule) =>
        rule.id !== payload.id &&
        rule.kind === payload.kind &&
        normalizeRuleValue(rule.kind, rule.value) === normalizeRuleValue(payload.kind, normalizedValue),
    );

    if (duplicate) {
      pushFallbackRecentError({
        error_code: "RULE_DUPLICATE",
        context: "rules-upsert/duplicate",
        occurred_at: new Date().toISOString(),
      });
      throw new Error("RULE_DUPLICATE");
    }

    if (payload.id) {
      fallbackRules = sortFallbackRules(
        fallbackRules.map((rule) =>
          rule.id === payload.id
            ? {
                ...rule,
                kind: payload.kind,
                value: normalizedValue,
                enabled: payload.enabled,
              }
            : rule,
        ),
      );

      const updatedRule = fallbackRules.find((rule) => rule.id === payload.id);

      if (!updatedRule) {
        throw new Error("RULE_NOT_FOUND");
      }

      return {
        rule: updatedRule,
        version: 1,
      };
    }

    const nextRule: ExclusionRule = {
      id: `rule-${++fallbackRuleCounter}`,
      kind: payload.kind,
      value: normalizedValue,
      enabled: payload.enabled,
      version: 1,
    };

    fallbackRules = sortFallbackRules([nextRule, ...fallbackRules]);

    return {
      rule: nextRule,
      version: 1,
    };
  });
}

export async function rulesDelete(ruleId: string) {
  return invokeOrFallback<RulesDeleteResponse>("rulesDelete", { ruleId }, () => {
    assertNotRecoveryMode("rules:delete");

    fallbackRules = fallbackRules.filter((rule) => rule.id !== ruleId);

    return {
      ruleId,
      version: 1,
    };
  });
}

export async function rulesClear() {
  return invokeOrFallback<RulesClearResponse>("rulesClear", {}, () => {
    assertNotRecoveryMode("rules:clear");

    const clearedCount = fallbackRules.length;
    fallbackRules = [];

    return {
      clearedCount,
      version: 1,
    };
  });
}

export async function sessionUiStateGet() {
  return invokeOrFallback<SessionUiStateResponse>("sessionUiStateGet", {}, () => {
    const restoredFromSession = hasSavedSessionState(fallbackSessionUiState);
    const nextState: SessionUiStateResponse = {
      ...fallbackSessionUiState,
      presentationReason: derivePresentationReason(fallbackSessionUiState.query),
      restoredFromSession,
    };

    fallbackSessionUiState = nextState;
    syncRuntimeStateFromSession(nextState);

    return { ...nextState };
  });
}

export async function sessionUiStateUpdate(payload: SessionUiStateUpdatePayload) {
  return invokeOrFallback<SessionUiStateResponse>("sessionUiStateUpdate", { payload }, () => {
    const updatedAt = new Date().toISOString();
    const restoredFromSession = hasSavedSessionState(payload);
    const nextState: SessionUiStateResponse = {
      query: payload.query,
      selectedItemId: payload.selectedItemId,
      scrollAnchor: payload.scrollAnchor,
      layoutSidebarWidthPx: payload.layoutSidebarWidthPx,
      presentationReason: derivePresentationReason(payload.query),
      lastDisplayId: payload.lastDisplayId,
      lastWindowMode: payload.lastWindowMode,
      restoredFromSession,
      updatedAt,
    };

    fallbackSessionUiState = nextState;
    syncRuntimeStateFromSession(nextState);

    return { ...nextState };
  });
}

export async function runtimeStateGet() {
  return invokeOrFallback<RuntimeStateResponse>("runtimeStateGet", {}, () => ({ ...fallbackRuntimeState }));
}

export async function windowPlacementRefresh() {
  return invokeOrFallback<RuntimeStateResponse>("windowPlacementRefresh", {}, () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const previousMode = fallbackRuntimeState.lastWindowMode;
    const previousReason = fallbackRuntimeState.fallbackReason;
    const lastWindowMode: WindowMode =
      width >= 960 && height >= 660
        ? "large_window"
        : width >= 740 && height >= 540
          ? "small_window"
          : "fallback_window";
    const fallbackReason =
      lastWindowMode === "fallback_window"
          ? "safe_area_fallback"
          : null;
    const updatedAt = new Date().toISOString();

    fallbackRuntimeState = {
      ...fallbackRuntimeState,
      lastDisplayId: `browser-${window.screenX}-${window.screenY}`,
      lastWindowMode,
      fallbackReason,
      updatedAt,
    };

    if (
      fallbackReason &&
      (previousMode !== lastWindowMode || previousReason !== fallbackReason)
    ) {
      pushFallbackWindowFallbackRecord({
        display_id: fallbackRuntimeState.lastDisplayId,
        fallback_reason: fallbackReason,
        window_mode: lastWindowMode,
        occurred_at: updatedAt,
        safe_area_snapshot: {
          origin_x: window.screenX,
          origin_y: window.screenY,
          width,
          height,
          scale_factor: window.devicePixelRatio || 1,
        },
      });
    }

    return { ...fallbackRuntimeState };
  });
}

export async function diagnosticsExport() {
  return invokeOrFallback<DiagnosticsExportResponse>("diagnosticsExport", {}, () => {
    const exportedAt = new Date().toISOString();
    const fileName = buildDiagnosticsFileName(exportedAt);
    const payload = {
      app_info: {
        version: "0.1.0",
        build: "frontend-shell",
        config_version: 1,
      },
      os_info: {
        platform: "browser-preview",
        architecture: "web",
        locale: navigator.language,
      },
      permissions: {
        accessibility_trusted: fallbackPermissionTrusted,
        checked_at: "2026-04-25T19:40:00+08:00",
      },
      migration_summary: {
        schema_version: 1,
        migration_phase: fallbackRuntimeState.migrationPhase,
        error_code: fallbackRuntimeState.isRecoveryMode ? "RECOVERY_MODE_READ_ONLY" : null,
      },
      db_health_summary: {
        item_count: fallbackItems.length,
        rule_count: fallbackRules.length,
        fts_status: "mock",
        file_size_bucket: "<1MB",
        checksum: "browser-shell",
      },
      recent_errors: fallbackRecentErrors,
      settings_summary: {
        default_action: fallbackSettings.defaultAction,
        theme_mode: fallbackSettings.themeMode,
        history_limit: fallbackSettings.historyLimit,
        launch_at_login: fallbackSettings.launchAtLogin,
        show_on_startup: fallbackSettings.showOnStartup,
        exclusion_rule_count: fallbackRules.length,
      },
      window_fallback_records:
        fallbackWindowFallbackRecords.length > 0
          ? fallbackWindowFallbackRecords
          : fallbackRuntimeState.fallbackReason
            ? [
                {
                  display_id: fallbackRuntimeState.lastDisplayId,
                  fallback_reason: fallbackRuntimeState.fallbackReason,
                  window_mode: fallbackRuntimeState.lastWindowMode,
                  occurred_at: fallbackRuntimeState.updatedAt,
                  safe_area_snapshot: {
                    origin_x: window.screenX,
                    origin_y: window.screenY,
                    width: window.innerWidth,
                    height: window.innerHeight,
                    scale_factor: window.devicePixelRatio || 1,
                  },
                },
              ]
            : [],
    };
    const downloadUrl = triggerBrowserDownload(fileName, payload);

    return {
      filePath: fileName,
      fileName,
      exportedAt,
      includedSections: diagnosticsSections,
      version: 1,
      deliveryMode: "browser_download",
      downloadUrl,
    };
  });
}

export async function shortcutGet() {
  return invokeOrFallback<ShortcutStateResponse>("shortcutGet", {}, () => ({ ...fallbackShortcutState }));
}

export async function shortcutStartRecording() {
  return invokeOrFallback<ShortcutRecordingResponse>("shortcutStartRecording", {}, () => {
    assertNotRecoveryMode("shortcut:start-recording");

    fallbackShortcutRecording = true;

    return {
      ...fallbackShortcutState,
      isRecording: fallbackShortcutRecording,
    };
  });
}

export async function shortcutCancelRecording() {
  return invokeOrFallback<ShortcutRecordingResponse>("shortcutCancelRecording", {}, () => {
    fallbackShortcutRecording = false;

    return {
      ...fallbackShortcutState,
      isRecording: fallbackShortcutRecording,
    };
  });
}

export async function shortcutValidate(binding: string) {
  return invokeOrFallback<ShortcutValidationResponse>("shortcutValidate", { binding }, () =>
    validateFallbackShortcut(binding),
  );
}

export async function shortcutUpdate(binding: string) {
  return invokeOrFallback<ShortcutStateResponse>("shortcutUpdate", { binding }, () => {
    assertNotRecoveryMode("shortcut:update");

    const validation = validateFallbackShortcut(binding);

    if (validation.conflictType) {
      throw new Error(
        validation.conflictType === "system" ? "SHORTCUT_CONFLICT_SYSTEM" : "SHORTCUT_CONFLICT_APP",
      );
    }

    fallbackShortcutState = buildShortcutState(binding);
    fallbackShortcutRecording = false;

    return { ...fallbackShortcutState };
  });
}

export async function shortcutRestoreDefault() {
  return invokeOrFallback<ShortcutStateResponse>("shortcutRestoreDefault", {}, () => {
    assertNotRecoveryMode("shortcut:restore-default");

    fallbackShortcutState = buildShortcutState(defaultShortcutBinding);
    fallbackShortcutRecording = false;

    return { ...fallbackShortcutState };
  });
}

export async function permissionCheckAccessibility() {
  return invokeOrFallback<PermissionStatus>("permissionCheckAccessibility", {}, () => ({
    accessibilityTrusted: fallbackPermissionTrusted,
    checkedAt: "2026-04-25T19:40:00+08:00",
  }));
}

export async function permissionOpenAccessibility() {
  return invokeOrFallback<boolean>("permissionOpenAccessibility", {}, () => false);
}

export async function showMain() {
  return invokeOrFallback<void>("showMain", {}, () => {});
}

export async function previewShow(x: number, y: number, width: number, height: number) {
  return invokeOrFallback<void>("previewShow", { x, y, width, height }, () => {});
}

export async function previewHide() {
  return invokeOrFallback<void>("previewHide", {}, () => {});
}

export async function popupReady() {
  return invokeOrFallback<void>("popupReady", {}, () => {});
}

export async function quickPanelReady() {
  return invokeOrFallback<void>("quickPanelReady", {}, () => {});
}

export async function mainWindowReady() {
  return invokeOrFallback<void>("mainWindowReady", {}, () => {});
}

export async function monitorToggle(nextState?: boolean) {
  return invokeOrFallback<MonitorStatus>("monitorToggle", { nextState }, () => {
    assertNotRecoveryMode("monitor:toggle");

    fallbackMonitoring = nextState ?? !fallbackMonitoring;
    return { isMonitoring: fallbackMonitoring };
  });
}

export async function monitorStatusGet() {
  return invokeOrFallback<MonitorStatus>("monitorStatusGet", {}, () => ({
    isMonitoring: fallbackMonitoring,
  }));
}

export async function appQuit() {
  return invokeOrFallback<void>("appQuit", {}, () => {});
}

export async function quickPanelHide() {
  return invokeOrFallback<void>("quickPanelHide", {}, () => {});
}

export async function clipboardCopy(id: string) {
  return invokeOrFallback<ClipboardActionResult>("clipboardCopy", { id }, () => buildFallbackAction(getItem(id), "copy"));
}

export async function clipboardPaste(id: string) {
  if (!isTauriRuntime() && fallbackRuntimeState.isRecoveryMode) {
    assertNotRecoveryMode("clipboard:paste");
  }

  return invokeOrFallback<ClipboardActionResult>("clipboardPaste", { id }, () => {
    const result = buildFallbackAction(getItem(id), "paste");
    recordFallbackPasteOutcome(result);
    return result;
  });
}

export async function clipboardPin(id: string) {
  return invokeOrFallback<ClipboardPinResult>("clipboardPin", { id }, () => {
    assertNotRecoveryMode("clipboard:pin");

    const item = getItem(id);
    item.isPinned = true;
    fallbackItems = sortFallbackItems(fallbackItems);

    return {
      item: getItem(id),
      version: 1,
    };
  });
}

export async function clipboardUnpin(id: string) {
  return invokeOrFallback<ClipboardPinResult>("clipboardUnpin", { id }, () => {
    assertNotRecoveryMode("clipboard:unpin");

    const item = getItem(id);
    item.isPinned = false;
    fallbackItems = sortFallbackItems(fallbackItems);

    return {
      item: getItem(id),
      version: 1,
    };
  });
}

export async function clipboardDelete(id: string) {
  return invokeOrFallback<ClipboardDeleteResult>("clipboardDelete", { id }, () => {
    assertNotRecoveryMode("clipboard:delete");

    const item = getItem(id);
    const undoToken = `undo-${++fallbackUndoCounter}`;

    fallbackTrash.set(undoToken, { ...item });
    fallbackItems = fallbackItems.filter((entry) => entry.id !== id);

    return {
      itemId: id,
      undoToken,
      expiresAt: "30s",
      version: 1,
    };
  });
}

export async function clipboardRestore(undoToken: string) {
  return invokeOrFallback<ClipboardRestoreResult>("clipboardRestore", { undoToken }, () => {
    assertNotRecoveryMode("clipboard:restore");

    const item = fallbackTrash.get(undoToken);

    if (!item) {
      pushFallbackRecentError({
        error_code: "UNDO_EXPIRED",
        context: "clipboard-restore/undo-expired",
        occurred_at: new Date().toISOString(),
      });
      throw new Error("UNDO_EXPIRED");
    }

    fallbackTrash.delete(undoToken);
    fallbackItems = sortFallbackItems([item, ...fallbackItems]);

    return {
      item,
      version: 1,
    };
  });
}

export async function clipboardClear() {
  return invokeOrFallback<ClipboardClearResult>("clipboardClear", {}, () => {
    assertNotRecoveryMode("clipboard:clear");

    const clearedCount = fallbackItems.length;

    fallbackItems = [];
    fallbackTrash.clear();

    return {
      clearedCount,
      version: 1,
    };
  });
}

export function getKindActionLabel(kind: ClipboardKind, defaultAction: SettingsResponse["defaultAction"]) {
  if (kind === "file") {
    return "仅复制";
  }

  if (defaultAction === "copy_only") {
    return "仅复制";
  }

  return kind === "image" ? "直接粘贴（尽力）" : "直接粘贴";
}
