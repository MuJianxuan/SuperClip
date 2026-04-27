# SuperClip P0 结构化留痕模板

## 目的
- 用当前仓库已经落地的 diagnostics 分段，形成 Phase 6 最低可交付的结构化证据模板。
- 明确哪些场景已经可以通过 `recent_errors` / `window_fallback_records` 留痕，哪些仍依赖后续 SQLite 核心落地。

## 当前可用的结构化留痕源
| 来源 | 当前字段 | 容量上限 | 用途 |
|---|---|---|---|
| `recent_errors` | `error_code`、`context`、`occurred_at`、`startup_phase?`、`setting_value?` | 最近 50 条 | 定位 direct paste 失败、登录启动失败、规则重复、撤销过期、导出失败、恢复模式写阻断 |
| `window_fallback_records` | `display_id`、`fallback_reason`、`window_mode`、`safe_area_snapshot?`、`occurred_at` | 最近 20 条 | 定位 safe area 不足、多显示器回退和 Dock reopen 后的回退模式 |
| `migration_summary` | `schema_version`、`migration_phase`、`error_code?` | 单条快照 | 判断是否进入恢复模式 |
| `permissions` | `accessibility_trusted`、`checked_at` | 单条快照 | 定位 direct paste 权限前提 |

## 场景到留痕映射
| 场景 | 最低结构化证据 | 关键字段 | 当前状态 |
|---|---|---|---|
| 登录启动更新失败 | `recent_errors` | `error_code=LOGIN_ITEM_UPDATE_FAILED`、`startup_phase=launch_at_login`、`setting_value` | 已落地 |
| 规则重复 | `recent_errors` | `error_code=RULE_DUPLICATE`、`context=rules-upsert/duplicate` | 已落地 |
| 删除后撤销超时 | `recent_errors` | `error_code=UNDO_EXPIRED`、`context=clipboard-restore/undo-expired` | 已落地 |
| direct paste 缺权限 | `recent_errors` + `permissions` | `error_code=NO_ACCESSIBILITY`、`accessibility_trusted=false` | 已落地 |
| 富文本退化 | `recent_errors` | `error_code=RICH_TEXT_DEGRADED`、`context=paste-failed/degraded_plain_text` | 已落地 |
| 图片回退 copy-only | `recent_errors` | `error_code=PAYLOAD_UNSUPPORTED`、`context=paste-failed/fallback_copy_only` | 已落地 |
| diagnostics 写入失败 | `recent_errors` | `error_code=DIAGNOSTICS_EXPORT_FAILED`、`context=diagnostics-export/(timestamp|serialize|write)` | 已落地 |
| 安全区 / anchor 回退 | `window_fallback_records` | `display_id`、`fallback_reason`、`window_mode`、`safe_area_snapshot` | 已落地 |
| 恢复模式写阻断 | `recent_errors` + `migration_summary` | `error_code=RECOVERY_MODE_READ_ONLY`、`context=recovery-mode-blocked/*` | 已落地 |
| migration fail | `migration_summary` + `recent_errors` | `migration_phase`、`error_code` | 阻塞，待 SQLite/migration 落地 |
| DB_LOCKED | `recent_errors` + `db_health_summary` | `error_code=DB_LOCKED` | 阻塞，待 SQLite 落地 |

## 单次取证模板
| 字段 | 填写要求 |
|---|---|
| `scenario` | 对应 PRD 场景名，例如 `rich-text-degraded-paste` |
| `host` | `tauri-dev` / `tauri-release` |
| `display_topology` | `single-display` / `dual-display` / `notch-screen` |
| `target_app` | 目标应用名，例如 `Notes`、`Terminal` |
| `user_action` | 用户执行的关键动作，使用简短英文 slug |
| `expected_code` | 预期错误码或状态，例如 `RICH_TEXT_DEGRADED` |
| `artifact_set` | 录屏、截图、diagnostics 文件名集合 |
| `result` | `pass` / `partial` / `blocked` |
| `notes` | 仅记录与复现实验有关的上下文，不写入原始 payload |

## 当前阶段口径
- 结构化留痕以 diagnostics 导出为主，不额外引入远端 telemetry。
- richer event stream 仍属于后续 SQLite / monitor 核心落地后的增量项；当前 Phase 6 先保证失败路径和窗口回退路径可追溯。
- 任何录屏或截图都应至少能回指到一份 diagnostics 文件或本仓库的 schema 样例，避免“只有画面，没有字段”。
