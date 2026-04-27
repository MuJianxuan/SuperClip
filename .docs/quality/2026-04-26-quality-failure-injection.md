# SuperClip Quality 失败注入记录

## 执行时间
- 日期：2026-04-26
- 阶段：`quality`
- 变更：`2026-04-25-superclip-p0-local-clipboard-core`

## 本轮已验证
| 场景 | 结果 | 证据 |
|---|---|---|
| HTML flavor 采集 | 通过 | `NSPasteboardTypeHTML` 样本入库为 `kind=html`，`text_html` 与 `text_plain` 均存在，FTS 查询 `NSPasteboard` 命中 |
| Accessibility 真实检查 | 通过 | `ApplicationServices.AXIsProcessTrusted()` 可调用；当前宿主返回 `false`，未授权时 direct paste 会回退 copy-only |
| `DB_LOCKED` 写锁竞争 | 通过 | 外部 SQLite 会话持有 `BEGIN IMMEDIATE`，monitor 写入触发结构化 `DB_LOCKED` 日志，锁释放后同一剪贴板内容重试入库 |
| migration failure / recovery mode | 通过 | 临时 HOME 下构造不兼容 `_superclip_migrations` schema，启动真实二进制后进入 recovery 路径并输出结构化 `MIGRATION_FAILED` 日志 |
| diagnostics export 成功样例 | 通过 | 后端 helper 写出真实 JSON 文件，样例已落到 `.docs/quality/fixtures/diagnostics-export-runtime-sample.json` |
| diagnostics export 写入失败 | 通过 | 单元测试把导出目录替换为普通文件，后端返回稳定 `DIAGNOSTICS_EXPORT_FAILED` |
| 权限撤销 direct paste | 通过（orchestrator 层） | `build_paste_result` 在 Accessibility 缺失时固定回退 copy-only，并保留 `NO_ACCESSIBILITY` |
| 目标拒绝 payload | 通过（orchestrator 层） | `build_paste_result` 在目标返回 `PAYLOAD_UNSUPPORTED` 时固定回退 copy-only，并保留原始错误码 |

## DB_LOCKED 注入步骤
1. 启动 runtime：`npm run tauri dev -- --no-watch`
2. 使用外部 SQLite 会话持有真实写锁：
   - `sqlite3 "$HOME/Library/Application Support/SuperClip/superclip.sqlite3"`
   - `BEGIN IMMEDIATE;`
3. 写入剪贴板样本：
   - `SuperClip DB_LOCKED escalated retry smoke 2026-04-26 10:36`
4. 持锁超过 `busy_timeout=2500ms`，runtime 输出结构化日志：
   - `{"context":"clipboard-monitor/write","error_code":"DB_LOCKED","event":"superclip_recent_error","level":"warn","occurred_at":"unix-1777172078"}`
   - 后续轮询继续输出同类 `DB_LOCKED` 记录，证明未吞掉错误。
5. 执行 `ROLLBACK;` 释放锁。
6. SQLite 查询验证锁释放后成功入库：
   - `text | SuperClip DB_LOCKED escalate... | SuperClip DB_LOCKED escalated retry smoke 2026-04-26 10:36`

## 修复点
- 发现风险：monitor 原先在写库前更新 `last_seen_hash`，如果写库失败，同一剪贴板内容会被后续轮询误判为已处理。
- 修复方式：自写入去环仍立即更新 hash；普通外部剪贴板内容只有在 `upsert_clipboard_snapshot` 成功后才提交 `last_seen_hash`。
- 结果：`DB_LOCKED` 时保留重试机会，锁释放后同一内容可入库。
- 启动期修复：数据库打开 / migration 失败时不再丢失原因，启动会写入 `recent_errors` 并输出结构化 `superclip_recent_error` 日志；error code 统一映射为 `MIGRATION_FAILED` / `DATABASE_PATH_UNAVAILABLE` / `DB_LOCKED`。

## Migration failure 注入步骤
1. 准备临时 HOME：`/tmp/superclip-quality-migration-fail-20260426-1103`
2. 构造不兼容迁移表：
   - `CREATE TABLE _superclip_migrations(foo INTEGER);`
3. 重新构建 app binary：`cargo build --manifest-path src-tauri/Cargo.toml`
4. 用临时 HOME 启动真实二进制：
   - `HOME="/tmp/superclip-quality-migration-fail-20260426-1103" src-tauri/target/debug/superclip`
5. 结构化日志证据：
   - `{"context":"startup-database-open/DB_ERROR:Error { code: Unknown, extended_code: 1 }","error_code":"MIGRATION_FAILED","event":"superclip_recent_error","level":"warn","occurred_at":"unix-1777172855"}`
6. 预期结果：
   - 主库打开 / migration 失败后回退到 in-memory recovery connection。
   - `runtime_state.is_recovery_mode=true`，写路径继续由 `RECOVERY_MODE_READ_ONLY` 保护。

## Diagnostics export 注入步骤
1. 将 diagnostics 导出逻辑抽为后端 helper：
   - `build_diagnostics_payload`
   - `write_diagnostics_export`
2. 成功路径单元测试：
   - 写入临时目录。
   - 校验固定分段全部存在：`app_info`、`os_info`、`permissions`、`migration_summary`、`db_health_summary`、`recent_errors`、`settings_summary`、`window_fallback_records`。
   - 校验不包含 `clipboard_payloads`、`text_plain`、`image_blob` 等原始剪贴板 payload 字段。
3. 失败路径单元测试：
   - 把导出目录设置为普通文件。
   - 预期返回 `DIAGNOSTICS_EXPORT_FAILED`。
4. 真实样例：
   - `.docs/quality/fixtures/diagnostics-export-runtime-sample.json`

## 已执行自动检查
| 检查项 | 结果 |
|---|---|
| `cargo check --manifest-path src-tauri/Cargo.toml` | 通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 通过，7 passed |
| `cargo build --manifest-path src-tauri/Cargo.toml` | 通过 |
| `npm run quality:search-benchmark` | 通过，P50=0.487ms，P95=1.525ms，max=2.548ms |

## 仍未关闭
- anchor lost / window fallback 的截图或录屏证据。
- direct paste 目标拒绝 payload 的真实目标应用录屏证据。
- PRD 场景验收矩阵逐项勾验。
