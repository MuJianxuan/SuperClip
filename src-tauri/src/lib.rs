use arboard::{Clipboard, ImageData};
use rusqlite::{params, Connection, ErrorCode, OpenFlags, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::borrow::Cow;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_opener::OpenerExt;

#[cfg(target_os = "macos")]
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt as NsPanelManagerExt, PanelBuilder, PanelLevel,
};

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, clear_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

const RECENT_ERROR_LIMIT: usize = 50;
const WINDOW_FALLBACK_RECORD_LIMIT: usize = 20;
const TEXT_PAYLOAD_LIMIT_BYTES: usize = 2 * 1024 * 1024;
const IMAGE_PAYLOAD_LIMIT_BYTES: usize = 8 * 1024 * 1024;
const IMAGE_PREVIEW_MAX_EDGE: usize = 360;
const MONITOR_POLL_MS: u64 = 900;
const DEFAULT_HISTORY_LIMIT: usize = 1000;
/// 历史列表/搜索单次返回的最大条数（对应历史保留上限可配置的最高 5000 条）。
const MAX_HISTORY_RESULTS: usize = 5000;
const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/tray-clipboard-list.png");
const WINDOW_MODE_SMALL: &str = "small_window";
const WINDOW_MODE_LARGE: &str = "large_window";
const WINDOW_MODE_FALLBACK: &str = "fallback_window";
const WINDOW_SMALL_WIDTH: f64 = 760.0;
const WINDOW_SMALL_HEIGHT: f64 = 540.0;
const WINDOW_LARGE_WIDTH: f64 = 760.0;
const WINDOW_LARGE_HEIGHT: f64 = 540.0;
const WINDOW_SAFE_AREA_MARGIN_X: f64 = 32.0;
const WINDOW_SAFE_AREA_MARGIN_Y: f64 = 48.0;
const WINDOW_RESIZE_SUPPRESSION_MS: u64 = 350;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardItemSummary {
    id: String,
    kind: String,
    title: String,
    preview: String,
    source_app: String,
    meta: String,
    time_label: String,
    is_pinned: bool,
    match_type: Option<String>,
    matched_fields: Vec<String>,
    highlight_ranges: Vec<HighlightRange>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HighlightRange {
    field: String,
    start: usize,
    end: usize,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardPayloadSnapshot {
    text_plain: Option<String>,
    text_html: Option<String>,
    text_rtf: Option<String>,
    image_bytes: Option<Vec<u8>>,
    image_width: Option<usize>,
    image_height: Option<usize>,
    file_urls: Option<Vec<String>>,
    extra_json: Option<serde_json::Value>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardItemDetail {
    item: ClipboardItemSummary,
    payload: ClipboardPayloadSnapshot,
    version: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardSearchResponse {
    query: String,
    normalized_query: String,
    results: Vec<ClipboardItemSummary>,
    total: usize,
    search_time_ms: u64,
    version: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsResponse {
    schema_version: u8,
    exposed_keys: Vec<String>,
    reserved_keys: Vec<String>,
    default_action: String,
    theme_mode: String,
    history_limit: u32,
    launch_at_login: bool,
    show_on_startup: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsUpdateRequest {
    default_action: Option<String>,
    theme_mode: Option<String>,
    history_limit: Option<u32>,
    launch_at_login: Option<bool>,
    show_on_startup: Option<bool>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExclusionRule {
    id: String,
    kind: String,
    value: String,
    enabled: bool,
    version: u8,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RulesUpsertPayload {
    id: Option<String>,
    kind: String,
    value: String,
    enabled: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RulesListResponse {
    rules: Vec<ExclusionRule>,
    total: usize,
    enabled_count: usize,
    version: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RulesUpsertResponse {
    rule: ExclusionRule,
    version: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RulesDeleteResponse {
    rule_id: String,
    version: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RulesClearResponse {
    cleared_count: usize,
    version: u8,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsExportResponse {
    file_path: String,
    file_name: String,
    exported_at: String,
    included_sections: Vec<String>,
    version: u8,
    delivery_mode: String,
    download_url: Option<String>,
}

#[derive(Clone, Serialize)]
struct RecentErrorRecord {
    error_code: String,
    context: String,
    occurred_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    startup_phase: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    setting_value: Option<bool>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SafeAreaSnapshot {
    origin_x: i32,
    origin_y: i32,
    width: u32,
    height: u32,
    scale_factor: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowFallbackRecord {
    display_id: String,
    fallback_reason: String,
    window_mode: String,
    safe_area_snapshot: Option<SafeAreaSnapshot>,
    occurred_at: String,
}

struct WindowPlacementDecision {
    display_id: String,
    window_mode: String,
    fallback_reason: Option<String>,
    safe_area_snapshot: SafeAreaSnapshot,
    width: f64,
    height: f64,
    position: Option<(f64, f64)>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum WindowSizeMode {
    Small,
    Large,
}

impl WindowSizeMode {
    fn as_str(self) -> &'static str {
        match self {
            WindowSizeMode::Small => WINDOW_MODE_SMALL,
            WindowSizeMode::Large => WINDOW_MODE_LARGE,
        }
    }

    fn dimensions(self) -> (f64, f64) {
        match self {
            WindowSizeMode::Small => (WINDOW_SMALL_WIDTH, WINDOW_SMALL_HEIGHT),
            WindowSizeMode::Large => (WINDOW_LARGE_WIDTH, WINDOW_LARGE_HEIGHT),
        }
    }

    fn from_window_mode(value: &str) -> Self {
        if value == WINDOW_MODE_LARGE {
            WindowSizeMode::Large
        } else {
            WindowSizeMode::Small
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShortcutStateResponse {
    binding: String,
    is_registered: bool,
    source: String,
    version: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShortcutRecordingResponse {
    binding: String,
    is_registered: bool,
    source: String,
    version: u8,
    is_recording: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShortcutValidationResponse {
    binding: String,
    is_registered: bool,
    source: String,
    version: u8,
    conflict_type: Option<String>,
    conflict_target: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PermissionStatus {
    accessibility_trusted: bool,
    checked_at: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MonitorStatus {
    is_monitoring: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeStateResponse {
    presentation_reason: String,
    last_display_id: String,
    last_window_mode: String,
    fallback_reason: Option<String>,
    migration_phase: String,
    is_recovery_mode: bool,
    restored_from_session: bool,
    updated_at: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionUiStateResponse {
    query: String,
    selected_item_id: Option<String>,
    scroll_anchor: Option<String>,
    layout_sidebar_width_px: Option<u32>,
    presentation_reason: String,
    last_display_id: String,
    last_window_mode: String,
    restored_from_session: bool,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionUiStateUpdateRequest {
    query: String,
    selected_item_id: Option<String>,
    scroll_anchor: Option<String>,
    layout_sidebar_width_px: Option<u32>,
    last_display_id: String,
    last_window_mode: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardActionResult {
    item_id: String,
    status: String,
    mode: String,
    message: String,
    fallback_used: bool,
    degraded: bool,
    error_code: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardPinResult {
    item: ClipboardItemSummary,
    version: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardDeleteResult {
    item_id: String,
    undo_token: String,
    expires_at: String,
    version: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardRestoreResult {
    item: ClipboardItemSummary,
    version: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardClearResult {
    cleared_count: usize,
    version: u8,
}

struct ClipboardMonitorState {
    last_seen_hash: Option<String>,
    self_write_hash: Option<String>,
}

struct WindowPlacementCoordinator {
    is_applying: bool,
    suppress_resize_until: Option<Instant>,
}

impl WindowPlacementCoordinator {
    fn new() -> Self {
        Self {
            is_applying: false,
            suppress_resize_until: None,
        }
    }

    fn begin_apply(&mut self) -> bool {
        if self.is_applying {
            return false;
        }

        self.is_applying = true;
        true
    }

    fn finish_apply(&mut self, now: Instant) {
        self.is_applying = false;
        self.suppress_resize_until =
            Some(now + Duration::from_millis(WINDOW_RESIZE_SUPPRESSION_MS));
    }

    fn should_ignore_resize(&mut self, now: Instant) -> bool {
        if self.is_applying {
            return true;
        }

        let Some(suppress_resize_until) = self.suppress_resize_until else {
            return false;
        };

        if now < suppress_resize_until {
            return true;
        }

        self.suppress_resize_until = None;
        false
    }
}

struct AppState {
    db: Mutex<Connection>,
    db_read: Mutex<Connection>,
    database_path: PathBuf,
    exclusion_rules_cache: std::sync::RwLock<Vec<ExclusionRule>>,
    monitor_state: Mutex<ClipboardMonitorState>,
    shortcut_state: Mutex<ShortcutStateResponse>,
    shortcut_recording: Mutex<bool>,
    is_monitoring: Mutex<bool>,
    accessibility_trusted: Mutex<bool>,
    settings: Mutex<SettingsResponse>,
    session_ui_state: Mutex<SessionUiStateResponse>,
    runtime_state: Mutex<RuntimeStateResponse>,
    recent_errors: Mutex<Vec<RecentErrorRecord>>,
    window_fallback_records: Mutex<Vec<WindowFallbackRecord>>,
    window_placement: Mutex<WindowPlacementCoordinator>,
    tray_icon: Mutex<Option<TrayIcon<tauri::Wry>>>,
    preview_active: Mutex<bool>,
    popup_ready: Mutex<bool>,
    quick_panel_ready: Mutex<bool>,
    main_window_ready: Mutex<bool>,
    /// 内容未就绪时收到的显示请求（前端就绪后自动补显，避免丢弃用户点击）
    pending_show_popup: Mutex<bool>,
    pending_show_quick_panel: Mutex<bool>,
    pending_show_main: Mutex<bool>,
    /// 最近一次检测到的系统有效外观（"dark"/"light"/None），供主题跟随 watcher 差量检测
    last_system_appearance: Mutex<Option<String>>,
}

impl AppState {
    fn new() -> Self {
        let (db, database_path, is_recovery_mode, startup_error) = match open_database() {
            Ok((db, database_path)) => (db, database_path, false, None),
            Err(error_code) => {
                let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
                    | OpenFlags::SQLITE_OPEN_CREATE
                    | OpenFlags::SQLITE_OPEN_URI
                    | OpenFlags::SQLITE_OPEN_NO_MUTEX;
                let fallback_db =
                    Connection::open_with_flags("file::memory:?cache=shared", flags)
                        .expect("fallback sqlite connection must open");
                let _ = migrate_database(&fallback_db);
                (
                    fallback_db,
                    PathBuf::from(":memory:"),
                    true,
                    Some(error_code),
                )
            }
        };

        let db_read = if database_path.to_str() == Some(":memory:") {
            let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_URI
                | OpenFlags::SQLITE_OPEN_NO_MUTEX;
            Connection::open_with_flags("file::memory:?cache=shared", flags)
                .expect("fallback read connection must open")
        } else {
            let conn = Connection::open(&database_path).expect("read connection must open");
            conn.execute_batch(
                "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 2500; PRAGMA synchronous = NORMAL; PRAGMA cache_size = -8000; PRAGMA mmap_size = 134217728; PRAGMA temp_store = MEMORY; PRAGMA query_only = ON;",
            ).expect("read connection PRAGMA must succeed");
            conn
        };
        let startup_recent_errors = startup_error
            .map(|error_code| {
                let record = RecentErrorRecord {
                    error_code: startup_database_error_code(&error_code),
                    context: format!("startup-database-open/{error_code}"),
                    occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
                    startup_phase: Some("database_open_or_migration".into()),
                    setting_value: None,
                };
                log_recent_error_record(&record);
                record
            })
            .into_iter()
            .collect::<Vec<_>>();

        let initial_settings = load_settings(&db).unwrap_or_else(|_| default_settings_response());
        let initial_rules = list_exclusion_rules(&db).unwrap_or_default();

        Self {
            db: Mutex::new(db),
            db_read: Mutex::new(db_read),
            database_path,
            exclusion_rules_cache: std::sync::RwLock::new(initial_rules),
            monitor_state: Mutex::new(ClipboardMonitorState {
                last_seen_hash: None,
                self_write_hash: None,
            }),
            shortcut_state: Mutex::new(default_shortcut_state()),
            shortcut_recording: Mutex::new(false),
            is_monitoring: Mutex::new(true),
            accessibility_trusted: Mutex::new(check_accessibility_trusted().unwrap_or(false)),
            settings: Mutex::new(initial_settings),
            session_ui_state: Mutex::new(SessionUiStateResponse {
                query: String::new(),
                selected_item_id: None,
                scroll_anchor: None,
                layout_sidebar_width_px: None,
                presentation_reason: "manual_open".into(),
                last_display_id: "main".into(),
                last_window_mode: WINDOW_MODE_SMALL.into(),
                restored_from_session: false,
                updated_at: "2026-04-25T20:10:00+08:00".into(),
            }),
            runtime_state: Mutex::new(RuntimeStateResponse {
                presentation_reason: if is_recovery_mode {
                    "recovery_mode".into()
                } else {
                    "manual_open".into()
                },
                last_display_id: "main".into(),
                last_window_mode: WINDOW_MODE_SMALL.into(),
                fallback_reason: None,
                migration_phase: if is_recovery_mode {
                    "recovery_mode".into()
                } else {
                    "ready".into()
                },
                is_recovery_mode,
                restored_from_session: false,
                updated_at: "2026-04-25T20:10:00+08:00".into(),
            }),
            recent_errors: Mutex::new(startup_recent_errors),
            window_fallback_records: Mutex::new(Vec::new()),
            window_placement: Mutex::new(WindowPlacementCoordinator::new()),
            tray_icon: Mutex::new(None),
            preview_active: Mutex::new(false),
            popup_ready: Mutex::new(false),
            quick_panel_ready: Mutex::new(false),
            main_window_ready: Mutex::new(false),
            pending_show_popup: Mutex::new(false),
            pending_show_quick_panel: Mutex::new(false),
            pending_show_main: Mutex::new(false),
            last_system_appearance: Mutex::new(None),
        }
    }
}

const DEFAULT_SHORTCUT: &str = "Cmd+Shift+V";
const DIAGNOSTIC_SECTIONS: [&str; 8] = [
    "app_info",
    "os_info",
    "permissions",
    "migration_summary",
    "db_health_summary",
    "recent_errors",
    "settings_summary",
    "window_fallback_records",
];

fn default_database_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "DATABASE_PATH_UNAVAILABLE".to_string())?;
    let dir = Path::new(&home)
        .join("Library")
        .join("Application Support")
        .join("SuperClip");

    fs::create_dir_all(&dir).map_err(|_| "DATABASE_PATH_UNAVAILABLE".to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&dir, fs::Permissions::from_mode(0o700));
    }
    Ok(dir.join("superclip.sqlite3"))
}

fn open_database() -> Result<(Connection, PathBuf), String> {
    let database_path = default_database_path()?;
    let connection = Connection::open(&database_path).map_err(map_db_error)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&database_path, fs::Permissions::from_mode(0o600));
    }
    migrate_database(&connection)?;
    Ok((connection, database_path))
}

fn migrate_database(connection: &Connection) -> Result<(), String> {
    connection
        .busy_timeout(Duration::from_millis(2_500))
        .map_err(map_db_error)?;
    connection
        .execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 2500;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -8000;
            PRAGMA mmap_size = 134217728;
            PRAGMA temp_store = MEMORY;

            CREATE TABLE IF NOT EXISTS _superclip_migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS clipboard_items (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                content_hash TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                preview_text TEXT NOT NULL,
                source_app TEXT NOT NULL,
                meta TEXT NOT NULL,
                is_pinned INTEGER NOT NULL DEFAULT 0,
                pinned_at INTEGER,
                use_count INTEGER NOT NULL DEFAULT 0,
                last_used_at INTEGER,
                payload_size_bytes INTEGER NOT NULL DEFAULT 0,
                is_truncated INTEGER NOT NULL DEFAULT 0,
                is_sensitive INTEGER NOT NULL DEFAULT 0,
                origin_bundle_id TEXT,
                preview_strategy TEXT NOT NULL DEFAULT 'inline',
                created_at INTEGER NOT NULL,
                last_seen_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS clipboard_payloads (
                item_id TEXT PRIMARY KEY REFERENCES clipboard_items(id) ON DELETE CASCADE,
                text_plain TEXT,
                text_html TEXT,
                text_rtf TEXT,
                image_blob BLOB,
                image_width INTEGER,
                image_height INTEGER,
                file_urls_json TEXT,
                extra_json TEXT
            );

            CREATE TABLE IF NOT EXISTS clipboard_trash (
                trash_id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL,
                undo_token TEXT NOT NULL UNIQUE,
                item_json TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                deleted_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                deleted_by_action TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS exclusion_rules (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                value TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE(kind, value)
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS fts_clipboard_items USING fts5(
                item_id UNINDEXED,
                title,
                preview_text,
                source_app,
                meta,
                normalized_plain_text,
                tokenize = 'unicode61'
            );

            INSERT OR IGNORE INTO _superclip_migrations(version, description, applied_at)
            VALUES (1, 'initial clipboard repository with fts', unixepoch());

            INSERT OR IGNORE INTO _superclip_migrations(version, description, applied_at)
            VALUES (2, 'settings and exclusion rules persistence', unixepoch());

            INSERT OR IGNORE INTO settings(key, value, updated_at)
            VALUES
                ('default_action', 'direct_paste', unixepoch()),
                ('theme_mode', 'system', unixepoch()),
                ('history_limit', '1000', unixepoch()),
                ('show_on_startup', 'false', unixepoch());

            INSERT OR IGNORE INTO exclusion_rules(id, kind, value, enabled, created_at, updated_at)
            VALUES
                ('rule-1', 'bundle_id', 'com.1password.1password', 1, unixepoch(), unixepoch()),
                ('rule-2', 'keyword', '验证码', 1, unixepoch(), unixepoch()),
                ('rule-3', 'content_kind', 'image', 0, unixepoch(), unixepoch());

            PRAGMA user_version = 2;
            "#,
        )
        .map_err(map_db_error)?;

    connection
        .execute_batch(
            r#"
            CREATE INDEX IF NOT EXISTS idx_clipboard_items_cleanup
                ON clipboard_items(is_pinned, last_seen_at DESC);

            CREATE INDEX IF NOT EXISTS idx_clipboard_items_list
                ON clipboard_items(is_pinned DESC, last_seen_at DESC);

            INSERT OR IGNORE INTO _superclip_migrations(version, description, applied_at)
            VALUES (3, 'performance indexes for cleanup and list', unixepoch());

            PRAGMA user_version = 3;
            "#,
        )
        .map_err(map_db_error)?;

    connection
        .execute_batch(
            r#"
            CREATE INDEX IF NOT EXISTS idx_clipboard_items_kind_list
                ON clipboard_items(kind, is_pinned DESC, last_seen_at DESC);

            INSERT OR IGNORE INTO _superclip_migrations(version, description, applied_at)
            VALUES (4, 'kind composite index for tab filter performance', unixepoch());

            PRAGMA user_version = 4;
            "#,
        )
        .map_err(map_db_error)?;

    Ok(())
}

fn map_db_error(error: rusqlite::Error) -> String {
    match error {
        rusqlite::Error::SqliteFailure(inner, _) => match inner.code {
            ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked => "DB_LOCKED".into(),
            _ => format!("DB_ERROR:{inner:?}"),
        },
        other => format!("DB_ERROR:{other}"),
    }
}

fn startup_database_error_code(error_code: &str) -> String {
    match error_code {
        "DATABASE_PATH_UNAVAILABLE" => "DATABASE_PATH_UNAVAILABLE".into(),
        "DB_LOCKED" => "DB_LOCKED".into(),
        _ => "MIGRATION_FAILED".into(),
    }
}

fn now_epoch_secs() -> Result<i64, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "UNKNOWN".to_string())?
        .as_secs() as i64)
}

fn time_label_from_epoch(epoch: i64) -> String {
    let now = now_epoch_secs().unwrap_or(epoch);
    let delta = now.saturating_sub(epoch);

    if delta < 60 {
        "刚刚".into()
    } else if delta < 3_600 {
        format!("{} 分钟前", delta / 60)
    } else if delta < 86_400 {
        format!("{} 小时前", delta / 3_600)
    } else {
        format!("{} 天前", delta / 86_400)
    }
}

fn hex_digest(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn content_hash(kind: &str, primary: &[u8], secondary: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(kind.as_bytes());
    hasher.update([0]);
    hasher.update(primary);
    hasher.update([0]);
    hasher.update(secondary);
    let digest = hasher.finalize();
    hex_digest(digest.as_slice())
}

fn normalize_rule_value(kind: &str, value: &str) -> String {
    if kind == "content_kind" {
        value.trim().to_string()
    } else {
        value.trim().to_lowercase()
    }
}

fn default_settings_response() -> SettingsResponse {
    SettingsResponse {
        schema_version: 1,
        exposed_keys: vec![
            "global_shortcut".into(),
            "history_limit".into(),
            "default_action".into(),
            "theme_mode".into(),
            "launch_at_login".into(),
            "show_on_startup".into(),
        ],
        reserved_keys: vec![
            "restore_clipboard_delay_ms".into(),
            "density_mode".into(),
            "row_height_mode".into(),
            "hover_emphasis".into(),
            "thumbnail_density".into(),
        ],
        default_action: "direct_paste".into(),
        theme_mode: "system".into(),
        history_limit: 1000,
        launch_at_login: false,
        show_on_startup: false,
    }
}

fn load_setting_value(connection: &Connection, key: &str) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(map_db_error)
}

fn load_settings(connection: &Connection) -> Result<SettingsResponse, String> {
    let defaults = default_settings_response();
    let default_action = load_setting_value(connection, "default_action")?
        .filter(|value| value == "direct_paste" || value == "copy_only")
        .unwrap_or(defaults.default_action);
    let theme_mode = load_setting_value(connection, "theme_mode")?
        .filter(|value| value == "light" || value == "dark" || value == "system")
        .unwrap_or(defaults.theme_mode);
    let history_limit = load_setting_value(connection, "history_limit")?
        .and_then(|value| value.parse::<u32>().ok())
        .map(|value| value.clamp(100, 5_000))
        .unwrap_or(defaults.history_limit);
    let show_on_startup = load_setting_value(connection, "show_on_startup")?
        .map(|value| value == "true")
        .unwrap_or(defaults.show_on_startup);

    Ok(SettingsResponse {
        default_action,
        theme_mode,
        history_limit,
        show_on_startup,
        ..defaults
    })
}

fn save_setting_value(connection: &Connection, key: &str, value: &str) -> Result<(), String> {
    connection
        .execute(
            r#"
            INSERT INTO settings(key, value, updated_at)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            "#,
            params![key, value, now_epoch_secs()?],
        )
        .map_err(map_db_error)?;
    Ok(())
}

fn default_shortcut_state() -> ShortcutStateResponse {
    build_shortcut_state(DEFAULT_SHORTCUT, false)
}

fn build_shortcut_state(binding: &str, is_registered: bool) -> ShortcutStateResponse {
    ShortcutStateResponse {
        binding: binding.into(),
        is_registered,
        source: if binding == DEFAULT_SHORTCUT {
            "default".into()
        } else {
            "user".into()
        },
        version: 1,
    }
}

fn validate_shortcut(binding: &str) -> ShortcutValidationResponse {
    let (conflict_type, conflict_target) = match binding {
        "Cmd+Space" => (
            Some("system".to_string()),
            Some("macOS Spotlight".to_string()),
        ),
        "Cmd+Tab" => (Some("system".to_string()), Some("系统应用切换".to_string())),
        "Cmd+Option+Esc" => (Some("system".to_string()), Some("强制退出应用".to_string())),
        "Cmd+," => (
            Some("app".to_string()),
            Some("SuperClip 设置窗口".to_string()),
        ),
        _ => (None, None),
    };

    ShortcutValidationResponse {
        binding: binding.into(),
        is_registered: conflict_type.is_none(),
        source: if binding == DEFAULT_SHORTCUT {
            "default".into()
        } else {
            "user".into()
        },
        version: 1,
        conflict_type,
        conflict_target,
    }
}

fn build_shortcut_recording_response(
    shortcut_state: &ShortcutStateResponse,
    is_recording: bool,
) -> ShortcutRecordingResponse {
    ShortcutRecordingResponse {
        binding: shortcut_state.binding.clone(),
        is_registered: shortcut_state.is_registered,
        source: shortcut_state.source.clone(),
        version: shortcut_state.version,
        is_recording,
    }
}

fn build_diagnostics_file_name(exported_at: &str) -> String {
    format!(
        "superclip-diagnostics-{}.json",
        exported_at.replace(':', "-").replace('.', "-")
    )
}

fn normalized(text: &str) -> String {
    text.trim().to_lowercase()
}

fn row_to_rule(row: &rusqlite::Row<'_>) -> rusqlite::Result<ExclusionRule> {
    Ok(ExclusionRule {
        id: row.get("id")?,
        kind: row.get("kind")?,
        value: row.get("value")?,
        enabled: row.get::<_, i64>("enabled")? == 1,
        version: 1,
    })
}

fn list_exclusion_rules(connection: &Connection) -> Result<Vec<ExclusionRule>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, kind, value, enabled
            FROM exclusion_rules
            ORDER BY enabled DESC, kind ASC, value ASC
            "#,
        )
        .map_err(map_db_error)?;
    let rows = statement.query_map([], row_to_rule).map_err(map_db_error)?;

    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(map_db_error)
}

fn get_rule_by_id(connection: &Connection, id: &str) -> Result<ExclusionRule, String> {
    connection
        .query_row(
            "SELECT id, kind, value, enabled FROM exclusion_rules WHERE id = ?1",
            params![id],
            row_to_rule,
        )
        .optional()
        .map_err(map_db_error)?
        .ok_or_else(|| "RULE_NOT_FOUND".to_string())
}

fn rule_duplicate_exists(
    connection: &Connection,
    id: Option<&str>,
    kind: &str,
    value: &str,
) -> Result<bool, String> {
    let count = connection
        .query_row(
            r#"
            SELECT COUNT(*)
            FROM exclusion_rules
            WHERE kind = ?1 AND value = ?2 AND (?3 IS NULL OR id != ?3)
            "#,
            params![kind, value, id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(map_db_error)?;

    Ok(count > 0)
}

fn snapshot_matches_rule(snapshot: &ClipboardSnapshot, rule: &ExclusionRule) -> bool {
    if !rule.enabled {
        return false;
    }

    match rule.kind.as_str() {
        "content_kind" => snapshot.kind == rule.value,
        "keyword" => {
            let value = normalized(&rule.value);
            if value.is_empty() {
                return false;
            }

            normalized(&snapshot.title).contains(&value)
                || normalized(&snapshot.preview).contains(&value)
                || snapshot
                    .payload
                    .text_plain
                    .as_deref()
                    .map(|text| normalized(text).contains(&value))
                    .unwrap_or(false)
        }
        "bundle_id" => normalized(&snapshot.source_app) == normalized(&rule.value),
        _ => false,
    }
}

fn snapshot_is_excluded(snapshot: &ClipboardSnapshot, rules: &[ExclusionRule]) -> bool {
    rules
        .iter()
        .any(|rule| snapshot_matches_rule(snapshot, rule))
}

struct ClipboardSnapshot {
    kind: String,
    title: String,
    preview: String,
    source_app: String,
    meta: String,
    content_hash: String,
    payload: ClipboardPayloadSnapshot,
    payload_size_bytes: usize,
    is_truncated: bool,
}

fn clean_preview(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn first_line_title(text: &str) -> String {
    let title = text
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(clean_preview)
        .unwrap_or_else(|| "文本剪贴板".into());

    let mut chars = title.chars();
    let truncated = chars.by_ref().take(28).collect::<String>();

    if chars.next().is_some() {
        format!("{truncated}...")
    } else {
        truncated
    }
}

fn count_lines(text: &str) -> usize {
    text.lines().count().max(1)
}

fn truncate_payload_text(text: &str, limit: usize) -> (String, bool) {
    if text.len() <= limit {
        return (text.to_string(), false);
    }

    let mut end = limit;
    while !text.is_char_boundary(end) {
        end -= 1;
    }

    (text[..end].to_string(), true)
}

fn file_paths_from_text(text: &str) -> Option<Vec<String>> {
    let paths = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(32)
        .map(PathBuf::from)
        .collect::<Vec<_>>();

    if paths.is_empty() || !paths.iter().all(|path| path.exists()) {
        return None;
    }

    Some(
        paths
            .into_iter()
            .map(|path| path.display().to_string())
            .collect(),
    )
}

fn normalize_text_snapshot(text: &str, source_app: &str) -> Option<ClipboardSnapshot> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Some(file_urls) = file_paths_from_text(trimmed) {
        return normalize_file_snapshot(file_urls, source_app);
    }

    let original_size = trimmed.len();
    let (stored_text, is_truncated) = truncate_payload_text(trimmed, TEXT_PAYLOAD_LIMIT_BYTES);
    let preview = clean_preview(&stored_text);
    let preview = if preview.chars().count() > 140 {
        format!("{}...", preview.chars().take(140).collect::<String>())
    } else {
        preview
    };
    let hash = content_hash("text", normalized(trimmed).as_bytes(), &[]);

    Some(ClipboardSnapshot {
        kind: "text".into(),
        title: first_line_title(&stored_text),
        preview,
        source_app: source_app.into(),
        meta: format!(
            "{} 行文本 · {} 字符",
            count_lines(&stored_text),
            stored_text.chars().count()
        ),
        content_hash: hash,
        payload: ClipboardPayloadSnapshot {
            text_plain: Some(stored_text),
            text_html: None,
            text_rtf: None,
            image_bytes: None,
            image_width: None,
            image_height: None,
            file_urls: None,
            extra_json: None,
        },
        payload_size_bytes: original_size,
        is_truncated,
    })
}

fn normalize_rtf_snapshot(
    rtf: &str,
    plain_text: &str,
    source_app: &str,
) -> Option<ClipboardSnapshot> {
    let rtf_trimmed = rtf.trim();
    if !rtf_trimmed.starts_with("{\\rtf") {
        return None;
    }

    let plain = if plain_text.trim().is_empty() {
        "RTF 内容可复制，但当前预览只能显示富文本摘要。".to_string()
    } else {
        plain_text.trim().to_string()
    };
    let original_size = rtf_trimmed.len();
    let (stored_rtf, is_truncated) = truncate_payload_text(rtf_trimmed, TEXT_PAYLOAD_LIMIT_BYTES);
    let (stored_plain, plain_truncated) = truncate_payload_text(&plain, TEXT_PAYLOAD_LIMIT_BYTES);
    let preview = clean_preview(&stored_plain);
    let preview = if preview.chars().count() > 140 {
        format!("{}...", preview.chars().take(140).collect::<String>())
    } else {
        preview
    };
    let hash = content_hash(
        "rtf",
        normalized(&stored_plain).as_bytes(),
        stored_rtf.as_bytes(),
    );

    Some(ClipboardSnapshot {
        kind: "rtf".into(),
        title: first_line_title(&stored_plain),
        preview,
        source_app: source_app.into(),
        meta: format!(
            "RTF · {} 字符 · 可退化为纯文本",
            stored_plain.chars().count()
        ),
        content_hash: hash,
        payload: ClipboardPayloadSnapshot {
            text_plain: Some(stored_plain),
            text_html: None,
            text_rtf: Some(stored_rtf),
            image_bytes: None,
            image_width: None,
            image_height: None,
            file_urls: None,
            extra_json: None,
        },
        payload_size_bytes: original_size,
        is_truncated: is_truncated || plain_truncated,
    })
}

fn normalize_file_snapshot(file_urls: Vec<String>, source_app: &str) -> Option<ClipboardSnapshot> {
    let first_path = file_urls.first()?;
    let primary_name = Path::new(first_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(first_path)
        .to_string();
    let serialized = serde_json::to_string(&file_urls).ok()?;
    let hash = content_hash("file", serialized.as_bytes(), &[]);

    Some(ClipboardSnapshot {
        kind: "file".into(),
        title: primary_name.clone(),
        preview: if file_urls.len() == 1 {
            format!("本地文件：{primary_name}")
        } else {
            format!("{} 个本地文件，首项：{primary_name}", file_urls.len())
        },
        source_app: source_app.into(),
        meta: format!("{} 个文件 · copy-only", file_urls.len()),
        content_hash: hash,
        payload: ClipboardPayloadSnapshot {
            text_plain: Some(file_urls.join("\n")),
            text_html: None,
            text_rtf: None,
            image_bytes: None,
            image_width: None,
            image_height: None,
            file_urls: Some(file_urls),
            extra_json: None,
        },
        payload_size_bytes: serialized.len(),
        is_truncated: false,
    })
}

fn build_image_preview_extra_json(
    bytes: &[u8],
    width: usize,
    height: usize,
) -> Option<serde_json::Value> {
    if width == 0 || height == 0 || bytes.len() < width.saturating_mul(height).saturating_mul(4) {
        return None;
    }

    let max_edge = width.max(height);
    if max_edge <= IMAGE_PREVIEW_MAX_EDGE {
        return Some(json!({
            "previewImage": {
                "bytes": bytes,
                "width": width,
                "height": height,
                "format": "rgba8"
            }
        }));
    }

    let preview_width = (width * IMAGE_PREVIEW_MAX_EDGE / max_edge).max(1);
    let preview_height = (height * IMAGE_PREVIEW_MAX_EDGE / max_edge).max(1);
    let mut preview_bytes = Vec::with_capacity(preview_width * preview_height * 4);

    for y in 0..preview_height {
        let source_y = (y * height / preview_height).min(height - 1);
        for x in 0..preview_width {
            let source_x = (x * width / preview_width).min(width - 1);
            let source_index = (source_y * width + source_x) * 4;
            preview_bytes.extend_from_slice(&bytes[source_index..source_index + 4]);
        }
    }

    Some(json!({
        "previewImage": {
            "bytes": preview_bytes,
            "width": preview_width,
            "height": preview_height,
            "format": "rgba8"
        }
    }))
}

fn normalize_image_snapshot(image: ImageData<'_>, source_app: &str) -> ClipboardSnapshot {
    let width = image.width;
    let height = image.height;
    let bytes = image.bytes.into_owned();
    let payload_size = bytes.len();
    let is_truncated = payload_size > IMAGE_PAYLOAD_LIMIT_BYTES;
    let stored_bytes = if is_truncated {
        None
    } else {
        Some(bytes.clone())
    };
    let hash = content_hash("image", format!("{width}x{height}").as_bytes(), &bytes);

    ClipboardSnapshot {
        kind: "image".into(),
        title: "图片剪贴板".into(),
        preview: format!("读取到 {width}×{height} 图片，P0 采用 best-effort direct paste。"),
        source_app: source_app.into(),
        meta: format!("Image · {width}×{height}"),
        content_hash: hash,
        payload: ClipboardPayloadSnapshot {
            text_plain: None,
            text_html: None,
            text_rtf: None,
            image_bytes: stored_bytes,
            image_width: Some(width),
            image_height: Some(height),
            file_urls: None,
            extra_json: if is_truncated {
                build_image_preview_extra_json(&bytes, width, height)
            } else {
                None
            },
        },
        payload_size_bytes: payload_size,
        is_truncated,
    }
}

fn run_pbpaste(prefer: &str) -> Option<String> {
    let output = Command::new("/usr/bin/pbpaste")
        .args(["-Prefer", prefer])
        .env("LANG", "en_US.UTF-8")
        .output()
        .ok()?;

    if !output.status.success() || output.stdout.is_empty() {
        return None;
    }

    String::from_utf8(output.stdout).ok()
}

fn run_osascript(args: &[&str]) -> Result<String, String> {
    let output = Command::new("/usr/bin/osascript")
        .args(args)
        .output()
        .map_err(|_| "MACOS_API_UNAVAILABLE".to_string())?;

    if !output.status.success() {
        return Err("MACOS_API_UNAVAILABLE".into());
    }

    String::from_utf8(output.stdout)
        .map(|value| value.trim_end_matches('\n').to_string())
        .map_err(|_| "MACOS_API_UNAVAILABLE".to_string())
}

fn applescript_string_literal(value: &str) -> String {
    let escaped = value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\r', "\\r")
        .replace('\n', "\\n");

    format!("\"{escaped}\"")
}

fn run_osascript_stdin(script: &str) -> Result<String, String> {
    let mut child = Command::new("/usr/bin/osascript")
        .arg("-")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|_| "MACOS_API_UNAVAILABLE".to_string())?;

    if let Some(stdin) = child.stdin.as_mut() {
        use std::io::Write;
        stdin
            .write_all(script.as_bytes())
            .map_err(|_| "MACOS_API_UNAVAILABLE".to_string())?;
    }

    let output = child
        .wait_with_output()
        .map_err(|_| "MACOS_API_UNAVAILABLE".to_string())?;

    if !output.status.success() {
        return Err("MACOS_API_UNAVAILABLE".into());
    }

    String::from_utf8(output.stdout)
        .map(|value| value.trim_end_matches('\n').to_string())
        .map_err(|_| "MACOS_API_UNAVAILABLE".to_string())
}

fn read_html_from_nspasteboard() -> Option<String> {
    let script = r#"
use framework "AppKit"
use scripting additions
try
  set pb to current application's NSPasteboard's generalPasteboard()
  set htmlValue to pb's stringForType:(current application's NSPasteboardTypeHTML)
  if htmlValue is missing value then return ""
  return htmlValue as text
on error
  return ""
end try
"#;
    let html = run_osascript_stdin(script).ok()?;

    if html.trim().is_empty() {
        None
    } else {
        Some(html)
    }
}

fn write_html_to_nspasteboard(html: &str, plain: &str) -> Result<(), String> {
    let script = format!(
        r#"
use framework "AppKit"
use scripting additions
set pb to current application's NSPasteboard's generalPasteboard()
pb's clearContents()
set htmlWrite to pb's setString:({}) forType:(current application's NSPasteboardTypeHTML)
set plainWrite to pb's setString:({}) forType:(current application's NSPasteboardTypeString)
if (htmlWrite as boolean) is false then error "html write failed"
if (plainWrite as boolean) is false then error "plain write failed"
return "ok"
"#,
        applescript_string_literal(html),
        applescript_string_literal(plain),
    );

    run_osascript_stdin(&script).map(|_| ())
}

fn write_rtf_to_nspasteboard(rtf: &str, plain: &str) -> Result<(), String> {
    let script = format!(
        r#"
use framework "AppKit"
use scripting additions
set pb to current application's NSPasteboard's generalPasteboard()
pb's clearContents()
set rtfData to (current application's NSString's stringWithString:({}))'s dataUsingEncoding:(current application's NSUTF8StringEncoding)
set rtfWrite to pb's setData:rtfData forType:(current application's NSPasteboardTypeRTF)
set plainWrite to pb's setString:({}) forType:(current application's NSPasteboardTypeString)
if (rtfWrite as boolean) is false then error "rtf write failed"
if (plainWrite as boolean) is false then error "plain write failed"
return "ok"
"#,
        applescript_string_literal(rtf),
        applescript_string_literal(plain),
    );

    run_osascript_stdin(&script).map(|_| ())
}

fn strip_html_tags(html: &str) -> String {
    let mut output = String::new();
    let mut inside_tag = false;

    for character in html.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => {
                inside_tag = false;
                output.push(' ');
            }
            _ if !inside_tag => output.push(character),
            _ => {}
        }
    }

    output
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
}

fn normalize_html_snapshot(
    html: &str,
    plain_text: &str,
    source_app: &str,
) -> Option<ClipboardSnapshot> {
    let html_trimmed = html.trim();
    if html_trimmed.is_empty() {
        return None;
    }

    let plain = if plain_text.trim().is_empty() {
        strip_html_tags(html_trimmed)
    } else {
        plain_text.trim().to_string()
    };
    let original_size = html_trimmed.len();
    let (stored_html, html_truncated) =
        truncate_payload_text(html_trimmed, TEXT_PAYLOAD_LIMIT_BYTES);
    let (stored_plain, plain_truncated) = truncate_payload_text(&plain, TEXT_PAYLOAD_LIMIT_BYTES);
    let preview = clean_preview(&stored_plain);
    let preview = if preview.chars().count() > 140 {
        format!("{}...", preview.chars().take(140).collect::<String>())
    } else {
        preview
    };
    let hash = content_hash(
        "html",
        normalized(&stored_plain).as_bytes(),
        stored_html.as_bytes(),
    );

    Some(ClipboardSnapshot {
        kind: "html".into(),
        title: first_line_title(&stored_plain),
        preview,
        source_app: source_app.into(),
        meta: format!(
            "HTML · {} 字符 · 可退化为纯文本",
            stored_plain.chars().count()
        ),
        content_hash: hash,
        payload: ClipboardPayloadSnapshot {
            text_plain: Some(stored_plain),
            text_html: Some(stored_html),
            text_rtf: None,
            image_bytes: None,
            image_width: None,
            image_height: None,
            file_urls: None,
            extra_json: None,
        },
        payload_size_bytes: original_size,
        is_truncated: html_truncated || plain_truncated,
    })
}

fn check_accessibility_trusted() -> Result<bool, String> {
    let output = run_osascript(&[
        "-l",
        "JavaScript",
        "-e",
        r#"ObjC.import("ApplicationServices"); $.AXIsProcessTrusted() ? "true" : "false""#,
    ])?;

    Ok(output.trim() == "true")
}

fn frontmost_app_bundle_id() -> String {
    run_osascript(&[
        "-l",
        "JavaScript",
        "-e",
        r#"ObjC.import("AppKit"); ObjC.unwrap($.NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier) || """#,
    ])
    .unwrap_or_default()
}

fn read_clipboard_snapshot() -> Result<Option<ClipboardSnapshot>, String> {
    let bundle_id = frontmost_app_bundle_id();
    let source_app = if bundle_id.is_empty() { "System Clipboard".to_string() } else { bundle_id };
    let plain_text = run_pbpaste("txt").unwrap_or_default();

    if let Some(html) = read_html_from_nspasteboard() {
        if let Some(snapshot) = normalize_html_snapshot(&html, &plain_text, &source_app) {
            return Ok(Some(snapshot));
        }
    }

    if let Some(rtf) = run_pbpaste("rtf") {
        if let Some(snapshot) = normalize_rtf_snapshot(&rtf, &plain_text, &source_app) {
            return Ok(Some(snapshot));
        }
    }

    if let Some(snapshot) = normalize_text_snapshot(&plain_text, &source_app) {
        return Ok(Some(snapshot));
    }

    match Clipboard::new().and_then(|mut clipboard| clipboard.get_image()) {
        Ok(image) => Ok(Some(normalize_image_snapshot(image, &source_app))),
        Err(_) => Ok(None),
    }
}

fn row_to_summary(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClipboardItemSummary> {
    let last_seen_at: i64 = row.get("last_seen_at")?;

    Ok(ClipboardItemSummary {
        id: row.get("id")?,
        kind: row.get("kind")?,
        title: row.get("title")?,
        preview: row.get("preview_text")?,
        source_app: row.get("source_app")?,
        meta: row.get("meta")?,
        time_label: time_label_from_epoch(last_seen_at),
        is_pinned: row.get::<_, i64>("is_pinned")? == 1,
        match_type: None,
        matched_fields: Vec::new(),
        highlight_ranges: Vec::new(),
    })
}

fn get_item_by_id(connection: &Connection, id: &str) -> Result<ClipboardItemSummary, String> {
    connection
        .query_row(
            "SELECT * FROM clipboard_items WHERE id = ?1",
            params![id],
            row_to_summary,
        )
        .optional()
        .map_err(map_db_error)?
        .ok_or_else(|| format!("clipboard item not found: {id}"))
}

fn get_payload_by_id(
    connection: &Connection,
    id: &str,
) -> Result<ClipboardPayloadSnapshot, String> {
    connection
        .query_row(
            r#"
            SELECT text_plain, text_html, text_rtf, image_blob, image_width, image_height,
                   file_urls_json, extra_json
            FROM clipboard_payloads
            WHERE item_id = ?1
            "#,
            params![id],
            |row| {
                let file_urls_json: Option<String> = row.get("file_urls_json")?;
                let extra_json: Option<String> = row.get("extra_json")?;

                Ok(ClipboardPayloadSnapshot {
                    text_plain: row.get("text_plain")?,
                    text_html: row.get("text_html")?,
                    text_rtf: row.get("text_rtf")?,
                    image_bytes: row.get("image_blob")?,
                    image_width: row
                        .get::<_, Option<i64>>("image_width")?
                        .map(|value| value as usize),
                    image_height: row
                        .get::<_, Option<i64>>("image_height")?
                        .map(|value| value as usize),
                    file_urls: file_urls_json
                        .and_then(|value| serde_json::from_str::<Vec<String>>(&value).ok()),
                    extra_json: extra_json
                        .and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok()),
                })
            },
        )
        .optional()
        .map_err(map_db_error)?
        .ok_or_else(|| format!("clipboard payload not found: {id}"))
}

fn insert_fts(
    connection: &Connection,
    item: &ClipboardSnapshot,
    item_id: &str,
) -> Result<(), String> {
    let normalized_plain_text = item
        .payload
        .text_plain
        .clone()
        .unwrap_or_else(|| item.preview.clone());

    connection
        .execute(
            r#"
            INSERT INTO fts_clipboard_items(
                item_id, title, preview_text, source_app, meta, normalized_plain_text
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
            params![
                item_id,
                item.title,
                item.preview,
                item.source_app,
                item.meta,
                normalized(&normalized_plain_text)
            ],
        )
        .map_err(map_db_error)?;

    Ok(())
}

fn upsert_clipboard_snapshot(
    connection: &Connection,
    snapshot: ClipboardSnapshot,
    history_limit: usize,
) -> Result<bool, String> {
    let now = now_epoch_secs()?;
    let existing_id = connection
        .query_row(
            "SELECT id FROM clipboard_items WHERE content_hash = ?1",
            params![snapshot.content_hash],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(map_db_error)?;

    if let Some(existing_id) = existing_id {
        connection
            .execute(
                "UPDATE clipboard_items SET last_seen_at = ?1 WHERE id = ?2",
                params![now, existing_id],
            )
            .map_err(map_db_error)?;
        return Ok(false);
    }

    let id = format!(
        "clip-{}-{}",
        now,
        snapshot.content_hash.chars().take(10).collect::<String>()
    );
    let file_urls_json = snapshot
        .payload
        .file_urls
        .as_ref()
        .and_then(|urls| serde_json::to_string(urls).ok());
    let extra_json = snapshot
        .payload
        .extra_json
        .as_ref()
        .and_then(|value| serde_json::to_string(value).ok());

    let transaction = connection.unchecked_transaction().map_err(map_db_error)?;
    transaction
        .execute(
            r#"
            INSERT INTO clipboard_items(
                id, kind, content_hash, title, preview_text, source_app, meta,
                is_pinned, pinned_at, use_count, last_used_at, payload_size_bytes,
                is_truncated, is_sensitive, origin_bundle_id, preview_strategy,
                created_at, last_seen_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, NULL, 0, NULL, ?8, ?9, 0, NULL, 'inline', ?10, ?10)
            "#,
            params![
                &id,
                &snapshot.kind,
                &snapshot.content_hash,
                &snapshot.title,
                &snapshot.preview,
                &snapshot.source_app,
                &snapshot.meta,
                snapshot.payload_size_bytes as i64,
                if snapshot.is_truncated { 1 } else { 0 },
                now,
            ],
        )
        .map_err(map_db_error)?;
    transaction
        .execute(
            r#"
            INSERT INTO clipboard_payloads(
                item_id, text_plain, text_html, text_rtf, image_blob, image_width, image_height,
                file_urls_json, extra_json
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                &id,
                snapshot.payload.text_plain.as_deref(),
                snapshot.payload.text_html.as_deref(),
                snapshot.payload.text_rtf.as_deref(),
                snapshot.payload.image_bytes.as_deref(),
                snapshot.payload.image_width.map(|value| value as i64),
                snapshot.payload.image_height.map(|value| value as i64),
                file_urls_json,
                extra_json,
            ],
        )
        .map_err(map_db_error)?;
    insert_fts(&transaction, &snapshot, &id)?;
    transaction.commit().map_err(map_db_error)?;

    cleanup_history(connection, history_limit)?;

    Ok(true)
}

fn cleanup_history(connection: &Connection, limit: usize) -> Result<(), String> {
    connection
        .execute(
            r#"
            DELETE FROM clipboard_items
            WHERE id IN (
                SELECT id
                FROM clipboard_items
                WHERE is_pinned = 0
                ORDER BY last_seen_at DESC
                LIMIT -1 OFFSET ?1
            )
            "#,
            params![limit as i64],
        )
        .map_err(map_db_error)?;

    connection
        .execute(
            "DELETE FROM fts_clipboard_items WHERE item_id NOT IN (SELECT id FROM clipboard_items)",
            [],
        )
        .map_err(map_db_error)?;

    Ok(())
}

fn list_clipboard_items(
    connection: &Connection,
    kind_filter: Option<&str>,
    pinned_only: bool,
) -> Result<Vec<ClipboardItemSummary>, String> {
    let sql = match (kind_filter, pinned_only) {
        (Some(_), true) => format!(
            r#"
            SELECT * FROM clipboard_items
            WHERE kind = ?1 AND is_pinned = 1
            ORDER BY is_pinned DESC, COALESCE(pinned_at, 0) DESC, last_seen_at DESC
            LIMIT {MAX_HISTORY_RESULTS}
        "#
        ),
        (Some(_), false) => format!(
            r#"
            SELECT * FROM clipboard_items
            WHERE kind = ?1
            ORDER BY is_pinned DESC, COALESCE(pinned_at, 0) DESC, last_seen_at DESC
            LIMIT {MAX_HISTORY_RESULTS}
        "#
        ),
        (None, true) => format!(
            r#"
            SELECT * FROM clipboard_items
            WHERE is_pinned = 1
            ORDER BY COALESCE(pinned_at, 0) DESC, last_seen_at DESC
            LIMIT {MAX_HISTORY_RESULTS}
        "#
        ),
        (None, false) => format!(
            r#"
            SELECT * FROM clipboard_items
            ORDER BY is_pinned DESC, COALESCE(pinned_at, 0) DESC, last_seen_at DESC
            LIMIT {MAX_HISTORY_RESULTS}
        "#
        ),
    };

    let mut statement = connection.prepare_cached(&sql).map_err(map_db_error)?;
    let rows = if let Some(kind) = kind_filter {
        statement.query_map(params![kind], row_to_summary).map_err(map_db_error)?
    } else {
        statement.query_map([], row_to_summary).map_err(map_db_error)?
    };

    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(map_db_error)
}

fn like_search_items(
    connection: &Connection,
    query: &str,
    kind_filter: Option<&str>,
    pinned_only: bool,
) -> Result<Vec<ClipboardItemSummary>, String> {
    let pattern = format!("%{}%", normalized(query));

    let base_where = "(lower(title) LIKE ?1 OR lower(preview_text) LIKE ?1 OR lower(source_app) LIKE ?1 OR lower(meta) LIKE ?1)";
    let sql = match (kind_filter, pinned_only) {
        (Some(_), true) => format!(
            "SELECT * FROM clipboard_items WHERE {base_where} AND kind = ?2 AND is_pinned = 1 ORDER BY is_pinned DESC, last_seen_at DESC LIMIT {MAX_HISTORY_RESULTS}"
        ),
        (Some(_), false) => format!(
            "SELECT * FROM clipboard_items WHERE {base_where} AND kind = ?2 ORDER BY is_pinned DESC, last_seen_at DESC LIMIT {MAX_HISTORY_RESULTS}"
        ),
        (None, true) => format!(
            "SELECT * FROM clipboard_items WHERE {base_where} AND is_pinned = 1 ORDER BY is_pinned DESC, last_seen_at DESC LIMIT {MAX_HISTORY_RESULTS}"
        ),
        (None, false) => format!(
            "SELECT * FROM clipboard_items WHERE {base_where} ORDER BY is_pinned DESC, last_seen_at DESC LIMIT {MAX_HISTORY_RESULTS}"
        ),
    };

    let mut statement = connection.prepare_cached(&sql).map_err(map_db_error)?;
    let rows = if let Some(kind) = kind_filter {
        statement.query_map(params![pattern, kind], row_to_summary).map_err(map_db_error)?
    } else {
        statement.query_map(params![pattern], row_to_summary).map_err(map_db_error)?
    };

    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map(|items| annotate_search_results(items, query, "contains"))
        .map_err(map_db_error)
}

fn char_index_from_byte(value: &str, byte_index: usize) -> usize {
    value[..byte_index].chars().count()
}

fn highlight_range_for_field(field: &str, value: &str, query: &str) -> Option<HighlightRange> {
    let normalized_value = normalized(value);
    let normalized_query = normalized(query);
    if normalized_query.is_empty() {
        return None;
    }

    let start_byte = normalized_value.find(&normalized_query)?;
    let end_byte = start_byte + normalized_query.len();

    Some(HighlightRange {
        field: field.into(),
        start: char_index_from_byte(&normalized_value, start_byte),
        end: char_index_from_byte(&normalized_value, end_byte),
    })
}

fn annotate_search_item(
    mut item: ClipboardItemSummary,
    query: &str,
    fallback_match_type: &str,
) -> ClipboardItemSummary {
    let fields = [
        (
            if item.kind == "file" {
                "file_name"
            } else {
                "title"
            },
            item.title.as_str(),
        ),
        ("preview_text", item.preview.as_str()),
        ("source_app", item.source_app.as_str()),
        ("meta", item.meta.as_str()),
    ];
    let normalized_query = normalized(query);
    let mut matched_fields = Vec::new();
    let mut highlight_ranges = Vec::new();
    let mut match_type = fallback_match_type.to_string();

    for (field, value) in fields {
        let normalized_value = normalized(value);
        if normalized_value == normalized_query {
            match_type = "exact".into();
        } else if match_type != "exact" && normalized_value.starts_with(&normalized_query) {
            match_type = "prefix".into();
        }

        if let Some(range) = highlight_range_for_field(field, value, query) {
            matched_fields.push(field.to_string());
            highlight_ranges.push(range);
        }
    }

    item.match_type = Some(match_type);
    item.matched_fields = matched_fields;
    item.highlight_ranges = highlight_ranges;
    item
}

fn annotate_search_results(
    items: Vec<ClipboardItemSummary>,
    query: &str,
    fallback_match_type: &str,
) -> Vec<ClipboardItemSummary> {
    items
        .into_iter()
        .map(|item| annotate_search_item(item, query, fallback_match_type))
        .collect()
}

fn fts_query(query: &str) -> Option<String> {
    let terms = query
        .split_whitespace()
        .map(|term| {
            term.chars()
                .filter(|ch| ch.is_alphanumeric() || *ch == '_' || *ch == '-')
                .collect::<String>()
        })
        .filter(|term| !term.is_empty())
        .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
        .collect::<Vec<_>>();

    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" OR "))
    }
}

fn search_clipboard_items(
    connection: &Connection,
    query: &str,
    kind_filter: Option<&str>,
    pinned_only: bool,
) -> Result<Vec<ClipboardItemSummary>, String> {
    if normalized(query).is_empty() {
        return list_clipboard_items(connection, kind_filter, pinned_only);
    }

    if let Some(match_query) = fts_query(query) {
        let (sql, has_kind) = match (kind_filter, pinned_only) {
            (Some(_), true) => (format!(
                r#"
                SELECT ci.*
                FROM fts_clipboard_items fts
                JOIN clipboard_items ci ON ci.id = fts.item_id
                WHERE fts_clipboard_items MATCH ?1 AND ci.kind = ?2 AND ci.is_pinned = 1
                ORDER BY ci.is_pinned DESC, rank, ci.last_seen_at DESC
                LIMIT {MAX_HISTORY_RESULTS}
            "#
            ), true),
            (Some(_), false) => (format!(
                r#"
                SELECT ci.*
                FROM fts_clipboard_items fts
                JOIN clipboard_items ci ON ci.id = fts.item_id
                WHERE fts_clipboard_items MATCH ?1 AND ci.kind = ?2
                ORDER BY ci.is_pinned DESC, rank, ci.last_seen_at DESC
                LIMIT {MAX_HISTORY_RESULTS}
            "#
            ), true),
            (None, true) => (format!(
                r#"
                SELECT ci.*
                FROM fts_clipboard_items fts
                JOIN clipboard_items ci ON ci.id = fts.item_id
                WHERE fts_clipboard_items MATCH ?1 AND ci.is_pinned = 1
                ORDER BY ci.is_pinned DESC, rank, ci.last_seen_at DESC
                LIMIT {MAX_HISTORY_RESULTS}
            "#
            ), false),
            (None, false) => (format!(
                r#"
                SELECT ci.*
                FROM fts_clipboard_items fts
                JOIN clipboard_items ci ON ci.id = fts.item_id
                WHERE fts_clipboard_items MATCH ?1
                ORDER BY ci.is_pinned DESC, rank, ci.last_seen_at DESC
                LIMIT {MAX_HISTORY_RESULTS}
            "#
            ), false),
        };

        let mut statement = connection.prepare_cached(&sql).map_err(map_db_error)?;
        let rows = if has_kind {
            statement.query_map(params![match_query, kind_filter.unwrap()], row_to_summary)
        } else {
            statement.query_map(params![match_query], row_to_summary)
        };

        if let Ok(rows) = rows {
            let results = rows
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(map_db_error)?;
            if !results.is_empty() {
                return Ok(annotate_search_results(results, query, "contains"));
            }
        }
    }

    like_search_items(connection, query, kind_filter, pinned_only)
}

fn write_text_with_pbcopy(text: &str) -> Result<(), String> {
    let mut child = Command::new("/usr/bin/pbcopy")
        .env("LANG", "en_US.UTF-8")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|_| "PASTEBOARD_WRITE_FAILED".to_string())?;

    if let Some(stdin) = child.stdin.as_mut() {
        use std::io::Write;
        stdin
            .write_all(text.as_bytes())
            .map_err(|_| "PASTEBOARD_WRITE_FAILED".to_string())?;
    }

    let status = child
        .wait()
        .map_err(|_| "PASTEBOARD_WRITE_FAILED".to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("PASTEBOARD_WRITE_FAILED".into())
    }
}

fn write_payload_to_clipboard(payload: &ClipboardPayloadSnapshot) -> Result<(), String> {
    if let (Some(bytes), Some(width), Some(height)) = (
        payload.image_bytes.as_ref(),
        payload.image_width,
        payload.image_height,
    ) {
        let mut clipboard = Clipboard::new().map_err(|_| "PASTEBOARD_WRITE_FAILED".to_string())?;
        clipboard
            .set_image(ImageData {
                width,
                height,
                bytes: Cow::Borrowed(bytes.as_slice()),
            })
            .map_err(|_| "PASTEBOARD_WRITE_FAILED".to_string())?;
        return Ok(());
    }

    if let Some(html) = payload.text_html.as_deref() {
        let plain = payload.text_plain.as_deref().unwrap_or_else(|| html);
        return write_html_to_nspasteboard(html, plain);
    }

    if let Some(rtf) = payload.text_rtf.as_deref() {
        let plain = payload.text_plain.as_deref().unwrap_or("");
        return write_rtf_to_nspasteboard(rtf, plain);
    }

    if let Some(paths) = payload.file_urls.as_ref() {
        return write_text_with_pbcopy(&paths.join("\n"));
    }

    if let Some(text) = payload.text_plain.as_deref() {
        return write_text_with_pbcopy(text);
    }

    Err("PAYLOAD_UNSUPPORTED".into())
}

fn trigger_direct_paste() -> Result<(), String> {
    let status = Command::new("/usr/bin/osascript")
        .args([
            "-e",
            r#"tell application "System Events" to keystroke "v" using command down"#,
        ])
        .status()
        .map_err(|_| "TARGET_APP_NOT_FOCUSED".to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("TARGET_APP_NOT_FOCUSED".into())
    }
}

fn mark_self_write_hash(state: &State<'_, AppState>, hash: String) {
    if let Ok(mut monitor_state) = state.monitor_state.lock() {
        monitor_state.self_write_hash = Some(hash);
    }
}

fn content_hash_for_item(connection: &Connection, id: &str) -> Result<String, String> {
    connection
        .query_row(
            "SELECT content_hash FROM clipboard_items WHERE id = ?1",
            params![id],
            |row| row.get::<_, String>(0),
        )
        .map_err(map_db_error)
}

fn mark_item_used(connection: &Connection, id: &str) -> Result<(), String> {
    let now = now_epoch_secs()?;
    connection
        .execute(
            r#"
            UPDATE clipboard_items
            SET use_count = use_count + 1, last_used_at = ?1
            WHERE id = ?2
            "#,
            params![now, id],
        )
        .map_err(map_db_error)?;

    Ok(())
}

fn build_copy_result(item: &ClipboardItemSummary) -> ClipboardActionResult {
    ClipboardActionResult {
        item_id: item.id.clone(),
        status: "completed".into(),
        mode: "copy_only".into(),
        message: "已复制到剪贴板，可手动粘贴。".into(),
        fallback_used: false,
        degraded: false,
        error_code: None,
    }
}

fn build_paste_result(
    item: &ClipboardItemSummary,
    accessibility_trusted: bool,
    direct_paste_result: Result<(), String>,
) -> ClipboardActionResult {
    if item.kind == "file" {
        return ClipboardActionResult {
            item_id: item.id.clone(),
            status: "completed".into(),
            mode: "copy_only".into(),
            message: "文件在 P0 固定走仅复制，不承诺 direct paste。".into(),
            fallback_used: false,
            degraded: false,
            error_code: None,
        };
    }

    if !accessibility_trusted {
        return ClipboardActionResult {
            item_id: item.id.clone(),
            status: "completed".into(),
            mode: "copy_only".into(),
            message: "未授予 Accessibility，已回退为仅复制。".into(),
            fallback_used: true,
            degraded: false,
            error_code: Some("NO_ACCESSIBILITY".into()),
        };
    }

    if let Err(error_code) = direct_paste_result {
        return ClipboardActionResult {
            item_id: item.id.clone(),
            status: "completed".into(),
            mode: "copy_only".into(),
            message: "直接粘贴未能确认完成，已保留为仅复制，可手动粘贴。".into(),
            fallback_used: true,
            degraded: false,
            error_code: Some(error_code),
        };
    }

    if item.kind == "html" || item.kind == "rtf" {
        return ClipboardActionResult {
            item_id: item.id.clone(),
            status: "completed".into(),
            mode: "direct_paste".into(),
            message: "已尝试富文本粘贴；若目标不保留格式，可继续使用纯文本内容。".into(),
            fallback_used: false,
            degraded: true,
            error_code: Some("RICH_TEXT_DEGRADED".into()),
        };
    }

    ClipboardActionResult {
        item_id: item.id.clone(),
        status: "completed".into(),
        mode: "direct_paste".into(),
        message: "已直接粘贴到目标应用。".into(),
        fallback_used: false,
        degraded: false,
        error_code: None,
    }
}

fn filter_items(items: &[ClipboardItemSummary], query: &str) -> Vec<ClipboardItemSummary> {
    let normalized_query = normalized(query);

    if normalized_query.is_empty() {
        return items.to_vec();
    }

    items
        .iter()
        .filter(|item| {
            [
                item.title.as_str(),
                item.preview.as_str(),
                item.source_app.as_str(),
                item.meta.as_str(),
            ]
            .join(" ")
            .to_lowercase()
            .contains(&normalized_query)
        })
        .cloned()
        .collect()
}

fn has_saved_session_state(session_ui_state: &SessionUiStateResponse) -> bool {
    !session_ui_state.query.trim().is_empty()
        || session_ui_state.selected_item_id.is_some()
        || session_ui_state.scroll_anchor.is_some()
}

fn derive_presentation_reason(
    query: &str,
    items: &[ClipboardItemSummary],
    is_recovery_mode: bool,
) -> String {
    if is_recovery_mode {
        return "recovery_mode".into();
    }

    if normalized(query).is_empty() && items.is_empty() {
        return "no_history".into();
    }

    if !normalized(query).is_empty() && filter_items(items, query).is_empty() {
        return "search_empty".into();
    }

    "manual_open".into()
}

fn sync_runtime_state_from_session(
    runtime_state: &mut RuntimeStateResponse,
    session_ui_state: &SessionUiStateResponse,
) {
    runtime_state.presentation_reason = session_ui_state.presentation_reason.clone();
    runtime_state.restored_from_session = session_ui_state.restored_from_session;
    runtime_state.updated_at = session_ui_state.updated_at.clone();
}

fn build_runtime_timestamp() -> Result<String, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "UNKNOWN".to_string())?
        .as_secs();

    Ok(format!("unix-{timestamp}"))
}

fn push_recent_error_code(state: &State<'_, AppState>, error_code: &str, context: &str) {
    record_recent_error(
        state,
        RecentErrorRecord {
            error_code: error_code.into(),
            context: context.into(),
            occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
            startup_phase: None,
            setting_value: None,
        },
    );
}

fn log_recent_error_record(record: &RecentErrorRecord) {
    eprintln!(
        "{}",
        json!({
            "level": "warn",
            "event": "superclip_recent_error",
            "error_code": record.error_code.clone(),
            "context": record.context.clone(),
            "occurred_at": record.occurred_at.clone()
        })
    );
}

fn record_recent_error(state: &State<'_, AppState>, record: RecentErrorRecord) {
    log_recent_error_record(&record);

    if let Ok(mut recent_errors) = state.recent_errors.lock() {
        recent_errors.push(record);

        if recent_errors.len() > RECENT_ERROR_LIMIT {
            let overflow = recent_errors.len() - RECENT_ERROR_LIMIT;
            recent_errors.drain(0..overflow);
        }
    }
}

fn record_window_fallback(state: &State<'_, AppState>, record: WindowFallbackRecord) {
    if let Ok(mut window_fallback_records) = state.window_fallback_records.lock() {
        window_fallback_records.push(record);

        if window_fallback_records.len() > WINDOW_FALLBACK_RECORD_LIMIT {
            let overflow = window_fallback_records.len() - WINDOW_FALLBACK_RECORD_LIMIT;
            window_fallback_records.drain(0..overflow);
        }
    }
}

fn record_paste_outcome(
    app: &tauri::AppHandle,
    state: &State<'_, AppState>,
    result: &ClipboardActionResult,
) {
    let Some(error_code) = result.error_code.clone() else {
        return;
    };

    let context = if error_code == "NO_ACCESSIBILITY" {
        "paste-failed/no_accessibility".to_string()
    } else if result.degraded {
        "paste-failed/degraded_plain_text".to_string()
    } else if result.fallback_used {
        "paste-failed/fallback_copy_only".to_string()
    } else {
        "paste-failed/unknown".to_string()
    };

    record_recent_error(
        state,
        RecentErrorRecord {
            error_code: error_code.clone(),
            context: context.clone(),
            occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
            startup_phase: None,
            setting_value: None,
        },
    );

    emit_superclip_event(
        app,
        "paste-failed",
        json!({
            "item_id": result.item_id.clone(),
            "error_code": error_code,
            "context": context,
            "mode": result.mode.clone(),
            "fallback_used": result.fallback_used,
            "degraded": result.degraded
        }),
    );
}

fn record_shortcut_conflict(
    state: &State<'_, AppState>,
    binding: &str,
    validation: &ShortcutValidationResponse,
) {
    let Some(conflict_type) = validation.conflict_type.clone() else {
        return;
    };

    let error_code = if conflict_type == "system" {
        "SHORTCUT_CONFLICT_SYSTEM"
    } else {
        "SHORTCUT_CONFLICT_APP"
    };
    let target = validation
        .conflict_target
        .clone()
        .unwrap_or_else(|| "unknown".into());

    record_recent_error(
        state,
        RecentErrorRecord {
            error_code: error_code.into(),
            context: format!("shortcut-conflict-detected/{binding}/{target}"),
            occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
            startup_phase: None,
            setting_value: None,
        },
    );
}

fn record_window_position_error(state: &State<'_, AppState>, context: &str) {
    record_recent_error(
        state,
        RecentErrorRecord {
            error_code: "WINDOW_POSITION_UNAVAILABLE".into(),
            context: context.into(),
            occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
            startup_phase: None,
            setting_value: None,
        },
    );
}

fn record_recovery_mode_block(state: &State<'_, AppState>, context: &str) {
    record_recent_error(
        state,
        RecentErrorRecord {
            error_code: "RECOVERY_MODE_READ_ONLY".into(),
            context: format!("recovery-mode-blocked/{context}"),
            occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
            startup_phase: None,
            setting_value: None,
        },
    );
}

fn build_display_id(monitor: &tauri::Monitor) -> String {
    monitor
        .name()
        .cloned()
        .unwrap_or_else(|| format!("display-{}x{}", monitor.position().x, monitor.position().y))
}

fn build_safe_area_snapshot(monitor: &tauri::Monitor) -> SafeAreaSnapshot {
    let work_area = monitor.work_area();

    SafeAreaSnapshot {
        origin_x: work_area.position.x,
        origin_y: work_area.position.y,
        width: work_area.size.width,
        height: work_area.size.height,
        scale_factor: monitor.scale_factor(),
    }
}

fn monitor_contains_physical_point(monitor: &tauri::Monitor, x: f64, y: f64) -> bool {
    let position = monitor.position();
    let size = monitor.size();
    let min_x = position.x as f64;
    let min_y = position.y as f64;
    let max_x = min_x + size.width as f64;
    let max_y = min_y + size.height as f64;

    x >= min_x && x < max_x && y >= min_y && y < max_y
}

fn find_monitor_for_physical_point(
    window: &tauri::WebviewWindow,
    x: f64,
    y: f64,
) -> Option<tauri::Monitor> {
    window
        .available_monitors()
        .ok()?
        .into_iter()
        .find(|monitor| monitor_contains_physical_point(monitor, x, y))
}

fn safe_area_logical_bounds(snapshot: &SafeAreaSnapshot) -> (f64, f64, f64, f64) {
    let scale_factor = snapshot.scale_factor.max(1.0);

    (
        snapshot.origin_x as f64 / scale_factor,
        snapshot.origin_y as f64 / scale_factor,
        snapshot.width as f64 / scale_factor,
        snapshot.height as f64 / scale_factor,
    )
}

fn clamp_window_position(
    safe_area_snapshot: &SafeAreaSnapshot,
    width: f64,
    height: f64,
    preferred_position: Option<(f64, f64)>,
) -> Option<(f64, f64)> {
    let (safe_x, safe_y, safe_width, safe_height) = safe_area_logical_bounds(safe_area_snapshot);

    if safe_width <= 0.0 || safe_height <= 0.0 {
        return preferred_position;
    }

    let max_x = (safe_x + safe_width - width).max(safe_x);
    let max_y = (safe_y + safe_height - height).max(safe_y);
    let (preferred_x, preferred_y) = preferred_position.unwrap_or((
        safe_x + (safe_width - width).max(0.0) / 2.0,
        safe_y + (safe_height - height).max(0.0) / 2.0,
    ));

    Some((
        preferred_x.clamp(safe_x, max_x),
        preferred_y.clamp(safe_y, max_y),
    ))
}

fn current_window_center(window: &tauri::WebviewWindow, scale_factor: f64) -> Option<(f64, f64)> {
    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    let scale_factor = scale_factor.max(1.0);

    Some((
        position.x as f64 / scale_factor + size.width as f64 / scale_factor / 2.0,
        position.y as f64 / scale_factor + size.height as f64 / scale_factor / 2.0,
    ))
}

fn resolve_window_placement(
    window: &tauri::WebviewWindow,
    requested_mode: WindowSizeMode,
    preserve_center: bool,
    target_monitor: Option<tauri::Monitor>,
) -> Result<WindowPlacementDecision, String> {
    let current_monitor = window
        .current_monitor()
        .map_err(|_| "WINDOW_POSITION_UNAVAILABLE".to_string())?;
    let primary_monitor = window
        .primary_monitor()
        .map_err(|_| "WINDOW_POSITION_UNAVAILABLE".to_string())?;
    let monitor = target_monitor
        .or(current_monitor)
        .or(primary_monitor)
        .ok_or_else(|| "WINDOW_POSITION_UNAVAILABLE".to_string())?;
    let safe_area_snapshot = build_safe_area_snapshot(&monitor);
    let (_, _, logical_width, logical_height) = safe_area_logical_bounds(&safe_area_snapshot);
    let (requested_width, requested_height) = requested_mode.dimensions();

    let (window_mode, fallback_reason, width, height) =
        if logical_width >= requested_width && logical_height >= requested_height {
            (
                requested_mode.as_str().to_string(),
                None,
                requested_width,
                requested_height,
            )
        } else {
            (
                WINDOW_MODE_FALLBACK.to_string(),
                Some("safe_area_fallback".to_string()),
                (logical_width - WINDOW_SAFE_AREA_MARGIN_X)
                    .max(520.0)
                    .min(requested_width),
                (logical_height - WINDOW_SAFE_AREA_MARGIN_Y)
                    .max(480.0)
                    .min(requested_height),
            )
        };

    let preferred_position = if preserve_center {
        current_window_center(window, safe_area_snapshot.scale_factor)
            .map(|(center_x, center_y)| (center_x - width / 2.0, center_y - height / 2.0))
    } else {
        None
    };
    let position = clamp_window_position(&safe_area_snapshot, width, height, preferred_position);

    Ok(WindowPlacementDecision {
        display_id: build_display_id(&monitor),
        window_mode,
        fallback_reason,
        safe_area_snapshot,
        width,
        height,
        position,
    })
}

struct WindowPlacementApplyGuard<'a> {
    coordinator: &'a Mutex<WindowPlacementCoordinator>,
}

impl Drop for WindowPlacementApplyGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut coordinator) = self.coordinator.lock() {
            coordinator.finish_apply(Instant::now());
        }
    }
}

fn begin_window_placement<'a, 'r>(
    state: &'a State<'r, AppState>,
) -> Result<Option<WindowPlacementApplyGuard<'a>>, String> {
    let mut coordinator = state
        .window_placement
        .lock()
        .map_err(|_| "window placement coordinator unavailable".to_string())?;

    if !coordinator.begin_apply() {
        return Ok(None);
    }

    Ok(Some(WindowPlacementApplyGuard {
        coordinator: &state.window_placement,
    }))
}

fn runtime_state_snapshot(state: &State<'_, AppState>) -> Result<RuntimeStateResponse, String> {
    state
        .runtime_state
        .lock()
        .map(|runtime_state| runtime_state.clone())
        .map_err(|_| "runtime state unavailable".to_string())
}

fn should_ignore_programmatic_resize(state: &State<'_, AppState>) -> bool {
    state
        .window_placement
        .lock()
        .map(|mut coordinator| coordinator.should_ignore_resize(Instant::now()))
        .unwrap_or(false)
}

fn apply_window_placement(
    window: &tauri::WebviewWindow,
    state: &State<'_, AppState>,
    requested_mode: WindowSizeMode,
    preserve_center: bool,
    target_monitor: Option<tauri::Monitor>,
) -> Result<RuntimeStateResponse, String> {
    let Some(_placement_guard) = begin_window_placement(state)? else {
        return runtime_state_snapshot(state);
    };
    let decision =
        resolve_window_placement(window, requested_mode, preserve_center, target_monitor)?;
    let updated_at = build_runtime_timestamp()?;

    let _ = window.set_fullscreen(false);
    let _ = window.unmaximize();
    window
        .set_size(tauri::LogicalSize::new(decision.width, decision.height))
        .map_err(|_| "WINDOW_POSITION_UNAVAILABLE".to_string())?;

    if let Some((x, y)) = decision.position {
        window
            .set_position(tauri::LogicalPosition::new(x, y))
            .map_err(|_| "WINDOW_POSITION_UNAVAILABLE".to_string())?;
    } else if decision.window_mode == WINDOW_MODE_FALLBACK {
        window
            .center()
            .map_err(|_| "WINDOW_POSITION_UNAVAILABLE".to_string())?;
    }

    let mut runtime_state = state
        .runtime_state
        .lock()
        .map_err(|_| "runtime state unavailable".to_string())?;
    let should_record_fallback = decision.fallback_reason.is_some()
        && (runtime_state.last_display_id != decision.display_id
            || runtime_state.last_window_mode != decision.window_mode
            || runtime_state.fallback_reason != decision.fallback_reason);

    runtime_state.last_display_id = decision.display_id.clone();
    runtime_state.last_window_mode = decision.window_mode.clone();
    runtime_state.fallback_reason = decision.fallback_reason.clone();
    runtime_state.updated_at = updated_at.clone();

    let next_state = runtime_state.clone();
    drop(runtime_state);

    if should_record_fallback {
        record_window_fallback(
            state,
            WindowFallbackRecord {
                display_id: decision.display_id,
                fallback_reason: decision
                    .fallback_reason
                    .unwrap_or_else(|| "none".to_string()),
                window_mode: decision.window_mode,
                safe_area_snapshot: Some(decision.safe_area_snapshot),
                occurred_at: updated_at,
            },
        );
    }

    Ok(next_state)
}

fn handle_main_window_resized(app: &tauri::AppHandle) {
    let state: State<'_, AppState> = app.state();

    let _ = should_ignore_programmatic_resize(&state);
}

fn record_shortcut_runtime_error(
    state: &State<'_, AppState>,
    error_code: &str,
    binding: &str,
    startup_phase: Option<&str>,
) {
    record_recent_error(
        state,
        RecentErrorRecord {
            error_code: error_code.into(),
            context: format!("shortcut-registration/{binding}"),
            occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
            startup_phase: startup_phase.map(|value| value.into()),
            setting_value: None,
        },
    );
}

fn register_shortcut_binding(
    app: &tauri::AppHandle,
    state: &State<'_, AppState>,
    binding: &str,
) -> Result<ShortcutStateResponse, String> {
    let previous_state = state
        .shortcut_state
        .lock()
        .map_err(|_| "shortcut state unavailable".to_string())?
        .clone();
    let previous_binding = previous_state.binding.clone();
    let previously_registered = previous_state.is_registered;
    let global_shortcut = app.global_shortcut();

    if !global_shortcut.is_registered(binding) {
        global_shortcut.register(binding).map_err(|_| {
            record_shortcut_runtime_error(
                state,
                "SHORTCUT_REGISTER_FAILED",
                binding,
                Some("shortcut_registration"),
            );
            "SHORTCUT_REGISTER_FAILED".to_string()
        })?;
    }

    if previous_binding != binding
        && previously_registered
        && global_shortcut.is_registered(previous_binding.as_str())
    {
        if let Err(error) = global_shortcut.unregister(previous_binding.as_str()) {
            let _ = error;
            record_shortcut_runtime_error(
                state,
                "SHORTCUT_UNREGISTER_FAILED",
                &previous_binding,
                Some("shortcut_registration"),
            );
        }
    }

    let mut shortcut_state = state
        .shortcut_state
        .lock()
        .map_err(|_| "shortcut state unavailable".to_string())?;
    *shortcut_state = build_shortcut_state(binding, true);

    Ok(shortcut_state.clone())
}

fn toggle_popup_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("popup") else {
        return;
    };

    if let Some(state) = app.try_state::<AppState>() {
        let ready = state.popup_ready.lock().map(|f| *f).unwrap_or(false);
        if !ready {
            // 内容未就绪：记录待显示，前端就绪后自动补显（避免丢弃用户点击）
            if let Ok(mut pending) = state.pending_show_popup.lock() {
                *pending = true;
            }
            return;
        }
        if let Ok(mut pending) = state.pending_show_popup.lock() {
            *pending = false;
        }
    }

    let is_visible = window.is_visible().unwrap_or(false);

    if is_visible {
        #[cfg(target_os = "macos")]
        {
            if let Ok(panel) = app.get_webview_panel("popup") {
                panel.hide();
                return;
            }
        }
        let _ = window.hide();
    } else {
        // 切换互斥：popup 与 quick_panel 共用托盘下方锚点，显示 popup 时先隐藏 quick_panel，
        // 避免两面板叠加时快速覆盖造成的闪屏
        hide_quick_panel_window(app);
        position_popup_window(app, &window);

        #[cfg(target_os = "macos")]
        {
            unsafe {
                let cls =
                    tauri_nspanel::objc2::runtime::AnyClass::get(c"NSApplication").unwrap();
                let ns_app: *mut tauri_nspanel::objc2::runtime::AnyObject =
                    tauri_nspanel::objc2::msg_send![cls, sharedApplication];
                let _: () =
                    tauri_nspanel::objc2::msg_send![ns_app, activateIgnoringOtherApps: true];
            }
            if let Ok(panel) = app.get_webview_panel("popup") {
                panel.show_and_make_key();
                return;
            }
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// 与 tao set_outer_position 相同的坐标基准：Tauri 逻辑 y（主屏顶向下）经主屏物理高度
// 翻转后作为窗口左上角的屏幕坐标；setFrame 的 frame.origin 是窗口左下角，故再减去窗口高。
#[cfg(target_os = "macos")]
extern "C" {
    fn CGMainDisplayID() -> u32;
    fn CGDisplayPixelsHigh(display: u32) -> usize;
}

/// macOS：同步设置 panel frame（setFrame:display: 为同步 API，立即生效）。
/// 异步 window.set_position 经 dispatch_async 延迟到下一 runloop 才移动窗口，而
/// show_and_make_key 同步显示时窗口仍在旧位置（初始默认=屏幕中央），造成「先闪旧位置→
/// 再跳变到目标位置」的闪屏；隐藏状态下同步 setFrame 可避免。
#[cfg(target_os = "macos")]
fn set_panel_frame_sync(
    app: &tauri::AppHandle,
    label: &str,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> bool {
    let Ok(panel) = app.get_webview_panel(label) else {
        return false;
    };
    unsafe {
        let main_pixels_high = CGDisplayPixelsHigh(CGMainDisplayID()) as f64;
        let rect = tauri_nspanel::NSRect::new(
            tauri_nspanel::NSPoint::new(x, main_pixels_high - y - h),
            tauri_nspanel::NSSize::new(w, h),
        );
        let _: () =
            tauri_nspanel::objc2::msg_send![panel.as_panel(), setFrame: rect, display: false];
    }
    true
}

/// Popup 定位：与快捷面板同一视觉锚点（托盘图标下方的菜单栏位置）。
/// 快捷键唤起时贴「光标所在屏」：以托盘图标相对其屏幕右缘的距离与菜单栏厚度为基准，
/// 转置到光标所在显示器的菜单栏下方；托盘左键点击时光标本就在图标处，行为与快捷面板一致。
/// 无 tray rect 等异常时回退为屏幕居中（原行为）。
fn position_popup_window(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
    const POPUP_W: f64 = 300.0;
    const POPUP_H: f64 = 460.0;
    const MENU_BAR_GAP: f64 = 5.0;
    const SCREEN_MARGIN: f64 = 6.0;

    let tray_rect = app.try_state::<AppState>().and_then(|state| {
        state
            .tray_icon
            .lock()
            .ok()
            .and_then(|guard| guard.as_ref().and_then(|tray| tray.rect().ok().flatten()))
    });

    let Some(tray_rect) = tray_rect else {
        position_popup_centered(window);
        return;
    };

    // tray rect 为物理像素（参照 position_quick_panel_below_tray 的处理），统一到逻辑坐标
    let icon_pos = tray_rect.position.to_physical::<f64>(1.0);
    let icon_size = tray_rect.size.to_physical::<f64>(1.0);
    let icon_cx = icon_pos.x + icon_size.width / 2.0;
    let icon_cy = icon_pos.y + icon_size.height / 2.0;

    let Some(tray_monitor) = find_monitor_for_physical_point(window, icon_cx, icon_cy) else {
        position_popup_centered(window);
        return;
    };

    // 目标屏 = 光标所在屏；取不到光标位置时退回托盘图标所在屏
    let target_monitor = window
        .cursor_position()
        .ok()
        .and_then(|pos| find_monitor_for_physical_point(window, pos.x, pos.y))
        .unwrap_or_else(|| tray_monitor.clone());

    // 图标相对其屏幕右缘的距离、菜单栏厚度（图标底边即菜单栏底边），转置到目标屏；
    // 单屏时完全等同于快捷面板的图标下定位
    let tray_scale = tray_monitor.scale_factor();
    let tray_right =
        (tray_monitor.position().x as f64 + tray_monitor.size().width as f64) / tray_scale;
    let tray_top = tray_monitor.position().y as f64 / tray_scale;
    let right_delta = tray_right - icon_cx / tray_scale;
    let menu_bar_thickness = (icon_pos.y + icon_size.height) / tray_scale - tray_top;

    let scale = target_monitor.scale_factor();
    let mon_x = target_monitor.position().x as f64 / scale;
    let mon_y = target_monitor.position().y as f64 / scale;
    let mon_w = target_monitor.size().width as f64 / scale;
    let mon_h = target_monitor.size().height as f64 / scale;

    let anchor_cx = mon_x + mon_w - right_delta;
    let x = (anchor_cx - POPUP_W / 2.0)
        .clamp(mon_x + SCREEN_MARGIN, mon_x + mon_w - POPUP_W - SCREEN_MARGIN);
    let max_y = mon_y + (mon_h - POPUP_H - SCREEN_MARGIN).max(SCREEN_MARGIN);
    let y = (mon_y + menu_bar_thickness + MENU_BAR_GAP).clamp(mon_y + SCREEN_MARGIN, max_y);

    #[cfg(target_os = "macos")]
    {
        // 同步 setFrame，避免异步 set_position 在 show 前未生效导致先以默认位置闪现
        if set_panel_frame_sync(app, "popup", x, y, POPUP_W, POPUP_H) {
            return;
        }
    }
    let _ = window.set_position(tauri::LogicalPosition::new(x, y));
}

/// 居中 fallback：无 tray rect 等异常时保持原屏幕居中行为。
fn position_popup_centered(window: &tauri::WebviewWindow) {
    if let Some(monitor) = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
    {
        let scale = monitor.scale_factor();
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();
        let window_width = 300.0_f64;
        let window_height = 460.0_f64;
        let monitor_logical_w = monitor_size.width as f64 / scale;
        let monitor_logical_h = monitor_size.height as f64 / scale;
        let x = monitor_pos.x as f64 / scale + (monitor_logical_w - window_width) / 2.0;
        let y = monitor_pos.y as f64 / scale + (monitor_logical_h - window_height) / 2.0;
        let max_y = monitor_pos.y as f64 / scale + monitor_logical_h - window_height;
        let y = y.min(max_y).max(monitor_pos.y as f64 / scale);
        #[cfg(target_os = "macos")]
        {
            // 同步 setFrame，避免异步 set_position 在 show 前未生效导致先以默认位置闪现
            if set_panel_frame_sync(
                window.app_handle(),
                "popup",
                x,
                y,
                window_width,
                window_height,
            ) {
                return;
            }
        }
        let _ = window.set_position(tauri::LogicalPosition::new(x, y));
    } else {
        use tauri_plugin_positioner::WindowExt;
        let _ = window.move_window(tauri_plugin_positioner::Position::Center);
    }
}

/// 解析三模式主题 → 具体 NSAppearance 名称（纯逻辑，可单测）。
/// system 不返回 nil：macOS 上窗口一旦被 `setAppearance:` 显式锁定过，设 nil 后
/// `prefers-color-scheme` 不会恢复跟随系统（Apple Forums 658818 / Sky.app #60），
/// 因此 system 必须镜像系统当前有效外观的具体值，由 watcher 持续更新。
fn resolve_panel_appearance_name(
    theme_mode: &str,
    system_is_dark: bool,
) -> &'static std::ffi::CStr {
    match theme_mode {
        "light" => c"NSAppearanceNameAqua",
        "dark" => c"NSAppearanceNameDarkAqua",
        _ if system_is_dark => c"NSAppearanceNameDarkAqua",
        _ => c"NSAppearanceNameAqua",
    }
}

/// 读取当前系统有效外观（必须主线程调用）：返回 "dark"/"light"。
/// 读 NSApp.effectiveAppearance.name——系统外观的实时快照，不受窗口显式外观影响。
#[cfg(target_os = "macos")]
fn current_system_appearance_name() -> Option<String> {
    use tauri_nspanel::objc2::runtime::{AnyClass, AnyObject};

    unsafe {
        let app_cls = AnyClass::get(c"NSApplication")?;
        let ns_app: *mut AnyObject = tauri_nspanel::objc2::msg_send![app_cls, sharedApplication];
        if ns_app.is_null() {
            return None;
        }
        let effective: *mut AnyObject = tauri_nspanel::objc2::msg_send![ns_app, effectiveAppearance];
        if effective.is_null() {
            return None;
        }
        let name: *mut AnyObject = tauri_nspanel::objc2::msg_send![effective, name];
        if name.is_null() {
            return None;
        }
        let utf8: *const std::os::raw::c_char = tauri_nspanel::objc2::msg_send![name, UTF8String];
        if utf8.is_null() {
            return None;
        }
        let name_str = std::ffi::CStr::from_ptr(utf8).to_string_lossy().into_owned();
        Some(if name_str.contains("Dark") {
            "dark".to_string()
        } else {
            "light".to_string()
        })
    }
}

/// 三模式主题的原生外观同步：显式 light/dark 时把三个磨砂 panel 的 NSAppearance 固定为
/// Aqua/DarkAqua，并重建 NSVisualEffectView 使其以当前外观初始化渲染；否则 app 主题与系统
/// 外观不一致时磨砂背景与前端 token 错配。system 镜像 NSApp.effectiveAppearance 的具体值
/// （不设 nil，见 resolve_panel_appearance_name 的注释）。
#[cfg(target_os = "macos")]
fn sync_vibrancy_panels_appearance(app: &tauri::AppHandle, theme_mode: &str) {
    use tauri_nspanel::objc2::runtime::{AnyClass, AnyObject};

    let name = match theme_mode {
        "light" | "dark" => resolve_panel_appearance_name(theme_mode, false),
        _ => {
            let Some(system_appearance) = current_system_appearance_name() else {
                // 读取失败时保持现状，等 watcher 下一个 tick 重试
                return;
            };
            resolve_panel_appearance_name("system", system_appearance == "dark")
        }
    };

    // (label, 圆角)：与 create_*_panel 的 apply_vibrancy 半径一致
    for (label, radius) in [("popup", 12.0), ("preview", 12.0), ("quick_panel", 12.0)] {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };
        let Ok(ns_window) = window.ns_window() else {
            continue;
        };
        let ns_window = ns_window as *mut AnyObject;
        unsafe {
            let (Some(appearance_cls), Some(string_cls)) = (
                AnyClass::get(c"NSAppearance"),
                AnyClass::get(c"NSString"),
            ) else {
                continue;
            };
            // stringWithUTF8String: 返回 autoreleased 对象，无需手动释放
            let name_str: *mut AnyObject = tauri_nspanel::objc2::msg_send![
                string_cls,
                stringWithUTF8String: name.as_ptr()
            ];
            // appearanceNamed: 返回 autoreleased；setAppearance 会 retain
            let appearance: *mut AnyObject =
                tauri_nspanel::objc2::msg_send![appearance_cls, appearanceNamed: name_str];
            let () = tauri_nspanel::objc2::msg_send![ns_window, setAppearance: appearance];
        }

        // 重建 NSVisualEffectView：window_vibrancy 的 apply_vibrancy 只 add 不 replace，
        // 且已存在的 view 在 setAppearance 后不重算（asyar #290 同款：blur tint 建窗时
        // 定死）。clear 后重新 apply，让 view 以当前 window appearance 正确初始化渲染。
        // 这是运行时切换磨砂深浅最可靠的业界做法（HardwareVisualizer #1724 同源）。
        let _ = clear_vibrancy(&window);
        let _ = apply_vibrancy(
            &window,
            NSVisualEffectMaterial::Menu,
            Some(NSVisualEffectState::Active),
            Some(radius),
        );
    }

    // 前端主题的唯一事实源：广播 panel 实际应用的有效外观。WKWebView 的
    // prefers-color-scheme 在 setAppearance 锁定后停止跟随系统（Sky.app #37/#60），
    // 前端 matchMedia 不可用，改由本事件 + system_appearance_get 驱动。
    let applied = if name == c"NSAppearanceNameDarkAqua" { "dark" } else { "light" };
    emit_superclip_event(app, "panel-appearance-changed", json!({ "appearance": applied }));
}

/// 前端三模式主题的 system 解析源：主线程读 NSApp.effectiveAppearance。
/// （sync command 主线程执行，与 permission_check_accessibility 同一模式。）
#[tauri::command]
fn system_appearance_get() -> String {
    #[cfg(target_os = "macos")]
    {
        current_system_appearance_name().unwrap_or_else(|| "light".into())
    }
    #[cfg(not(target_os = "macos"))]
    {
        "light".to_string()
    }
}

/// 系统外观跟随 watcher：周期检测 NSApp.effectiveAppearance 变化，当前主题为 system 时
/// 把三个磨砂 panel 镜像到系统最新外观（经由主线程执行 AppKit 调用）。
#[cfg(target_os = "macos")]
fn start_system_appearance_watcher(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(MONITOR_POLL_MS));
        // AppHandle 是 Send + Clone：run_on_main_thread 借用外层，闭包内用 clone 持有
        let app_for_closure = app.clone();
        let _ = app.run_on_main_thread(move || {
            let Some(current) = current_system_appearance_name() else {
                return;
            };
            let state = app_for_closure.state::<AppState>();
            let mut last = state
                .last_system_appearance
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            if last.as_deref() == Some(current.as_str()) {
                return;
            }
            *last = Some(current.clone());
            let theme_mode = state
                .settings
                .lock()
                .map(|settings| settings.theme_mode.clone())
                .unwrap_or_else(|_| "system".into());
            if theme_mode == "system" {
                sync_vibrancy_panels_appearance(&app_for_closure, "system");
            }
        });
    });
}

/// 快捷面板定位：水平居中于托盘图标，顶部与菜单栏保持小间距。
/// positioner 的 TrayCenter 在 macOS 上 y=tray_y-window_h<0 时会贴到 y=0，
/// 面板顶部嵌入菜单栏；这里改为图标底边 + 固定间距（业界惯例 ~5pt），
/// 并 clamp 在图标所在显示器内（多屏时托盘不一定在主屏）。
fn position_quick_panel_below_tray(
    window: &tauri::WebviewWindow,
    tray_rect: Option<tauri::Rect>,
) {
    const PANEL_W: f64 = 300.0;
    const MENU_BAR_GAP: f64 = 5.0;
    const SCREEN_MARGIN: f64 = 6.0;

    let Some(rect) = tray_rect else {
        use tauri_plugin_positioner::WindowExt;
        let _ = window.move_window(tauri_plugin_positioner::Position::TrayCenter);
        return;
    };

    // tray rect 为物理像素（参照 tauri-plugin-positioner 的处理），统一到逻辑坐标
    let icon_pos = rect.position.to_physical::<f64>(1.0);
    let icon_size = rect.size.to_physical::<f64>(1.0);
    let icon_cx = icon_pos.x + icon_size.width / 2.0;
    let icon_cy = icon_pos.y + icon_size.height / 2.0;

    let monitor = window
        .available_monitors()
        .ok()
        .and_then(|monitors| {
            monitors.into_iter().find(|m| {
                let p = m.position();
                let s = m.size();
                icon_cx >= p.x as f64
                    && icon_cx < p.x as f64 + s.width as f64
                    && icon_cy >= p.y as f64
                    && icon_cy < p.y as f64 + s.height as f64
            })
        })
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        return;
    };

    let scale = monitor.scale_factor();
    let mon_x = monitor.position().x as f64 / scale;
    let mon_w = monitor.size().width as f64 / scale;

    let icon_x = icon_pos.x / scale;
    let icon_w = icon_size.width / scale;
    let icon_bottom = (icon_pos.y + icon_size.height) / scale;

    let x = (icon_x + icon_w / 2.0 - PANEL_W / 2.0)
        .clamp(mon_x + SCREEN_MARGIN, mon_x + mon_w - PANEL_W - SCREEN_MARGIN);
    let y = icon_bottom + MENU_BAR_GAP;

    let panel_h = window.outer_size().ok().map(|s| s.height as f64 / scale).unwrap_or(460.0);
    #[cfg(target_os = "macos")]
    {
        // 同步 setFrame，避免异步 set_position 在 show 前未生效导致先以默认位置闪现
        if set_panel_frame_sync(window.app_handle(), "quick_panel", x, y, PANEL_W, panel_h) {
            return;
        }
    }
    let _ = window.set_position(tauri::LogicalPosition::new(x, y));
}

fn toggle_quick_panel_window(app: &tauri::AppHandle, tray_rect: Option<tauri::Rect>) {
    let Some(window) = app.get_webview_window("quick_panel") else {
        return;
    };

    // 内容就绪门控（与 popup 一致）：首次打开时 webview 可能尚未完成渲染，
    // 未就绪则记录待显示，前端就绪后自动补显，避免空白→内容突然出现的闪屏
    if let Some(state) = app.try_state::<AppState>() {
        let ready = state.quick_panel_ready.lock().map(|f| *f).unwrap_or(false);
        if !ready {
            if let Ok(mut pending) = state.pending_show_quick_panel.lock() {
                *pending = true;
            }
            return;
        }
        if let Ok(mut pending) = state.pending_show_quick_panel.lock() {
            *pending = false;
        }
    }

    let is_visible = window.is_visible().unwrap_or(false);

    if is_visible {
        #[cfg(target_os = "macos")]
        {
            if let Ok(panel) = app.get_webview_panel("quick_panel") {
                panel.hide();
                return;
            }
        }
        let _ = window.hide();
    } else {
        // 切换互斥：popup 与 quick_panel 共用托盘下方锚点，显示 quick_panel 时先隐藏 popup
        //（含 hover preview），避免两面板叠加时快速覆盖造成的闪屏
        hide_popup_window(app);
        position_quick_panel_below_tray(&window, tray_rect);

        #[cfg(target_os = "macos")]
        {
            unsafe {
                let cls =
                    tauri_nspanel::objc2::runtime::AnyClass::get(c"NSApplication").unwrap();
                let ns_app: *mut tauri_nspanel::objc2::runtime::AnyObject =
                    tauri_nspanel::objc2::msg_send![cls, sharedApplication];
                let _: () =
                    tauri_nspanel::objc2::msg_send![ns_app, activateIgnoringOtherApps: true];
            }
            if let Ok(panel) = app.get_webview_panel("quick_panel") {
                panel.show_and_make_key();
                return;
            }
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn hide_popup_window(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut flag) = state.preview_active.lock() {
            *flag = false;
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(panel) = app.get_webview_panel("popup") {
            panel.hide();
        }
        if let Ok(panel) = app.get_webview_panel("preview") {
            panel.hide();
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(window) = app.get_webview_window("popup") {
            let _ = window.hide();
        }
        if let Some(window) = app.get_webview_window("preview") {
            let _ = window.hide();
        }
    }
}

fn hide_quick_panel_window(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    {
        if let Ok(panel) = app.get_webview_panel("quick_panel") {
            panel.hide();
            return;
        }
    }

    if let Some(window) = app.get_webview_window("quick_panel") {
        let _ = window.hide();
    }
}

fn show_main_window(
    app: &tauri::AppHandle,
    presentation_reason: &str,
    fallback_reason: Option<&str>,
    target_point: Option<tauri::PhysicalPosition<f64>>,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        let state: State<'_, AppState> = app.state();
        record_window_position_error(
            &state,
            &format!("window-fallback-used/{presentation_reason}/window_handle_missing"),
        );
        return Err("WINDOW_HANDLE_UNAVAILABLE".into());
    };

    // 内容就绪门控：首次打开（如从快捷面板进入）时 webview 可能尚未完成渲染，
    // 未就绪则记录待显示，前端就绪后自动补显，避免空白→内容突然出现的闪屏
    let state: State<'_, AppState> = app.state();
    let main_ready = state
        .main_window_ready
        .lock()
        .map(|f| *f)
        .unwrap_or(false);
    if !main_ready {
        if let Ok(mut pending) = state.pending_show_main.lock() {
            *pending = true;
        }
        return Ok(());
    }
    if let Ok(mut pending) = state.pending_show_main.lock() {
        *pending = false;
    }

    let _ = window.show();
    let _ = window.unminimize();

    let target_monitor =
        target_point.and_then(|point| find_monitor_for_physical_point(&window, point.x, point.y));

    match apply_window_placement(
        &window,
        &state,
        WindowSizeMode::Small,
        false,
        target_monitor,
    ) {
        Ok(runtime_state) => emit_window_fallback_used(app, &runtime_state, presentation_reason),
        Err(_) => record_window_position_error(
            &state,
            &format!("window-fallback-used/{presentation_reason}/placement_refresh"),
        ),
    }

    if let Ok(mut runtime_state) = state.runtime_state.lock() {
        runtime_state.presentation_reason = presentation_reason.into();
        runtime_state.restored_from_session = true;
        if runtime_state.fallback_reason.is_none() {
            if let Some(fallback_reason) = fallback_reason {
                runtime_state.fallback_reason = Some(fallback_reason.into());
            }
        }
    }

    let _ = window.set_focus();
    Ok(())
}

#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(SuperClipPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

#[cfg(target_os = "macos")]
fn create_popup_panel(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::WebviewUrl;

    let _panel = PanelBuilder::<_, SuperClipPanel>::new(app, "popup")
        .url(WebviewUrl::App("popup.html".into()))
        .level(PanelLevel::MainMenu)
        .collection_behavior(
            CollectionBehavior::new()
                .can_join_all_spaces()
                .full_screen_auxiliary()
                .transient(),
        )
        .hides_on_deactivate(false)
        .transparent(true)
        .floating(true)
        .corner_radius(12.0)
        .with_window(|builder| {
            builder
                .decorations(false)
                .resizable(false)
                .inner_size(300.0, 460.0)
                .visible(false)
                .skip_taskbar(true)
                .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
        })
        .build()
        .map_err(|e| format!("Failed to create popup panel: {e}"))?;

    if let Some(window) = app.get_webview_window("popup") {
        let _ = apply_vibrancy(
            &window,
            NSVisualEffectMaterial::Menu,
            Some(NSVisualEffectState::Active),
            Some(12.0),
        );
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn create_quick_panel_panel(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::WebviewUrl;

    let _panel = PanelBuilder::<_, SuperClipPanel>::new(app, "quick_panel")
        .url(WebviewUrl::App("panel.html".into()))
        .level(PanelLevel::MainMenu)
        .collection_behavior(
            CollectionBehavior::new()
                .can_join_all_spaces()
                .full_screen_auxiliary()
                .transient(),
        )
        .hides_on_deactivate(false)
        .transparent(true)
        .floating(true)
        .corner_radius(12.0)
        .with_window(|builder| {
            builder
                .decorations(false)
                .resizable(false)
                // 尺寸与 popup 统一为 300×460；高度由美化后的间距与内容填充。
                .inner_size(300.0, 460.0)
                .visible(false)
                .skip_taskbar(true)
                .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
        })
        .build()
        .map_err(|e| format!("Failed to create quick panel: {e}"))?;

    // 与 popup/preview 一致的系统磨砂材质（NSVisualEffectView Menu）
    if let Some(window) = app.get_webview_window("quick_panel") {
        let _ = apply_vibrancy(
            &window,
            NSVisualEffectMaterial::Menu,
            Some(NSVisualEffectState::Active),
            Some(12.0),
        );
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn create_preview_panel(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::WebviewUrl;

    let panel = PanelBuilder::<_, SuperClipPanel>::new(app, "preview")
        .url(WebviewUrl::App("preview.html".into()))
        .level(PanelLevel::MainMenu)
        .collection_behavior(
            CollectionBehavior::new()
                .can_join_all_spaces()
                .full_screen_auxiliary()
                .transient(),
        )
        .hides_on_deactivate(false)
        .transparent(true)
        .floating(true)
        .corner_radius(12.0)
        .with_window(|builder| {
            builder
                .decorations(false)
                .resizable(false)
                .inner_size(280.0, 320.0)
                .visible(false)
                .skip_taskbar(true)
                .focused(false)
                .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
        })
        .build()
        .map_err(|e| format!("Failed to create preview panel: {e}"))?;

    if let Some(window) = app.get_webview_window("preview") {
        let _ = apply_vibrancy(
            &window,
            NSVisualEffectMaterial::Menu,
            Some(NSVisualEffectState::Active),
            Some(12.0),
        );
    }

    drop(panel);
    Ok(())
}

#[cfg(target_os = "macos")]
fn apply_macos_dock_policy(app: &tauri::AppHandle, state: &State<'_, AppState>) {
    if let Err(error) = app.set_dock_visibility(false) {
        record_recent_error(
            state,
            RecentErrorRecord {
                error_code: "DOCK_VISIBILITY_POLICY_FAILED".into(),
                context: format!("desktop-controls/dock-visibility/{error}"),
                occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
                startup_phase: Some("desktop_controls".into()),
                setting_value: None,
            },
        );
    }
}

fn install_desktop_controls(app: &tauri::AppHandle, state: &State<'_, AppState>) {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        #[cfg(target_os = "macos")]
        apply_macos_dock_policy(app, state);

        #[cfg(target_os = "macos")]
        {
            if let Err(error) = app.plugin(tauri_nspanel::init()) {
                record_recent_error(
                    state,
                    RecentErrorRecord {
                        error_code: "NSPANEL_PLUGIN_FAILED".into(),
                        context: format!("desktop-controls/nspanel/{error}"),
                        occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
                        startup_phase: Some("desktop_controls".into()),
                        setting_value: None,
                    },
                );
            } else {
                if let Err(error) = create_popup_panel(app) {
                    record_recent_error(
                        state,
                        RecentErrorRecord {
                            error_code: "POPUP_PANEL_CREATE_FAILED".into(),
                            context: format!("desktop-controls/nspanel/popup/{error}"),
                            occurred_at: build_runtime_timestamp()
                                .unwrap_or_else(|_| "unknown".into()),
                            startup_phase: Some("desktop_controls".into()),
                            setting_value: None,
                        },
                    );
                }
                if let Err(error) = create_preview_panel(app) {
                    record_recent_error(
                        state,
                        RecentErrorRecord {
                            error_code: "PREVIEW_PANEL_CREATE_FAILED".into(),
                            context: format!("desktop-controls/nspanel/preview/{error}"),
                            occurred_at: build_runtime_timestamp()
                                .unwrap_or_else(|_| "unknown".into()),
                            startup_phase: Some("desktop_controls".into()),
                            setting_value: None,
                        },
                    );
                }
                if let Err(error) = create_quick_panel_panel(app) {
                    record_recent_error(
                        state,
                        RecentErrorRecord {
                            error_code: "QUICK_PANEL_CREATE_FAILED".into(),
                            context: format!("desktop-controls/nspanel/quick_panel/{error}"),
                            occurred_at: build_runtime_timestamp()
                                .unwrap_or_else(|_| "unknown".into()),
                            startup_phase: Some("desktop_controls".into()),
                            setting_value: None,
                        },
                    );
                }

                // 启动即按持久化主题同步三个磨砂 panel 的原生外观（后续变更由 settings_update 触发）
                let theme_mode = state
                    .settings
                    .lock()
                    .map(|settings| settings.theme_mode.clone())
                    .unwrap_or_else(|_| "system".into());
                sync_vibrancy_panels_appearance(app, &theme_mode);

                // 系统外观跟随 watcher：system 模式下实时镜像到三个磨砂 panel
                start_system_appearance_watcher(app.clone());
            }
        }

        if let Err(error) = app.plugin(tauri_plugin_positioner::init()) {
            record_recent_error(
                state,
                RecentErrorRecord {
                    error_code: "POSITIONER_PLUGIN_FAILED".into(),
                    context: format!("desktop-controls/positioner/{error}"),
                    occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
                    startup_phase: Some("desktop_controls".into()),
                    setting_value: None,
                },
            );
        }

        if let Err(error) = app.plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app_handle, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_popup_window(app_handle);
                    }
                })
                .build(),
        ) {
            record_recent_error(
                state,
                RecentErrorRecord {
                    error_code: "GLOBAL_SHORTCUT_PLUGIN_FAILED".into(),
                    context: format!("desktop-controls/global-shortcut/{error}"),
                    occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
                    startup_phase: Some("desktop_controls".into()),
                    setting_value: None,
                },
            );
        } else {
            let shortcut_binding = state
                .shortcut_state
                .lock()
                .map(|shortcut_state| shortcut_state.binding.clone())
                .unwrap_or_else(|_| DEFAULT_SHORTCUT.to_string());

            if let Err(error) = register_shortcut_binding(app, state, &shortcut_binding) {
                record_recent_error(
                    state,
                    RecentErrorRecord {
                        error_code: error,
                        context: format!(
                            "desktop-controls/global-shortcut/register/{shortcut_binding}"
                        ),
                        occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
                        startup_phase: Some("desktop_controls".into()),
                        setting_value: None,
                    },
                );
            }
        };

        let tray_icon = Image::from_bytes(TRAY_ICON_BYTES)
                            .map(|icon| (icon, true))
                            .ok()
                            .or_else(|| {
                                app.default_window_icon()
                                    .cloned()
                                    .map(|icon| (icon, false))
                            });

                        if let Some((window_icon, icon_as_template)) = tray_icon {
                            let tray_result = TrayIconBuilder::new()
                                .icon(window_icon)
                                .icon_as_template(icon_as_template)
                                .tooltip("SuperClip")
                                .show_menu_on_left_click(false)
                                .on_tray_icon_event(|tray, event| {
                                    tauri_plugin_positioner::on_tray_event(
                                        tray.app_handle(),
                                        &event,
                                    );
                                    if let TrayIconEvent::Click {
                                        button: MouseButton::Left,
                                        button_state: MouseButtonState::Up,
                                        ..
                                    } = event
                                    {
                                        toggle_popup_window(tray.app_handle());
                                    }
                                    if let TrayIconEvent::Click {
                                        button: MouseButton::Right,
                                        button_state: MouseButtonState::Up,
                                        rect,
                                        ..
                                    } = event
                                    {
                                        toggle_quick_panel_window(
                                            tray.app_handle(),
                                            Some(rect),
                                        );
                                    }
                                })
                                .build(app);

                            match tray_result {
                                Ok(tray_icon) => {
                                    if let Ok(mut stored_tray_icon) = state.tray_icon.lock() {
                                        *stored_tray_icon = Some(tray_icon);
                                    } else {
                                        record_recent_error(
                                            state,
                                            RecentErrorRecord {
                                                error_code: "TRAY_HANDLE_STORE_FAILED".into(),
                                                context: "desktop-controls/tray/handle-store"
                                                    .into(),
                                                occurred_at: build_runtime_timestamp()
                                                    .unwrap_or_else(|_| "unknown".into()),
                                                startup_phase: Some("desktop_controls".into()),
                                                setting_value: None,
                                            },
                                        );
                                    }
                                }
                                Err(error) => {
                                    record_recent_error(
                                        state,
                                        RecentErrorRecord {
                                            error_code: "TRAY_SETUP_FAILED".into(),
                                            context: format!("desktop-controls/tray/{error}"),
                                            occurred_at: build_runtime_timestamp()
                                                .unwrap_or_else(|_| "unknown".into()),
                                            startup_phase: Some("desktop_controls".into()),
                                            setting_value: None,
                                        },
                                    );
                                }
                            }
                        } else {
                            record_recent_error(
                                state,
                                RecentErrorRecord {
                                    error_code: "TRAY_ICON_UNAVAILABLE".into(),
                                    context: "desktop-controls/tray/default-window-icon-missing"
                                        .into(),
                                    occurred_at: build_runtime_timestamp()
                                        .unwrap_or_else(|_| "unknown".into()),
                                    startup_phase: Some("desktop_controls".into()),
                                    setting_value: None,
                                },
                            );
                        }
    }
}

#[cfg(target_os = "macos")]
fn handle_dock_reopen(app: &tauri::AppHandle, has_visible_windows: bool) {
    if show_main_window(app, "dock_reopen", Some("dock_reopen"), None).is_ok() {
        let state: State<'_, AppState> = app.state();
        if let Ok(mut runtime_state) = state.runtime_state.lock() {
            runtime_state.presentation_reason = "manual_open".into();
            runtime_state.restored_from_session = true;
            if !has_visible_windows && runtime_state.fallback_reason.is_none() {
                runtime_state.fallback_reason = Some("dock_reopen".into());
            }
        };
    }
}

fn ensure_not_recovery_mode(state: &State<'_, AppState>, context: &str) -> Result<(), String> {
    let runtime_state = state
        .runtime_state
        .lock()
        .map_err(|_| "runtime state unavailable".to_string())?;

    if runtime_state.is_recovery_mode {
        drop(runtime_state);
        record_recovery_mode_block(state, context);
        return Err("RECOVERY_MODE_READ_ONLY".into());
    }

    Ok(())
}

#[tauri::command]
fn clipboard_list(state: State<'_, AppState>) -> Result<Vec<ClipboardItemSummary>, String> {
    let db = state
        .db_read
        .lock()
        .map_err(|_| "clipboard store unavailable".to_string())?;

    list_clipboard_items(&db, None, false)
}

#[tauri::command]
fn clipboard_search(
    query: String,
    kind_filter: Option<String>,
    pinned_only: Option<bool>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ClipboardSearchResponse, String> {
    let started_at = Instant::now();
    let db = state
        .db_read
        .lock()
        .map_err(|_| "clipboard store unavailable".to_string())?;
    let results = search_clipboard_items(&db, &query, kind_filter.as_deref(), pinned_only.unwrap_or(false))?;
    let total = results.len();
    let search_time_ms = started_at.elapsed().as_millis() as u64;
    emit_superclip_event(
        &app,
        "search-results-updated",
        json!({
            "query": query.clone(),
            "total": total,
            "search_time_ms": search_time_ms
        }),
    );

    Ok(ClipboardSearchResponse {
        query: query.clone(),
        normalized_query: normalized(&query),
        total,
        results,
        search_time_ms,
        version: 1,
    })
}

#[tauri::command]
fn clipboard_get(id: String, state: State<'_, AppState>) -> Result<ClipboardItemDetail, String> {
    let db = state
        .db_read
        .lock()
        .map_err(|_| "clipboard store unavailable".to_string())?;

    Ok(ClipboardItemDetail {
        item: get_item_by_id(&db, &id)?,
        payload: get_payload_by_id(&db, &id)?,
        version: 1,
    })
}

#[tauri::command]
fn settings_get(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SettingsResponse, String> {
    let mut next_settings = {
        let db = state
            .db_read
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        load_settings(&db)?
    };

    if let Ok(is_enabled) = app.autolaunch().is_enabled() {
        next_settings.launch_at_login = is_enabled;
    }

    let mut settings = state
        .settings
        .lock()
        .map_err(|_| "settings state unavailable".to_string())?;
    *settings = next_settings.clone();

    Ok(next_settings)
}

#[tauri::command]
fn settings_update(
    patch: SettingsUpdateRequest,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SettingsResponse, String> {
    ensure_not_recovery_mode(&state, "settings:update")?;

    let resolved_launch_at_login = if let Some(launch_at_login) = patch.launch_at_login {
        let manager = app.autolaunch();
        let update_result = if launch_at_login {
            manager.enable()
        } else {
            manager.disable()
        };

        if update_result.is_err() {
            record_recent_error(
                &state,
                RecentErrorRecord {
                    error_code: "LOGIN_ITEM_UPDATE_FAILED".into(),
                    context: "startup-integration-failed/settings_update".into(),
                    occurred_at: build_runtime_timestamp().unwrap_or_else(|_| "unknown".into()),
                    startup_phase: Some("launch_at_login".into()),
                    setting_value: Some(launch_at_login),
                },
            );
            emit_superclip_event(
                &app,
                "startup-integration-failed",
                json!({
                    "error_code": "LOGIN_ITEM_UPDATE_FAILED",
                    "setting_key": "launch_at_login",
                    "setting_value": launch_at_login
                }),
            );

            return Err("LOGIN_ITEM_UPDATE_FAILED".to_string());
        }

        Some(manager.is_enabled().unwrap_or(launch_at_login))
    } else {
        None
    };

    let mut settings = state
        .settings
        .lock()
        .map_err(|_| "settings state unavailable".to_string())?;

    if let Some(default_action) = patch.default_action {
        if default_action != "direct_paste" && default_action != "copy_only" {
            return Err("SETTINGS_INVALID_VALUE".into());
        }
        settings.default_action = default_action;
    }

    if let Some(theme_mode) = patch.theme_mode {
        if theme_mode != "light" && theme_mode != "dark" && theme_mode != "system" {
            return Err("SETTINGS_INVALID_VALUE".into());
        }
        settings.theme_mode = theme_mode;
    }

    if let Some(history_limit) = patch.history_limit {
        settings.history_limit = history_limit.clamp(100, 5_000);
    }

    if let Some(launch_at_login) = resolved_launch_at_login {
        settings.launch_at_login = launch_at_login;
    }

    if let Some(show_on_startup) = patch.show_on_startup {
        settings.show_on_startup = show_on_startup;
    }

    let response = settings.clone();
    drop(settings);

    {
        let db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        save_setting_value(&db, "default_action", &response.default_action)?;
        save_setting_value(&db, "theme_mode", &response.theme_mode)?;
        save_setting_value(&db, "history_limit", &response.history_limit.to_string())?;
        save_setting_value(
            &db,
            "show_on_startup",
            if response.show_on_startup {
                "true"
            } else {
                "false"
            },
        )?;
        cleanup_history(&db, response.history_limit as usize)?;
    }

    #[cfg(target_os = "macos")]
    sync_vibrancy_panels_appearance(&app, &response.theme_mode);

    emit_superclip_event(
        &app,
        "settings-updated",
        json!({
            "default_action": response.default_action,
            "theme_mode": response.theme_mode,
            "history_limit": response.history_limit,
            "launch_at_login": response.launch_at_login,
            "show_on_startup": response.show_on_startup
        }),
    );

    Ok(response)
}

#[tauri::command]
fn rules_list(state: State<'_, AppState>) -> Result<RulesListResponse, String> {
    let rules = {
        let db = state
            .db_read
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        list_exclusion_rules(&db)?
    };

    Ok(RulesListResponse {
        total: rules.len(),
        enabled_count: rules.iter().filter(|rule| rule.enabled).count(),
        rules,
        version: 1,
    })
}

#[tauri::command]
fn rules_upsert(
    payload: RulesUpsertPayload,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<RulesUpsertResponse, String> {
    ensure_not_recovery_mode(&state, "rules:upsert")?;

    let normalized_value = normalize_rule_value(&payload.kind, &payload.value);
    if normalized_value.is_empty() {
        return Err("RULE_INVALID_VALUE".into());
    }

    let now = now_epoch_secs()?;
    let (next_rule, action) = {
        let db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;

        if rule_duplicate_exists(&db, payload.id.as_deref(), &payload.kind, &normalized_value)? {
            push_recent_error_code(&state, "RULE_DUPLICATE", "rules-upsert/duplicate");
            return Err("RULE_DUPLICATE".into());
        }

        let result = if let Some(rule_id) = payload.id {
            let changed = db
                .execute(
                    r#"
                    UPDATE exclusion_rules
                    SET kind = ?1, value = ?2, enabled = ?3, updated_at = ?4
                    WHERE id = ?5
                    "#,
                    params![
                        payload.kind,
                        normalized_value,
                        if payload.enabled { 1 } else { 0 },
                        now,
                        rule_id
                    ],
                )
                .map_err(map_db_error)?;
            if changed == 0 {
                return Err("RULE_NOT_FOUND".into());
            }
            (get_rule_by_id(&db, &rule_id)?, "update")
        } else {
            let next_id = format!("rule-{now}-{}", normalized_value.len());
            db.execute(
                r#"
                INSERT INTO exclusion_rules(id, kind, value, enabled, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                "#,
                params![
                    next_id,
                    payload.kind,
                    normalized_value,
                    if payload.enabled { 1 } else { 0 },
                    now
                ],
            )
            .map_err(map_db_error)?;
            (get_rule_by_id(&db, &next_id)?, "create")
        };

        if let Ok(rules) = list_exclusion_rules(&db) {
            if let Ok(mut cache) = state.exclusion_rules_cache.write() {
                *cache = rules;
            }
        }

        result
    };

    emit_superclip_event(
        &app,
        "exclusion-rules-updated",
        json!({ "action": action, "rule_id": next_rule.id.clone() }),
    );

    Ok(RulesUpsertResponse {
        rule: next_rule,
        version: 1,
    })
}

#[tauri::command]
fn rules_delete(
    rule_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<RulesDeleteResponse, String> {
    ensure_not_recovery_mode(&state, "rules:delete")?;

    {
        let db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        db.execute(
            "DELETE FROM exclusion_rules WHERE id = ?1",
            params![&rule_id],
        )
        .map_err(map_db_error)?;

        if let Ok(rules) = list_exclusion_rules(&db) {
            if let Ok(mut cache) = state.exclusion_rules_cache.write() {
                *cache = rules;
            }
        }
    }
    emit_superclip_event(
        &app,
        "exclusion-rules-updated",
        json!({ "action": "delete", "rule_id": rule_id.clone() }),
    );

    Ok(RulesDeleteResponse {
        rule_id,
        version: 1,
    })
}

#[tauri::command]
fn rules_clear(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<RulesClearResponse, String> {
    ensure_not_recovery_mode(&state, "rules:clear")?;

    let cleared_count = {
        let db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        let count = db
            .query_row("SELECT COUNT(*) FROM exclusion_rules", [], |row| {
                row.get::<_, i64>(0)
            })
            .map_err(map_db_error)? as usize;
        db.execute("DELETE FROM exclusion_rules", [])
            .map_err(map_db_error)?;
        count
    };
    emit_superclip_event(
        &app,
        "exclusion-rules-updated",
        json!({ "action": "clear", "cleared_count": cleared_count }),
    );

    if let Ok(mut cache) = state.exclusion_rules_cache.write() {
        cache.clear();
    }

    Ok(RulesClearResponse {
        cleared_count,
        version: 1,
    })
}

#[tauri::command]
fn session_ui_state_get(state: State<'_, AppState>) -> Result<SessionUiStateResponse, String> {
    let items = {
        let db = state
            .db_read
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        list_clipboard_items(&db, None, false)?
    };
    let mut session_ui_state = state
        .session_ui_state
        .lock()
        .map_err(|_| "session ui state unavailable".to_string())?;
    let mut runtime_state = state
        .runtime_state
        .lock()
        .map_err(|_| "runtime state unavailable".to_string())?;

    session_ui_state.presentation_reason = derive_presentation_reason(
        &session_ui_state.query,
        &items,
        runtime_state.is_recovery_mode,
    );
    session_ui_state.restored_from_session = has_saved_session_state(&session_ui_state);
    session_ui_state.last_display_id = runtime_state.last_display_id.clone();
    session_ui_state.last_window_mode = runtime_state.last_window_mode.clone();

    sync_runtime_state_from_session(&mut runtime_state, &session_ui_state);

    Ok(session_ui_state.clone())
}

#[tauri::command]
fn session_ui_state_update(
    payload: SessionUiStateUpdateRequest,
    state: State<'_, AppState>,
) -> Result<SessionUiStateResponse, String> {
    let items = {
        let db = state
            .db_read
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        list_clipboard_items(&db, None, false)?
    };
    let mut session_ui_state = state
        .session_ui_state
        .lock()
        .map_err(|_| "session ui state unavailable".to_string())?;
    let mut runtime_state = state
        .runtime_state
        .lock()
        .map_err(|_| "runtime state unavailable".to_string())?;
    let updated_at = build_runtime_timestamp()?;

    session_ui_state.query = payload.query;
    session_ui_state.selected_item_id = payload.selected_item_id;
    session_ui_state.scroll_anchor = payload.scroll_anchor;
    session_ui_state.layout_sidebar_width_px = payload.layout_sidebar_width_px;
    session_ui_state.last_display_id = payload.last_display_id;
    session_ui_state.last_window_mode = payload.last_window_mode;
    session_ui_state.presentation_reason = derive_presentation_reason(
        &session_ui_state.query,
        &items,
        runtime_state.is_recovery_mode,
    );
    session_ui_state.restored_from_session = has_saved_session_state(&session_ui_state);
    session_ui_state.updated_at = updated_at;

    sync_runtime_state_from_session(&mut runtime_state, &session_ui_state);

    Ok(session_ui_state.clone())
}

#[tauri::command]
fn runtime_state_get(state: State<'_, AppState>) -> Result<RuntimeStateResponse, String> {
    let runtime_state = state
        .runtime_state
        .lock()
        .map_err(|_| "runtime state unavailable".to_string())?;

    Ok(runtime_state.clone())
}

#[tauri::command]
fn window_placement_refresh(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<RuntimeStateResponse, String> {
    let window = app.get_webview_window("main").ok_or_else(|| {
        record_window_position_error(&state, "window-fallback-used/window_handle_missing");
        "WINDOW_POSITION_UNAVAILABLE".to_string()
    })?;

    let requested_mode = state
        .runtime_state
        .lock()
        .map(|runtime_state| WindowSizeMode::from_window_mode(&runtime_state.last_window_mode))
        .unwrap_or(WindowSizeMode::Small);

    match apply_window_placement(&window, &state, requested_mode, true, None) {
        Ok(runtime_state) => {
            emit_window_fallback_used(&app, &runtime_state, "placement_refresh");
            Ok(runtime_state)
        }
        Err(error) => {
            record_window_position_error(&state, "window-fallback-used/placement_refresh");
            Err(error)
        }
    }
}

fn build_diagnostics_payload(state: &AppState) -> Result<serde_json::Value, String> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| "settings state unavailable".to_string())?
        .clone();
    let (item_count, rules) = {
        let db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        let item_count = db
            .query_row("SELECT COUNT(*) FROM clipboard_items", [], |row| {
                row.get::<_, i64>(0)
            })
            .map_err(map_db_error)?;
        let rules = list_exclusion_rules(&db)?;
        (item_count, rules)
    };
    let db_file_size = if state.database_path == PathBuf::from(":memory:") {
        0
    } else {
        fs::metadata(&state.database_path)
            .map(|metadata| metadata.len())
            .unwrap_or(0)
    };
    let trusted = *state
        .accessibility_trusted
        .lock()
        .map_err(|_| "permission state unavailable".to_string())?;
    let runtime_state = state
        .runtime_state
        .lock()
        .map_err(|_| "runtime state unavailable".to_string())?
        .clone();
    let recent_errors = state
        .recent_errors
        .lock()
        .map_err(|_| "recent error buffer unavailable".to_string())?
        .clone();
    let window_fallback_records = state
        .window_fallback_records
        .lock()
        .map_err(|_| "window fallback buffer unavailable".to_string())?
        .clone();
    let migration_phase = runtime_state.migration_phase.clone();
    let is_recovery_mode = runtime_state.is_recovery_mode;
    let fallback_reason = runtime_state.fallback_reason.clone();
    let last_display_id = runtime_state.last_display_id.clone();
    let last_window_mode = runtime_state.last_window_mode.clone();
    let updated_at = runtime_state.updated_at.clone();

    Ok(json!({
        "app_info": {
            "version": "0.1.0",
            "build": "tauri-sqlite",
            "config_version": 1
        },
        "os_info": {
            "platform": "macOS",
            "architecture": std::env::consts::ARCH,
            "locale": "zh-CN"
        },
        "permissions": {
            "accessibility_trusted": trusted,
            "checked_at": "2026-04-25T19:40:00+08:00"
        },
        "migration_summary": {
            "schema_version": 1,
            "migration_phase": migration_phase,
            "error_code": if is_recovery_mode {
                json!("RECOVERY_MODE_READ_ONLY")
            } else {
                serde_json::Value::Null
            }
        },
        "db_health_summary": {
            "item_count": item_count,
            "rule_count": rules.len(),
            "fts_status": if is_recovery_mode { "recovery" } else { "ready" },
            "file_size_bucket": if db_file_size < 1_000_000 { "<1MB" } else if db_file_size < 10_000_000 { "1-10MB" } else { ">10MB" },
            "checksum": content_hash("db", state.database_path.display().to_string().as_bytes(), item_count.to_string().as_bytes())
        },
        "recent_errors": recent_errors,
        "settings_summary": {
            "default_action": settings.default_action,
            "theme_mode": settings.theme_mode,
            "history_limit": settings.history_limit,
            "launch_at_login": settings.launch_at_login,
            "show_on_startup": settings.show_on_startup,
            "exclusion_rule_count": rules.len()
        },
        "window_fallback_records": if window_fallback_records.is_empty() {
            if let Some(fallback_reason) = fallback_reason {
                json!([
                    {
                        "display_id": last_display_id,
                        "fallback_reason": fallback_reason,
                        "window_mode": last_window_mode,
                        "safe_area_snapshot": serde_json::Value::Null,
                        "occurred_at": updated_at
                    }
                ])
            } else {
                json!([])
            }
        } else {
            json!(window_fallback_records)
        }
    }))
}

fn diagnostics_export_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    let dir = Path::new(&home)
        .join("Library")
        .join("Application Support")
        .join("SuperClip")
        .join("diagnostics");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn write_diagnostics_export(
    state: &AppState,
    export_dir: &Path,
) -> Result<DiagnosticsExportResponse, String> {
    let exported_at = match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => format!("unix-{}", duration.as_secs()),
        Err(_) => return Err("DIAGNOSTICS_EXPORT_FAILED".to_string()),
    };
    let file_name = build_diagnostics_file_name(&exported_at);
    let file_path = export_dir.join(&file_name);
    let payload = build_diagnostics_payload(state)?;
    let body =
        serde_json::to_vec_pretty(&payload).map_err(|_| "DIAGNOSTICS_EXPORT_FAILED".to_string())?;

    fs::write(&file_path, body).map_err(|_| "DIAGNOSTICS_EXPORT_FAILED".to_string())?;

    Ok(DiagnosticsExportResponse {
        file_path: file_path.display().to_string(),
        file_name,
        exported_at,
        included_sections: DIAGNOSTIC_SECTIONS
            .iter()
            .map(|section| (*section).to_string())
            .collect(),
        version: 1,
        delivery_mode: "file_path".into(),
        download_url: None,
    })
}

#[tauri::command]
fn diagnostics_export(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<DiagnosticsExportResponse, String> {
    let response = match write_diagnostics_export(&state, &diagnostics_export_dir()) {
        Ok(response) => response,
        Err(error_code) => {
            push_recent_error_code(&state, &error_code, "diagnostics-export/write");
            return Err(error_code);
        }
    };

    emit_superclip_event(
        &app,
        "diagnostics-exported",
        json!({
            "file_name": response.file_name.clone(),
            "delivery_mode": response.delivery_mode.clone(),
            "included_sections": response.included_sections.clone()
        }),
    );

    Ok(response)
}

#[tauri::command]
fn shortcut_get(state: State<'_, AppState>) -> Result<ShortcutStateResponse, String> {
    let shortcut_state = state
        .shortcut_state
        .lock()
        .map_err(|_| "shortcut state unavailable".to_string())?;

    Ok(shortcut_state.clone())
}

#[tauri::command]
fn shortcut_start_recording(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ShortcutRecordingResponse, String> {
    ensure_not_recovery_mode(&state, "shortcut:start-recording")?;

    let shortcut_state = state
        .shortcut_state
        .lock()
        .map_err(|_| "shortcut state unavailable".to_string())?;
    let mut shortcut_recording = state
        .shortcut_recording
        .lock()
        .map_err(|_| "shortcut recording state unavailable".to_string())?;

    *shortcut_recording = true;

    let response = build_shortcut_recording_response(&shortcut_state, *shortcut_recording);
    drop(shortcut_recording);
    drop(shortcut_state);

    emit_superclip_event(
        &app,
        "shortcut-recording-started",
        json!({ "binding": response.binding.clone(), "is_registered": response.is_registered }),
    );

    Ok(response)
}

#[tauri::command]
fn shortcut_cancel_recording(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ShortcutRecordingResponse, String> {
    let shortcut_state = state
        .shortcut_state
        .lock()
        .map_err(|_| "shortcut state unavailable".to_string())?;
    let mut shortcut_recording = state
        .shortcut_recording
        .lock()
        .map_err(|_| "shortcut recording state unavailable".to_string())?;

    *shortcut_recording = false;

    let response = build_shortcut_recording_response(&shortcut_state, *shortcut_recording);
    drop(shortcut_recording);
    drop(shortcut_state);

    emit_superclip_event(
        &app,
        "shortcut-recording-cancelled",
        json!({ "binding": response.binding.clone(), "is_registered": response.is_registered }),
    );

    Ok(response)
}

#[tauri::command]
fn shortcut_validate(
    binding: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> ShortcutValidationResponse {
    let validation = validate_shortcut(&binding);
    record_shortcut_conflict(&state, &binding, &validation);
    if validation.conflict_type.is_some() {
        emit_superclip_event(
            &app,
            "shortcut-conflict-detected",
            json!({
                "binding": validation.binding.clone(),
                "conflict_type": validation.conflict_type.clone(),
                "conflict_target": validation.conflict_target.clone()
            }),
        );
    }
    validation
}

#[tauri::command]
fn shortcut_update(
    binding: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ShortcutStateResponse, String> {
    ensure_not_recovery_mode(&state, "shortcut:update")?;

    let validation = validate_shortcut(&binding);

    if let Some(conflict_type) = validation.conflict_type.clone() {
        record_shortcut_conflict(&state, &binding, &validation);
        emit_superclip_event(
            &app,
            "shortcut-conflict-detected",
            json!({
                "binding": validation.binding.clone(),
                "conflict_type": validation.conflict_type.clone(),
                "conflict_target": validation.conflict_target.clone()
            }),
        );
        return Err(if conflict_type == "system" {
            "SHORTCUT_CONFLICT_SYSTEM".into()
        } else {
            "SHORTCUT_CONFLICT_APP".into()
        });
    }

    let response = register_shortcut_binding(&app, &state, &binding)?;

    let mut shortcut_recording = state
        .shortcut_recording
        .lock()
        .map_err(|_| "shortcut recording state unavailable".to_string())?;
    *shortcut_recording = false;
    drop(shortcut_recording);

    emit_superclip_event(
        &app,
        "shortcut-updated",
        json!({
            "binding": response.binding.clone(),
            "is_registered": response.is_registered,
            "source": response.source.clone()
        }),
    );

    Ok(response)
}

#[tauri::command]
fn shortcut_restore_default(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ShortcutStateResponse, String> {
    ensure_not_recovery_mode(&state, "shortcut:restore-default")?;

    let response = register_shortcut_binding(&app, &state, DEFAULT_SHORTCUT)?;

    let mut shortcut_recording = state
        .shortcut_recording
        .lock()
        .map_err(|_| "shortcut recording state unavailable".to_string())?;
    *shortcut_recording = false;
    drop(shortcut_recording);

    emit_superclip_event(
        &app,
        "shortcut-updated",
        json!({
            "binding": response.binding.clone(),
            "is_registered": response.is_registered,
            "source": response.source.clone()
        }),
    );

    Ok(response)
}

#[tauri::command]
fn permission_check_accessibility(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<PermissionStatus, String> {
    let checked_at = build_runtime_timestamp()?;
    let trusted = match check_accessibility_trusted() {
        Ok(trusted) => trusted,
        Err(error_code) => {
            push_recent_error_code(&state, &error_code, "permission-check/accessibility");
            false
        }
    };
    let changed = {
        let mut accessibility_trusted = state
            .accessibility_trusted
            .lock()
            .map_err(|_| "permission state unavailable".to_string())?;
        let changed = *accessibility_trusted != trusted;
        *accessibility_trusted = trusted;
        changed
    };

    if changed {
        emit_superclip_event(
            &app,
            "permission-status-changed",
            json!({
                "accessibility_trusted": trusted,
                "checked_at": checked_at.clone()
            }),
        );
    }

    Ok(PermissionStatus {
        accessibility_trusted: trusted,
        checked_at,
    })
}

#[tauri::command]
fn permission_open_accessibility(app: tauri::AppHandle) -> Result<bool, String> {
    app.opener()
        .open_url(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
            None::<&str>,
        )
        .map_err(|_| "UNKNOWN".to_string())?;

    Ok(true)
}

#[tauri::command]
fn show_main(app: tauri::AppHandle) -> Result<(), String> {
    show_main_window(&app, "popup_button", Some("popup_button"), None)?;
    Ok(())
}

#[tauri::command]
fn preview_show(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window("preview") else {
        return Err("preview window not found".into());
    };

    if let Ok(mut flag) = state.preview_active.lock() {
        *flag = true;
    }

    let mut final_x = x;
    let mut final_y = y;

    if let Some(monitor) = window.current_monitor().ok().flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
    {
        let scale = monitor.scale_factor();
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        let mon_x = mon_pos.x as f64 / scale;
        let mon_y = mon_pos.y as f64 / scale;
        let mon_w = mon_size.width as f64 / scale;
        let mon_h = mon_size.height as f64 / scale;

        let screen_right = mon_x + mon_w;
        let screen_bottom = mon_y + mon_h;

        if final_x + width > screen_right {
            if let Some(popup) = app.get_webview_window("popup") {
                if let Ok(popup_pos) = popup.outer_position() {
                    let popup_x = popup_pos.x as f64 / scale;
                    final_x = popup_x - width - 4.0;
                }
            }
        }
        if final_y + height > screen_bottom {
            final_y = screen_bottom - height;
        }
        if final_y < mon_y {
            final_y = mon_y;
        }
        if final_x < mon_x {
            final_x = mon_x;
        }
    }

    let _ = window.set_size(tauri::LogicalSize::new(width, height));
    let _ = window.set_position(tauri::LogicalPosition::new(final_x, final_y));

    #[cfg(target_os = "macos")]
    {
        if let Ok(panel) = app.get_webview_panel("preview") {
            panel.show();
        } else {
            let _ = window.show();
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.show();
    }

    if let Some(popup) = app.get_webview_window("popup") {
        let _ = popup.set_focus();
    }

    Ok(())
}

#[tauri::command]
fn preview_hide(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut flag) = state.preview_active.lock() {
        *flag = false;
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(panel) = app.get_webview_panel("preview") {
            panel.hide();
            return Ok(());
        }
    }

    let Some(window) = app.get_webview_window("preview") else {
        return Err("preview window not found".into());
    };
    let _ = window.hide();
    Ok(())
}

#[tauri::command]
fn popup_ready(app: tauri::AppHandle, state: State<'_, AppState>) {
    if let Ok(mut flag) = state.popup_ready.lock() {
        *flag = true;
    }
    // 若就绪前已有显示请求（未被丢弃，而是挂起），就绪后自动补显
    if take_pending_show(&state.pending_show_popup) {
        toggle_popup_window(&app);
    }
}

#[tauri::command]
fn quick_panel_ready(app: tauri::AppHandle, state: State<'_, AppState>) {
    if let Ok(mut flag) = state.quick_panel_ready.lock() {
        *flag = true;
    }
    if take_pending_show(&state.pending_show_quick_panel) {
        // 补显时从托盘重新取 rect（点击发生在就绪前，托盘位置未变）
        let tray_rect = app.try_state::<AppState>().and_then(|state| {
            state
                .tray_icon
                .lock()
                .ok()
                .and_then(|guard| guard.as_ref().and_then(|tray| tray.rect().ok().flatten()))
        });
        toggle_quick_panel_window(&app, tray_rect);
    }
}

#[tauri::command]
fn main_window_ready(app: tauri::AppHandle, state: State<'_, AppState>) {
    if let Ok(mut flag) = state.main_window_ready.lock() {
        *flag = true;
    }
    if take_pending_show(&state.pending_show_main) {
        let _ = show_main_window(&app, "main_window_ready", Some("main_window_ready"), None);
    }
}

/// 读取并清除「未就绪时挂起的显示请求」标志，返回是否有待补显的窗口。
fn take_pending_show(pending: &Mutex<bool>) -> bool {
    pending
        .lock()
        .map(|mut flag| {
            let should_show = *flag;
            *flag = false;
            should_show
        })
        .unwrap_or(false)
}

#[tauri::command]
fn monitor_status_get(state: State<'_, AppState>) -> Result<MonitorStatus, String> {
    let monitoring = state
        .is_monitoring
        .lock()
        .map_err(|_| "monitor state unavailable".to_string())?;
    Ok(MonitorStatus {
        is_monitoring: *monitoring,
    })
}

#[tauri::command]
fn app_quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn quick_panel_hide(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(panel) = app.get_webview_panel("quick_panel") {
            panel.hide();
            return Ok(());
        }
    }

    let Some(window) = app.get_webview_window("quick_panel") else {
        return Err("quick_panel window not found".into());
    };
    let _ = window.hide();
    Ok(())
}

#[tauri::command]
fn monitor_toggle(
    next_state: Option<bool>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<MonitorStatus, String> {
    ensure_not_recovery_mode(&state, "monitor:toggle")?;

    let mut monitoring = state
        .is_monitoring
        .lock()
        .map_err(|_| "monitor state unavailable".to_string())?;

    *monitoring = next_state.unwrap_or(!*monitoring);

    let response = MonitorStatus {
        is_monitoring: *monitoring,
    };
    drop(monitoring);

    emit_superclip_event(
        &app,
        "monitor-status-changed",
        json!({ "is_monitoring": response.is_monitoring, "source": "manual_toggle" }),
    );

    Ok(response)
}

#[tauri::command]
fn clipboard_copy(
    id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ClipboardActionResult, String> {
    let (item, payload, hash) = {
        let db = state
            .db_read
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        (
            get_item_by_id(&db, &id)?,
            get_payload_by_id(&db, &id)?,
            content_hash_for_item(&db, &id)?,
        )
    };

    write_payload_to_clipboard(&payload)?;
    mark_self_write_hash(&state, hash);

    {
        let db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        mark_item_used(&db, &id)?;
    }

    let result = build_copy_result(&item);
    emit_superclip_event(
        &app,
        "item-updated",
        json!({ "item_id": item.id.clone(), "action": "copy", "use_count_changed": true }),
    );

    hide_popup_window(&app);

    Ok(result)
}

#[tauri::command]
fn clipboard_paste(
    id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ClipboardActionResult, String> {
    ensure_not_recovery_mode(&state, "clipboard:paste")?;

    let (item, payload, hash) = {
        let db = state
            .db_read
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        (
            get_item_by_id(&db, &id)?,
            get_payload_by_id(&db, &id)?,
            content_hash_for_item(&db, &id)?,
        )
    };
    let trusted = *state
        .accessibility_trusted
        .lock()
        .map_err(|_| "permission state unavailable".to_string())?;

    write_payload_to_clipboard(&payload)?;
    mark_self_write_hash(&state, hash);
    let direct_paste_result = if trusted && item.kind != "file" {
        trigger_direct_paste()
    } else {
        Err("NO_ACCESSIBILITY".into())
    };

    {
        let db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        mark_item_used(&db, &id)?;
    }

    let result = build_paste_result(&item, trusted, direct_paste_result);
    record_paste_outcome(&app, &state, &result);
    emit_superclip_event(
        &app,
        "item-updated",
        json!({ "item_id": item.id.clone(), "action": "paste", "use_count_changed": true }),
    );

    hide_popup_window(&app);

    Ok(result)
}

#[tauri::command]
fn clipboard_pin(
    id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ClipboardPinResult, String> {
    ensure_not_recovery_mode(&state, "clipboard:pin")?;

    let item = {
        let db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        let now = now_epoch_secs()?;
        db.execute(
            "UPDATE clipboard_items SET is_pinned = 1, pinned_at = ?1 WHERE id = ?2",
            params![now, id],
        )
        .map_err(map_db_error)?;
        get_item_by_id(&db, &id)?
    };

    emit_superclip_event(
        &app,
        "item-updated",
        json!({ "item_id": item.id.clone(), "action": "pin", "is_pinned": item.is_pinned }),
    );

    Ok(ClipboardPinResult { item, version: 1 })
}

#[tauri::command]
fn clipboard_unpin(
    id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ClipboardPinResult, String> {
    ensure_not_recovery_mode(&state, "clipboard:unpin")?;

    let item = {
        let db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        db.execute(
            "UPDATE clipboard_items SET is_pinned = 0, pinned_at = NULL WHERE id = ?1",
            params![id],
        )
        .map_err(map_db_error)?;
        get_item_by_id(&db, &id)?
    };

    emit_superclip_event(
        &app,
        "item-updated",
        json!({ "item_id": item.id.clone(), "action": "unpin", "is_pinned": item.is_pinned }),
    );

    Ok(ClipboardPinResult { item, version: 1 })
}

#[tauri::command]
fn clipboard_delete(
    id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ClipboardDeleteResult, String> {
    ensure_not_recovery_mode(&state, "clipboard:delete")?;

    let now = now_epoch_secs()?;
    let expires_at = now + 30;
    let undo_token = format!("undo-{now}-{id}");
    let removed_item = {
        let mut db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        let item = get_item_by_id(&db, &id)?;
        let payload = get_payload_by_id(&db, &id)?;
        let item_json =
            serde_json::to_string(&item).map_err(|_| "CLIPBOARD_SERIALIZE_FAILED".to_string())?;
        let payload_json = serde_json::to_string(&payload)
            .map_err(|_| "CLIPBOARD_SERIALIZE_FAILED".to_string())?;
        let transaction = db.transaction().map_err(map_db_error)?;

        transaction
            .execute(
                r#"
                INSERT INTO clipboard_trash(
                    trash_id, item_id, undo_token, item_json, payload_json,
                    deleted_at, expires_at, deleted_by_action
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'delete')
                "#,
                params![
                    format!("trash-{now}-{id}"),
                    &id,
                    &undo_token,
                    &item_json,
                    &payload_json,
                    now,
                    expires_at,
                ],
            )
            .map_err(map_db_error)?;
        transaction
            .execute("DELETE FROM clipboard_items WHERE id = ?1", params![&id])
            .map_err(map_db_error)?;
        transaction
            .execute(
                "DELETE FROM fts_clipboard_items WHERE item_id = ?1",
                params![&id],
            )
            .map_err(map_db_error)?;
        transaction.commit().map_err(map_db_error)?;

        item
    };

    let expires_at_label = format!("unix-{expires_at}");
    emit_superclip_event(
        &app,
        "item-deleted",
        json!({
            "item_id": removed_item.id.clone(),
            "undo_token": undo_token.clone(),
            "expires_at": expires_at_label.clone()
        }),
    );
    emit_history_updated(&app, "item_deleted");

    Ok(ClipboardDeleteResult {
        item_id: removed_item.id,
        undo_token,
        expires_at: expires_at_label,
        version: 1,
    })
}

#[tauri::command]
fn clipboard_restore(
    undo_token: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ClipboardRestoreResult, String> {
    ensure_not_recovery_mode(&state, "clipboard:restore")?;

    let now = now_epoch_secs()?;
    let restored_item = {
        let mut db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        let trash_row = db
            .query_row(
                r#"
                SELECT item_json, payload_json, expires_at
                FROM clipboard_trash
                WHERE undo_token = ?1
                "#,
                params![&undo_token],
                |row| {
                    Ok((
                        row.get::<_, String>("item_json")?,
                        row.get::<_, String>("payload_json")?,
                        row.get::<_, i64>("expires_at")?,
                    ))
                },
            )
            .optional()
            .map_err(map_db_error)?;

        let Some((item_json, payload_json, expires_at)) = trash_row else {
            push_recent_error_code(&state, "UNDO_EXPIRED", "clipboard-restore/undo-expired");
            return Err("UNDO_EXPIRED".to_string());
        };

        if expires_at < now {
            db.execute(
                "DELETE FROM clipboard_trash WHERE undo_token = ?1",
                params![&undo_token],
            )
            .map_err(map_db_error)?;
            push_recent_error_code(&state, "UNDO_EXPIRED", "clipboard-restore/undo-expired");
            return Err("UNDO_EXPIRED".to_string());
        }

        let item: ClipboardItemSummary = serde_json::from_str(&item_json)
            .map_err(|_| "CLIPBOARD_SERIALIZE_FAILED".to_string())?;
        let payload: ClipboardPayloadSnapshot = serde_json::from_str(&payload_json)
            .map_err(|_| "CLIPBOARD_SERIALIZE_FAILED".to_string())?;
        let hash = content_hash(
            &item.kind,
            payload
                .text_plain
                .as_deref()
                .unwrap_or(&item.preview)
                .as_bytes(),
            payload.image_bytes.as_deref().unwrap_or(&[]),
        );
        let snapshot = ClipboardSnapshot {
            kind: item.kind.clone(),
            title: item.title.clone(),
            preview: item.preview.clone(),
            source_app: item.source_app.clone(),
            meta: item.meta.clone(),
            content_hash: hash,
            payload,
            payload_size_bytes: item.preview.len(),
            is_truncated: false,
        };
        let transaction = db.transaction().map_err(map_db_error)?;
        transaction
            .execute(
                r#"
                INSERT OR REPLACE INTO clipboard_items(
                    id, kind, content_hash, title, preview_text, source_app, meta,
                    is_pinned, pinned_at, use_count, last_used_at, payload_size_bytes,
                    is_truncated, is_sensitive, origin_bundle_id, preview_strategy,
                    created_at, last_seen_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, 0, NULL, ?9, 0, 0, NULL, 'inline', ?10, ?10)
                "#,
                params![
                    &item.id,
                    &snapshot.kind,
                    &snapshot.content_hash,
                    &snapshot.title,
                    &snapshot.preview,
                    &snapshot.source_app,
                    &snapshot.meta,
                    if item.is_pinned { 1 } else { 0 },
                    snapshot.payload_size_bytes as i64,
                    now,
                ],
            )
            .map_err(map_db_error)?;
        let file_urls_json = snapshot
            .payload
            .file_urls
            .as_ref()
            .and_then(|urls| serde_json::to_string(urls).ok());
        let extra_json = snapshot
            .payload
            .extra_json
            .as_ref()
            .and_then(|value| serde_json::to_string(value).ok());
        transaction
            .execute(
                r#"
                INSERT OR REPLACE INTO clipboard_payloads(
                    item_id, text_plain, text_html, text_rtf, image_blob, image_width, image_height,
                    file_urls_json, extra_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    &item.id,
                    snapshot.payload.text_plain.as_deref(),
                    snapshot.payload.text_html.as_deref(),
                    snapshot.payload.text_rtf.as_deref(),
                    snapshot.payload.image_bytes.as_deref(),
                    snapshot.payload.image_width.map(|value| value as i64),
                    snapshot.payload.image_height.map(|value| value as i64),
                    file_urls_json,
                    extra_json,
                ],
            )
            .map_err(map_db_error)?;
        transaction
            .execute(
                "DELETE FROM clipboard_trash WHERE undo_token = ?1",
                params![&undo_token],
            )
            .map_err(map_db_error)?;
        transaction
            .execute(
                "DELETE FROM fts_clipboard_items WHERE item_id = ?1",
                params![&item.id],
            )
            .map_err(map_db_error)?;
        insert_fts(&transaction, &snapshot, &item.id)?;
        transaction.commit().map_err(map_db_error)?;
        get_item_by_id(&db, &item.id)?
    };

    emit_superclip_event(
        &app,
        "item-restored",
        json!({ "item_id": restored_item.id.clone(), "undo_token": undo_token.clone() }),
    );
    emit_history_updated(&app, "item_restored");

    Ok(ClipboardRestoreResult {
        item: restored_item,
        version: 1,
    })
}

#[tauri::command]
fn clipboard_clear(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ClipboardClearResult, String> {
    ensure_not_recovery_mode(&state, "clipboard:clear")?;

    let cleared_count = {
        let db = state
            .db
            .lock()
            .map_err(|_| "clipboard store unavailable".to_string())?;
        let count = db
            .query_row("SELECT COUNT(*) FROM clipboard_items", [], |row| {
                row.get::<_, i64>(0)
            })
            .map_err(map_db_error)? as usize;
        db.execute("DELETE FROM clipboard_items", [])
            .map_err(map_db_error)?;
        db.execute("DELETE FROM fts_clipboard_items", [])
            .map_err(map_db_error)?;
        db.execute("DELETE FROM clipboard_trash", [])
            .map_err(map_db_error)?;
        count
    };

    emit_history_updated(&app, "history_cleared");

    Ok(ClipboardClearResult {
        cleared_count,
        version: 1,
    })
}

fn emit_history_updated(app: &tauri::AppHandle, reason: &str) {
    emit_superclip_event(app, "history-updated", json!({ "reason": reason }));
}

fn emit_window_fallback_used(
    app: &tauri::AppHandle,
    runtime_state: &RuntimeStateResponse,
    source: &str,
) {
    let Some(fallback_reason) = runtime_state.fallback_reason.clone() else {
        return;
    };

    emit_superclip_event(
        app,
        "window-fallback-used",
        json!({
            "source": source,
            "display_id": runtime_state.last_display_id.clone(),
            "window_mode": runtime_state.last_window_mode.clone(),
            "fallback_reason": fallback_reason
        }),
    );
}

fn emit_superclip_event(app: &tauri::AppHandle, event: &str, payload: serde_json::Value) {
    let mut body = serde_json::Map::new();
    body.insert("version".into(), json!(1));
    body.insert(
        "emitted_at".into(),
        json!(build_runtime_timestamp().unwrap_or_else(|_| "unknown".into())),
    );

    if let serde_json::Value::Object(object) = payload {
        for (key, value) in object {
            body.insert(key, value);
        }
    }

    let _ = app.emit(event, serde_json::Value::Object(body));
}

fn process_clipboard_monitor_tick(app: &tauri::AppHandle) {
    let state: State<'_, AppState> = app.state();
    let is_monitoring = state
        .is_monitoring
        .lock()
        .map(|value| *value)
        .unwrap_or(false);
    let is_recovery_mode = state
        .runtime_state
        .lock()
        .map(|runtime_state| runtime_state.is_recovery_mode)
        .unwrap_or(true);

    if !is_monitoring || is_recovery_mode {
        return;
    }

    match read_clipboard_snapshot() {
        Ok(Some(snapshot)) => {
            let hash = snapshot.content_hash.clone();
            let should_skip = {
                let mut monitor_state = match state.monitor_state.lock() {
                    Ok(monitor_state) => monitor_state,
                    Err(_) => {
                        push_recent_error_code(
                            &state,
                            "MONITOR_STATE_LOCKED",
                            "clipboard-monitor/state",
                        );
                        return;
                    }
                };

                if monitor_state.self_write_hash.as_deref() == Some(hash.as_str()) {
                    monitor_state.last_seen_hash = Some(hash.clone());
                    monitor_state.self_write_hash = None;
                    true
                } else {
                    monitor_state.last_seen_hash.as_deref() == Some(hash.as_str())
                }
            };

            if should_skip {
                return;
            }

            let inserted = {
                let is_excluded = state
                    .exclusion_rules_cache
                    .read()
                    .map(|rules| snapshot_is_excluded(&snapshot, &rules))
                    .unwrap_or(false);

                if is_excluded {
                    Ok(false)
                } else {
                    let history_limit = state
                        .settings
                        .lock()
                        .map(|s| s.history_limit as usize)
                        .unwrap_or(DEFAULT_HISTORY_LIMIT);
                    match state.db.lock() {
                        Ok(db) => upsert_clipboard_snapshot(&db, snapshot, history_limit),
                        Err(_) => Err("DB_LOCKED".into()),
                    }
                }
            };

            match inserted {
                Ok(true) => {
                    if let Ok(mut monitor_state) = state.monitor_state.lock() {
                        monitor_state.last_seen_hash = Some(hash.clone());
                    }
                    emit_history_updated(app, "monitor_insert");
                }
                Ok(false) => {
                    if let Ok(mut monitor_state) = state.monitor_state.lock() {
                        monitor_state.last_seen_hash = Some(hash.clone());
                    }
                }
                Err(error_code) => {
                    push_recent_error_code(&state, &error_code, "clipboard-monitor/write");
                }
            }
        }
        Ok(None) => {}
        Err(error_code) => {
            push_recent_error_code(&state, &error_code, "clipboard-monitor/read");
        }
    }
}

fn start_clipboard_monitor(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        process_clipboard_monitor_tick(&app);
        std::thread::sleep(Duration::from_millis(MONITOR_POLL_MS));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("in-memory sqlite must open");
        migrate_database(&connection).expect("test migration must pass");
        connection
    }

    fn test_app_state() -> AppState {
        AppState {
            db: Mutex::new(test_connection()),
            db_read: Mutex::new(test_connection()),
            database_path: PathBuf::from(":memory:"),
            exclusion_rules_cache: std::sync::RwLock::new(Vec::new()),
            monitor_state: Mutex::new(ClipboardMonitorState {
                last_seen_hash: None,
                self_write_hash: None,
            }),
            shortcut_state: Mutex::new(default_shortcut_state()),
            shortcut_recording: Mutex::new(false),
            is_monitoring: Mutex::new(true),
            accessibility_trusted: Mutex::new(false),
            settings: Mutex::new(default_settings_response()),
            session_ui_state: Mutex::new(SessionUiStateResponse {
                query: String::new(),
                selected_item_id: None,
                scroll_anchor: None,
                layout_sidebar_width_px: None,
                presentation_reason: "manual_open".into(),
                last_display_id: "main".into(),
                last_window_mode: WINDOW_MODE_SMALL.into(),
                restored_from_session: false,
                updated_at: "test".into(),
            }),
            runtime_state: Mutex::new(RuntimeStateResponse {
                presentation_reason: "manual_open".into(),
                last_display_id: "main".into(),
                last_window_mode: WINDOW_MODE_SMALL.into(),
                fallback_reason: None,
                migration_phase: "ready".into(),
                is_recovery_mode: false,
                restored_from_session: false,
                updated_at: "test".into(),
            }),
            recent_errors: Mutex::new(Vec::new()),
            window_fallback_records: Mutex::new(Vec::new()),
            window_placement: Mutex::new(WindowPlacementCoordinator::new()),
            tray_icon: Mutex::new(None),
            preview_active: Mutex::new(false),
            popup_ready: Mutex::new(false),
            quick_panel_ready: Mutex::new(false),
            main_window_ready: Mutex::new(false),
            pending_show_popup: Mutex::new(false),
            pending_show_quick_panel: Mutex::new(false),
            pending_show_main: Mutex::new(false),
            last_system_appearance: Mutex::new(None),
        }
    }

    fn test_clipboard_item(kind: &str) -> ClipboardItemSummary {
        ClipboardItemSummary {
            id: format!("test-{kind}"),
            kind: kind.into(),
            title: format!("Test {kind}"),
            preview: "SuperClip test payload".into(),
            source_app: "Test".into(),
            meta: "test".into(),
            time_label: "刚刚".into(),
            is_pinned: false,
            match_type: None,
            matched_fields: Vec::new(),
            highlight_ranges: Vec::new(),
        }
    }

    #[test]
    fn window_placement_coordinator_suppresses_programmatic_resize_echoes() {
        let mut coordinator = WindowPlacementCoordinator::new();
        let started_at = Instant::now();

        assert!(coordinator.begin_apply());
        assert!(!coordinator.begin_apply());
        assert!(coordinator.should_ignore_resize(started_at));

        coordinator.finish_apply(started_at);
        assert!(coordinator.should_ignore_resize(
            started_at + Duration::from_millis(WINDOW_RESIZE_SUPPRESSION_MS - 1)
        ));
        assert!(!coordinator.should_ignore_resize(
            started_at + Duration::from_millis(WINDOW_RESIZE_SUPPRESSION_MS + 1)
        ));
        assert!(!coordinator.should_ignore_resize(
            started_at + Duration::from_millis(WINDOW_RESIZE_SUPPRESSION_MS + 2)
        ));
    }

    #[test]
    fn repository_upsert_and_search_round_trip() {
        let connection = test_connection();
        let snapshot =
            normalize_text_snapshot("SuperClip backend smoke SQLite FTS monitor", "Test")
                .expect("text snapshot should normalize");

        let inserted =
            upsert_clipboard_snapshot(&connection, snapshot, DEFAULT_HISTORY_LIMIT).expect("upsert should pass");
        assert!(inserted);

        let results = search_clipboard_items(&connection, "backend", None, false).expect("search should pass");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].kind, "text");
        assert!(results[0].preview.contains("SQLite FTS"));
        assert_eq!(results[0].match_type.as_deref(), Some("contains"));
        assert!(results[0]
            .highlight_ranges
            .iter()
            .any(|range| range.field == "preview_text"));
    }

    #[test]
    fn large_image_snapshot_keeps_preview_payload_when_full_blob_is_truncated() {
        let width = 1_492;
        let height = 1_410;
        let bytes = vec![192; width * height * 4];
        let snapshot = normalize_image_snapshot(
            ImageData {
                width,
                height,
                bytes: bytes.into(),
            },
            "Test",
        );

        assert!(snapshot.is_truncated);
        assert!(snapshot.payload.image_bytes.is_none());
        assert_eq!(snapshot.payload.image_width, Some(width));
        assert_eq!(snapshot.payload.image_height, Some(height));

        let preview = snapshot
            .payload
            .extra_json
            .as_ref()
            .and_then(|value| value.get("previewImage"))
            .expect("large image should store a preview payload");
        let preview_width = preview
            .get("width")
            .and_then(|value| value.as_u64())
            .expect("preview width should exist") as usize;
        let preview_height = preview
            .get("height")
            .and_then(|value| value.as_u64())
            .expect("preview height should exist") as usize;
        let preview_bytes = preview
            .get("bytes")
            .and_then(|value| value.as_array())
            .expect("preview bytes should exist");

        assert!(preview_width <= IMAGE_PREVIEW_MAX_EDGE);
        assert!(preview_height <= IMAGE_PREVIEW_MAX_EDGE);
        assert_eq!(preview_bytes.len(), preview_width * preview_height * 4);
    }

    #[test]
    fn settings_persist_in_sqlite() {
        let connection = test_connection();

        save_setting_value(&connection, "default_action", "copy_only")
            .expect("setting should save");
        save_setting_value(&connection, "theme_mode", "dark").expect("setting should save");
        save_setting_value(&connection, "history_limit", "2500").expect("setting should save");
        save_setting_value(&connection, "show_on_startup", "true").expect("setting should save");

        let settings = load_settings(&connection).expect("settings should load");
        assert_eq!(settings.default_action, "copy_only");
        assert_eq!(settings.theme_mode, "dark");
        assert_eq!(settings.history_limit, 2500);
        assert!(settings.show_on_startup);
    }

    #[test]
    fn exclusion_rules_persist_and_filter_snapshots() {
        let connection = test_connection();
        let now = now_epoch_secs().expect("clock should work");
        connection
            .execute("DELETE FROM exclusion_rules", [])
            .expect("rules should clear");
        connection
            .execute(
                r#"
                INSERT INTO exclusion_rules(id, kind, value, enabled, created_at, updated_at)
                VALUES ('rule-test', 'keyword', 'secret-token', 1, ?1, ?1)
                "#,
                params![now],
            )
            .expect("rule should insert");

        let rules = list_exclusion_rules(&connection).expect("rules should load");
        assert_eq!(rules.len(), 1);

        let snapshot = normalize_text_snapshot("deploy secret-token value", "Terminal")
            .expect("snapshot should normalize");
        assert!(snapshot_is_excluded(&snapshot, &rules));

        let allowed = normalize_text_snapshot("deploy ordinary value", "Terminal")
            .expect("snapshot should normalize");
        assert!(!snapshot_is_excluded(&allowed, &rules));
    }

    #[test]
    fn text_paths_normalize_as_file_payload() {
        let connection = test_connection();
        let snapshot = normalize_text_snapshot(
            std::env::current_dir()
                .expect("cwd should exist")
                .display()
                .to_string()
                .as_str(),
            "Finder",
        )
        .expect("existing path should normalize");

        assert_eq!(snapshot.kind, "file");
        assert!(snapshot.payload.file_urls.is_some());

        upsert_clipboard_snapshot(&connection, snapshot, DEFAULT_HISTORY_LIMIT).expect("file upsert should pass");
        let results = search_clipboard_items(&connection, "copy-only", None, false).expect("search should pass");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].kind, "file");
    }

    #[test]
    fn session_ui_state_carries_layout_sidebar_width() {
        let update: SessionUiStateUpdateRequest = serde_json::from_value(serde_json::json!({
            "query": "",
            "selectedItemId": null,
            "scrollAnchor": null,
            "layoutSidebarWidthPx": 360,
            "lastDisplayId": "main",
            "lastWindowMode": "large_window"
        }))
        .expect("session update payload should deserialize");

        assert_eq!(update.layout_sidebar_width_px, Some(360));

        let state = test_app_state();
        let mut session_ui_state = state
            .session_ui_state
            .lock()
            .expect("session state should lock");
        session_ui_state.layout_sidebar_width_px = update.layout_sidebar_width_px;

        let serialized =
            serde_json::to_value(session_ui_state.clone()).expect("session state should serialize");

        assert_eq!(serialized["layoutSidebarWidthPx"], 360);
    }

    #[test]
    fn html_snapshot_strips_tags_and_indexes_plain_text() {
        let connection = test_connection();
        let snapshot = normalize_html_snapshot(
            "<p>SuperClip <strong>HTML</strong>&nbsp;clipboard</p>",
            "",
            "Safari",
        )
        .expect("html snapshot should normalize");

        assert_eq!(snapshot.kind, "html");
        assert_eq!(
            snapshot.payload.text_html.as_deref().unwrap(),
            "<p>SuperClip <strong>HTML</strong>&nbsp;clipboard</p>"
        );
        assert_eq!(
            clean_preview(snapshot.payload.text_plain.as_deref().unwrap()),
            "SuperClip HTML clipboard"
        );

        upsert_clipboard_snapshot(&connection, snapshot, DEFAULT_HISTORY_LIMIT).expect("html upsert should pass");
        let results = search_clipboard_items(&connection, "clipboard", None, false).expect("search should pass");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].kind, "html");
    }

    #[test]
    fn diagnostics_export_writes_redacted_payload() {
        let state = test_app_state();
        let export_dir = std::env::temp_dir().join(format!(
            "superclip-diagnostics-success-test-{}",
            std::process::id()
        ));
        fs::create_dir_all(&export_dir).expect("diagnostics test dir should be created");

        let response = write_diagnostics_export(&state, &export_dir)
            .expect("diagnostics export should write to temp dir");
        let body =
            fs::read_to_string(response.file_path).expect("diagnostics file should be readable");
        let payload: serde_json::Value =
            serde_json::from_str(&body).expect("diagnostics file should be valid json");

        for section in DIAGNOSTIC_SECTIONS {
            assert!(
                payload.get(section).is_some(),
                "missing diagnostics section {section}"
            );
        }
        assert!(payload.get("clipboard_payloads").is_none());
        assert!(!body.contains("text_plain"));
        assert!(!body.contains("image_blob"));
    }

    #[test]
    fn diagnostics_export_returns_stable_error_when_write_fails() {
        let state = test_app_state();
        let not_a_dir = std::env::temp_dir().join(format!(
            "superclip-diagnostics-not-dir-test-{}",
            std::process::id()
        ));
        fs::write(&not_a_dir, b"not a directory").expect("test marker file should be written");

        let error = write_diagnostics_export(&state, &not_a_dir)
            .expect_err("diagnostics export should fail when export dir is a file");

        assert_eq!(error, "DIAGNOSTICS_EXPORT_FAILED");
    }

    #[test]
    fn paste_result_falls_back_when_accessibility_is_missing() {
        let item = test_clipboard_item("text");
        let result = build_paste_result(&item, false, Ok(()));

        assert_eq!(result.mode, "copy_only");
        assert!(result.fallback_used);
        assert_eq!(result.error_code.as_deref(), Some("NO_ACCESSIBILITY"));
    }

    #[test]
    fn paste_result_preserves_target_payload_rejection_error() {
        let item = test_clipboard_item("image");
        let result = build_paste_result(&item, true, Err("PAYLOAD_UNSUPPORTED".into()));

        assert_eq!(result.mode, "copy_only");
        assert!(result.fallback_used);
        assert_eq!(result.error_code.as_deref(), Some("PAYLOAD_UNSUPPORTED"));
    }

    #[test]
    fn resolve_panel_appearance_name_maps_theme_modes() {
        // 显式 light/dark：固定外观，与系统无关
        assert_eq!(
            resolve_panel_appearance_name("light", true).to_str().unwrap(),
            "NSAppearanceNameAqua"
        );
        assert_eq!(
            resolve_panel_appearance_name("dark", false).to_str().unwrap(),
            "NSAppearanceNameDarkAqua"
        );
        // system：镜像系统当前有效外观（不返回 nil，避免锁定后无法恢复跟随系统）
        assert_eq!(
            resolve_panel_appearance_name("system", true).to_str().unwrap(),
            "NSAppearanceNameDarkAqua"
        );
        assert_eq!(
            resolve_panel_appearance_name("system", false).to_str().unwrap(),
            "NSAppearanceNameAqua"
        );
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn current_system_appearance_name_reads_effective_appearance() {
        // 验证 objc 调用链（NSApp.effectiveAppearance.name → UTF8String）可用：
        // 必须返回 dark/light 之一，不能 panic 或返回 None
        let name = current_system_appearance_name()
            .expect("system appearance name must be readable on macOS");
        assert!(
            name == "dark" || name == "light",
            "expected \"dark\"/\"light\", got {name:?}"
        );
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn panel_level_main_menu_is_above_floating() {
        assert!(
            PanelLevel::MainMenu.value() > PanelLevel::Floating.value(),
            "MainMenu level ({}) must be higher than Floating level ({}) to appear above fullscreen apps",
            PanelLevel::MainMenu.value(),
            PanelLevel::Floating.value()
        );
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn collection_behavior_includes_fullscreen_auxiliary_and_join_all_spaces() {
        let behavior = CollectionBehavior::new()
            .can_join_all_spaces()
            .full_screen_auxiliary()
            .transient();

        let raw = behavior.value();
        // NSWindowCollectionBehaviorCanJoinAllSpaces = 1 << 0
        // NSWindowCollectionBehaviorFullScreenAuxiliary = 1 << 8
        // NSWindowCollectionBehaviorTransient = 1 << 3
        let raw_bits = raw.0;
        assert!(
            raw_bits & (1 << 0) != 0,
            "canJoinAllSpaces bit must be set"
        );
        assert!(
            raw_bits & (1 << 8) != 0,
            "fullScreenAuxiliary bit must be set"
        );
        assert!(
            raw_bits & (1 << 3) != 0,
            "transient bit must be set"
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state: State<'_, AppState> = app.state();
            {
                if let Ok(runtime_state) = state.runtime_state.lock() {
                    emit_superclip_event(
                        &app_handle,
                        "migration-state-changed",
                        json!({
                            "migration_phase": runtime_state.migration_phase.clone(),
                            "is_recovery_mode": runtime_state.is_recovery_mode
                        }),
                    );

                    if runtime_state.is_recovery_mode {
                        emit_superclip_event(
                            &app_handle,
                            "recovery-mode-changed",
                            json!({ "is_recovery_mode": true, "reason": "database_open_failed" }),
                        );
                    }
                }

                let is_monitoring = state
                    .is_monitoring
                    .lock()
                    .map(|monitoring| *monitoring)
                    .unwrap_or(false);
                emit_superclip_event(
                    &app_handle,
                    "monitor-status-changed",
                    json!({ "is_monitoring": is_monitoring, "source": "startup" }),
                );
            }
            install_desktop_controls(&app_handle, &state);
            start_clipboard_monitor(app_handle.clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            clipboard_list,
            clipboard_search,
            clipboard_get,
            settings_get,
            settings_update,
            rules_list,
            rules_upsert,
            rules_delete,
            rules_clear,
            session_ui_state_get,
            session_ui_state_update,
            runtime_state_get,
            window_placement_refresh,
            diagnostics_export,
            shortcut_get,
            shortcut_start_recording,
            shortcut_cancel_recording,
            shortcut_validate,
            shortcut_update,
            shortcut_restore_default,
            permission_check_accessibility,
            permission_open_accessibility,
            show_main,
            preview_show,
            preview_hide,
            popup_ready,
            quick_panel_ready,
            main_window_ready,
            monitor_toggle,
            monitor_status_get,
            system_appearance_get,
            app_quit,
            quick_panel_hide,
            clipboard_copy,
            clipboard_paste,
            clipboard_pin,
            clipboard_unpin,
            clipboard_delete,
            clipboard_restore,
            clipboard_clear
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| match event {
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } => {
            handle_dock_reopen(app_handle, has_visible_windows);
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" => {
            api.prevent_close();
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.hide();
            }
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "popup" => {
            api.prevent_close();
            hide_popup_window(app_handle);
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "preview" => {
            api.prevent_close();
            #[cfg(target_os = "macos")]
            {
                if let Ok(panel) = app_handle.get_webview_panel("preview") {
                    panel.hide();
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                if let Some(window) = app_handle.get_webview_window("preview") {
                    let _ = window.hide();
                }
            }
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Focused(false),
            ..
        } if label == "popup" => {
            let preview_active = app_handle
                .try_state::<AppState>()
                .and_then(|s| s.preview_active.lock().ok().map(|f| *f))
                .unwrap_or(false);
            if !preview_active {
                hide_popup_window(app_handle);
            }
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "quick_panel" => {
            api.prevent_close();
            #[cfg(target_os = "macos")]
            {
                if let Ok(panel) = app_handle.get_webview_panel("quick_panel") {
                    panel.hide();
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                if let Some(window) = app_handle.get_webview_window("quick_panel") {
                    let _ = window.hide();
                }
            }
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Focused(false),
            ..
        } if label == "quick_panel" => {
            #[cfg(target_os = "macos")]
            {
                if let Ok(panel) = app_handle.get_webview_panel("quick_panel") {
                    panel.hide();
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                if let Some(window) = app_handle.get_webview_window("quick_panel") {
                    let _ = window.hide();
                }
            }
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Focused(false),
            ..
        } if label == "preview" => {
            let popup_focused = app_handle
                .get_webview_window("popup")
                .and_then(|w| w.is_focused().ok())
                .unwrap_or(false);
            if !popup_focused {
                hide_popup_window(app_handle);
            }
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Resized(_),
            ..
        } if label == "main" => {
            handle_main_window_resized(app_handle);
        }
        _ => {}
    });
}
