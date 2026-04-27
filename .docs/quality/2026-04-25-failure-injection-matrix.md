# SuperClip P0 失败注入矩阵

## 目的
- 将 `output/superclip-architecture.md` 中要求的失败注入场景拆成当前可执行、部分可执行、暂时阻塞三类。
- 明确每类场景的触发方式、预期错误码、diagnostics 落点和当前阻塞原因。

## 状态定义
- `可执行`：当前仓库已经具备触发路径，能够在现有实现中复现。
- `部分可执行`：代码路径已实现，但仍需要真实宿主 / 手工操作配合。
- `阻塞`：当前实现缺少可控注入钩子，或必须依赖尚未准备好的外部宿主条件。

## 注入矩阵
| 场景 | 当前状态 | 触发方式 | 预期错误码 / 状态 | diagnostics 落点 |
|---|---|---|---|---|
| Accessibility 运行中撤销 | 已执行（orchestrator 层） | `AXIsProcessTrusted=false`，并通过 `build_paste_result` 单测覆盖未授权 direct paste | `NO_ACCESSIBILITY` + copy-only fallback | `recent_errors` |
| tray anchor / safe area 不足 | 可执行 | 缩小窗口或切换到不足以容纳标准模式的显示区域，触发 `windowPlacementRefresh` | `fallback_window` / `compact_popover`，必要时 `WINDOW_POSITION_UNAVAILABLE` | `window_fallback_records` + `recent_errors` |
| Dock reopen 去重 | 部分可执行 | 隐藏主窗口后从 Dock 再次打开 | 单窗口复用，不出现第二实例 | `window_fallback_records`（若回退） |
| diagnostics 保存失败 | 已执行（后端 helper） | 把导出目录替换为普通文件，执行 `write_diagnostics_export` 单元测试 | `DIAGNOSTICS_EXPORT_FAILED` | 单元测试 + `recent_errors` 写入路径 |
| rich text 目标拒绝 | 部分可执行 | 在不保留富文本的目标区执行 HTML / RTF direct paste | `RICH_TEXT_DEGRADED` | `recent_errors` |
| image 目标拒绝 | 已执行（orchestrator 层） | `build_paste_result` 注入 `PAYLOAD_UNSUPPORTED` | `PAYLOAD_UNSUPPORTED` + copy-only fallback | `recent_errors` |
| recovery mode 拒绝写操作 | 可执行（进入恢复模式需外部注入） | 进入恢复模式后依次尝试 `settings:update`、`clipboard:delete`、`clipboard:clear` 等 | `RECOVERY_MODE_READ_ONLY` | `recent_errors` |
| 快捷键冲突 | 可执行 | 在设置页录入 `Cmd+Space`、`Cmd+Tab` 等保留绑定 | `SHORTCUT_CONFLICT_SYSTEM` / `SHORTCUT_CONFLICT_APP` | `recent_errors` |
| 规则重复 | 可执行 | 创建同类型同值规则两次 | `RULE_DUPLICATE` | `recent_errors` + UI inline error |
| 删除后撤销超时 | 可执行 | 删除后等待缓冲过期再恢复 | `UNDO_EXPIRED` | `recent_errors` |
| 登录启动更新失败 | 部分可执行 | 真实宿主中让 autostart manager 失败 | `LOGIN_ITEM_UPDATE_FAILED` | `recent_errors` |
| migration fail | 已执行 | 临时 HOME 下构造不兼容 `_superclip_migrations` schema，再启动真实二进制 | `MIGRATION_FAILED` + recovery mode，写路径继续返回 `RECOVERY_MODE_READ_ONLY` | `recent_errors` + 结构化 stderr 日志 + `migration_summary` |
| DB_LOCKED 超阈值 | 已执行 | 外部 SQLite 会话持有 `BEGIN IMMEDIATE` 写锁，期间写入新剪贴板内容 | `DB_LOCKED`，锁释放后同一内容重试入库 | `recent_errors` + 结构化 stderr 日志 |

## 当前结论
- 已经形成闭环的 error code / diagnostics 路径：
  - `NO_ACCESSIBILITY`
  - `PAYLOAD_UNSUPPORTED`
  - `RICH_TEXT_DEGRADED`
  - `SHORTCUT_CONFLICT_SYSTEM`
  - `SHORTCUT_CONFLICT_APP`
  - `WINDOW_POSITION_UNAVAILABLE`
  - `LOGIN_ITEM_UPDATE_FAILED`
  - `RECOVERY_MODE_READ_ONLY`
  - `DIAGNOSTICS_EXPORT_FAILED`
  - `RULE_DUPLICATE`
  - `UNDO_EXPIRED`
- 尚未完全闭环的场景主要集中在：
  - anchor lost / window fallback 的截图或录屏证据
  - direct paste 目标拒绝 payload 的真实目标应用证据

## 新增底稿
- diagnostics schema 样例：`.docs/quality/fixtures/diagnostics-export-sample.json`
- 宿主 smoke checklist：`.docs/quality/2026-04-25-host-smoke-checklist.md`
- 结构化留痕模板：`.docs/quality/2026-04-25-structured-log-evidence-template.md`

## 下一步建议
- 先在真实 Tauri 宿主中补齐：
  - Accessibility 撤销
  - Dock reopen
  - diagnostics 导出取消 / 失败
  - direct paste degrade / fallback
- 继续补：
  - anchor lost / window fallback 证据
  - direct paste 目标拒绝 payload 证据
