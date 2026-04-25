# SuperClip 架构说明（P0修订版）

## 总体架构
- **宿主**：Tauri 2
- **后端**：Rust
- **前端**：TypeScript + Vite + React
- **存储**：SQLite（本地）
- **图标**：Lucide
- **组件生态**：shadcn/ui + Radix + Tailwind

## 设计原则
- 只做本地，不做云；所有状态都围绕本机 SQLite 运行。
- 剪贴板监听、归一化、持久化、直接粘贴全部由 Rust 负责。
- 前端只负责展示、搜索交互、设置编排与状态呈现。
- 菜单栏不是原生长菜单，而是一个自定义 popover，才能承载双分组内容。

## 运行时结构
1. **Tray / Status Item**
   - 一个菜单栏图标
   - 点击后打开 / 隐藏 popover
   - popover 内分为“粘贴记录”和“功能列表”两组

2. **Clipboard Monitor**
   - 后台轮询 pasteboard
   - 读取 text / image / file / html / rtf
   - 计算 content hash，避免重复入库
   - 识别自我写入，防止循环

3. **Clipboard Normalizer**
   - 将原始 pasteboard 数据统一成内部模型
   - 为列表、搜索、预览生成标准摘要
   - 生成可搜索文本与展示预览

4. **Persistence Layer**
   - SQLite + WAL + busy_timeout
   - FTS 索引用于搜索
   - migrations 管理 schema 版本
   - 清理、裁剪、VACUUM 统一在后台低峰执行

5. **Paste Orchestrator**
   - 负责“仅复制”和“直接粘贴”两种动作
   - 直接粘贴前检查 Accessibility trusted 状态
   - 复制当前剪贴板快照，执行后按需恢复
   - 失败时自动回退为仅复制

6. **Settings Service**
   - 热键、保留数量、排除规则、粘贴策略、主题、启动行为

7. **Lifecycle / Recovery Service**
   - 处理启动、退出、崩溃恢复、迁移恢复
   - 保证菜单栏常驻与窗口状态恢复

8. **Window Placement Service**
   - 负责 tray-relative 定位、显示器选择、安全区避让与回退窗口策略
   - 在菜单栏定位失败时回退为当前显示器的居中工具窗口

9. **Session UI State Service**
   - 维护搜索词、选中项、滚动位置、最近显示器等会话级瞬时状态
   - 区分“同一会话重开可恢复”与“完整重启后默认清空”的边界

## IPC 契约
### Commands
- `clipboard:list`：分页获取历史列表
- `clipboard:search`：按关键词、来源、类型搜索
- `clipboard:get`：获取单条记录详情与预览
- `clipboard:copy`：仅复制到系统剪贴板
- `clipboard:paste`：执行直接粘贴或回退
- `clipboard:pin` / `clipboard:unpin`：更新单条记录的置顶状态
- `clipboard:delete`：删除单条记录
- `clipboard:restore`：从短期恢复缓冲区恢复单条记录
- `clipboard:clear`：清空历史
- `monitor:toggle`：切换监听状态
- `settings:get` / `settings:update`：读取与更新设置
- `rules:list`：读取排除规则列表与计数摘要
- `rules:upsert`：创建或更新单条排除规则
- `rules:delete`：删除单条排除规则
- `rules:clear`：清空排除规则
- `shortcut:get`：获取当前全局快捷键绑定与默认值
- `shortcut:start-recording` / `shortcut:cancel-recording`：开始 / 取消快捷键录入态
- `shortcut:validate`：校验候选快捷键是否与系统或应用内已有绑定冲突
- `shortcut:update`：提交新的快捷键绑定
- `shortcut:restore-default`：恢复默认全局快捷键
- `permission:check-accessibility`：检查 Accessibility 状态
- `permission:open-accessibility`：打开系统设置引导
- `diagnostics:export`：导出本地诊断包
- `app:show-settings`：打开设置窗口
- `app:quit`：显式退出

### Events
- `history-updated`
- `search-results-updated`
- `item-updated`
- `item-deleted`
- `item-restored`
- `monitor-status-changed`
- `permission-status-changed`
- `paste-failed`
- `migration-state-changed`
- `recovery-mode-changed`
- `window-fallback-used`
- `startup-integration-failed`
- `diagnostics-exported`
- `reindex-started`
- `reindex-finished`
- `settings-updated`
- `shortcut-recording-started`
- `shortcut-recording-cancelled`
- `shortcut-conflict-detected`
- `shortcut-updated`
- `exclusion-rules-updated`

### Windows
- `tray-popover`：主交互窗口
- `settings`：设置窗口
- `permission-guide`：权限引导层

### Payload 约定
- 前端默认仅接收摘要、预览文本、元信息与状态，不直接暴露大字段。
- 原始 payload 通过按需接口获取，并且仅对当前选中项开放。
- 所有 command / event payload 都必须包含稳定的 `version` 或兼容字段，避免后续迁移破坏。
- `diagnostics:export` 返回 `file_path`、`exported_at`、`included_sections`、`version`；失败时返回稳定错误码。
- `clipboard:delete` 返回 `undo_token`、`expires_at`、`version`；若恢复缓冲区已过期则返回 `UNDO_EXPIRED`。
- `clipboard:restore` 只接受有效 `undo_token`，成功后返回恢复后的条目摘要。
- 进入恢复模式后，所有写库 command 必须返回 `RECOVERY_MODE_READ_ONLY`，前端据此统一降级 UI。
- `tray-popover` 打开时可附带 `session_restore_scope`（`session` / `cold_start`）与 `target_display_hint`，用于决定是否恢复搜索上下文。
- 前端状态 payload 应额外带出 `presentation_reason`（`manual_open` / `startup_autoshow` / `no_history` / `search_empty` / `recovery_mode`），用于稳定选择首屏文案。
- `settings:get` / `settings:update` 的返回结构必须带 `schema_version`、`exposed_keys`、`reserved_keys`，避免前端误把预留项当成首版 UI 必需项。
- `settings:get` 只返回标量设置与规则摘要；排除规则明细通过 `rules:list` 获取。
- `shortcut:*` 命令的返回结构统一带 `binding`、`is_registered`、`source`（`user` / `default`）、`version`；冲突校验额外返回 `conflict_type` 与 `conflict_target`。

### 搜索结果 payload
- `clipboard:search` 请求字段至少包含：`query`、`limit`、`cursor?`、`kind_filter?`、`include_pinned=true`、`version`。
- `clipboard:search` 返回字段至少包含：`query`、`normalized_query`、`results[]`、`total`、`next_cursor?`、`search_time_ms`、`version`。
- `results[]` 中每个摘要项至少包含：
  - `id`、`kind`、`preview_text`、`preview_meta`
  - `source_app`、`origin_bundle_id`
  - `is_pinned`、`pinned_at`
  - `created_at`、`last_seen_at`、`last_used_at`
  - `is_truncated`
  - `match_type`（`exact` / `prefix` / `contains` / `recent`）
  - `rank_score`
  - `matched_fields`
  - `highlight_ranges`
  - `version`
- `highlight_ranges` 结构统一为 `{ field, start, end }[]`；`field` 仅允许 `preview_text`、`source_app`、`file_name`、`normalized_plain_text`。
- 前端禁止脱离 `highlight_ranges` 自行做模糊高亮；最多只允许在开发兜底态下禁用高亮，而不是重新计算高亮。

### 预览元数据契约（`preview_meta`）
- 所有列表首屏展示所需的类型化元数据必须进入 `preview_meta`，**不得仅存放在 `extra_json`**。
- `text`：`{ char_count, line_count }`
- `html` / `rtf`：`{ char_count, line_count, has_html, has_rtf, normalized_plain_text }`
- `image`：`{ width, height, thumbnail_strategy, mime_type? }`
- `file`：`{ file_count, primary_name, path_preview }`
- `truncated` / `unsupported`：`{ truncated_reason, original_estimated_size? }`

### 诊断导出 schema
- `diagnostics:export` 产物固定包含：
  - `app_info`
  - `os_info`
  - `permissions`
  - `migration_summary`
  - `db_health_summary`
  - `recent_errors`
  - `settings_summary`
  - `window_fallback_records`
- `recent_errors` 默认最多 50 条；`window_fallback_records` 默认最多 20 条。
- `settings_summary` 仅允许导出标量设置与规则数量，不导出排除关键词明文。
- 诊断包禁止导出原始剪贴板 payload、图片二进制、完整 HTML / RTF、完整文件路径与文件实体内容。

## 数据模型
### clipboard_items
- id
- kind（text / image / file / html / rtf）
- content_hash
- preview_text
- preview_meta_json
- source_app
- is_pinned
- pinned_at
- use_count
- last_used_at
- payload_size_bytes
- is_truncated
- is_sensitive
- origin_bundle_id
- preview_strategy
- created_at / last_seen_at

### clipboard_payloads
- item_id
- text_plain
- text_html
- text_rtf
- image_blob
- file_urls_json
- extra_json（仅用于非首屏渲染必需的扩展字段）

### clipboard_trash
- trash_id
- item_id
- undo_token
- item_json
- payload_json
- deleted_at
- expires_at
- deleted_by_action（delete）

### settings
- key
- value_json

P0 暴露设置键：

| key | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `global_shortcut` | string | `Cmd+Shift+V` | 全局唤起热键 |
| `history_limit` | integer | `1000` | 建议范围 `100 ~ 5000` |
| `default_action` | enum | `direct_paste` | `direct_paste` / `copy_only` |
| `theme_mode` | enum | `light` | `light` / `dark` / `system` |
| `launch_at_login` | boolean | `false` | 登录时启动 |
| `show_on_startup` | boolean | `false` | 冷启动后自动展示主界面 |

P1 预留键（schema 冻结，P0 首版不暴露）：

| key | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `restore_clipboard_delay_ms` | integer | `150` | 直接粘贴后恢复剪贴板的内部延迟 |
| `density_mode` | enum | `comfortable` | 列表密度 |
| `row_height_mode` | enum | `default` | 行高预设 |
| `hover_emphasis` | enum | `standard` | hover 强度 |
| `thumbnail_density` | enum | `balanced` | 缩略图密度 |

- `settings:update` 只允许修改声明在 schema 内的 key；未知 key 一律返回稳定错误码，不做静默落库。

### exclusion_rules
- id
- rule_type（bundle_id / keyword / content_kind）
- rule_value
- is_enabled
- created_at / updated_at

- 排除规则通过 `rules:list / upsert / delete / clear` 单独管理，不混入 `settings` 表的标量键。

### fts_clipboard_items
- 对 `text_plain`、`preview_text`、文件名、`source_app` 建索引
- 维护归一化搜索列，支持中文包含匹配回退

## 存储边界与清理策略
- 文本 / HTML / RTF：默认 2MB 上限
- 图片：默认 8MB 上限
- 文件：仅存 URL 与元数据
- 超限内容：仅保留摘要、来源、时间、尺寸等元数据
- 默认历史条数：1000
- 置顶项不参与自动淘汰
- 重复内容只更新 `last_seen_at` / `use_count`
- 后台定期执行 `VACUUM` / `PRAGMA optimize`

## 关键实现决策
- **不要**把 `arboard` 作为唯一方案：它更适合 text/image 参考，不足以覆盖 file / rich text 全量需求。
- **要**使用 macOS 原生 pasteboard 适配层。
- **要**把 Accessibility 作为直接粘贴门槛。
- **要**使用 tray-relative window positioning（positioner）让 popover 贴近菜单栏。
- **要**区分“数据库写入中”和“索引更新中”，不使用“同步中”措辞。

## 窗口定位与多显示器策略
- 菜单栏点击路径：优先使用 tray anchor 所在显示器进行 tray-relative 定位。
- 全局快捷键路径：优先使用当前焦点应用所在显示器；若无法解析，则回退主显示器。
- Dock 点击或系统 reopen 事件：优先使用最近一次成功展示的显示器；若显示器已断开，则回退主显示器。
- 安全区策略：popover 必须避开刘海区、菜单栏保留区与屏幕边缘，搜索框和顶部状态条不能被裁切。
- 标准模式宽度保持 840 ~ 880px；当当前显示器安全区不足时降级为 720 ~ 760px 的紧凑模式。
- 若紧凑模式仍无法满足安全区、或 positioner 返回不可用，则改用同一 `tray-popover` 内容壳体，以居中工具窗口模式显示。
- 回退到居中工具窗口时，必须保留全部核心动作；同时发出 `window-fallback-used` 事件供诊断与日志记录。
- 若宿主不支持完全隐藏 Dock，则 Dock 只绑定到“show existing shell”语义，不允许通过 Dock 创建额外主窗口实例。

## 直接粘贴时序
1. 读取当前选中项的可粘贴 payload。
2. 写入系统剪贴板。
3. 若 Accessibility 可用，则恢复目标应用焦点并触发粘贴快捷键。
4. 若目标应用失焦、快捷键失败或权限不足，则立即回退为仅复制。
5. 回退完成后恢复可追踪状态，并发出 `paste-failed` 事件与可读提示。

## 直接粘贴支持矩阵
| kind | P0 默认策略 | 说明 |
|---|---|---|
| `text` | direct paste | 标准成功路径，必须作为冒烟测试基线 |
| `html` / `rtf` | direct paste（best effort） | 写入富文本格式并附带 plain text；目标应用若仅接受纯文本，则允许退化为 plain text 粘贴 |
| `image` | direct paste（best effort） | 仅对接受标准图片 pasteboard 的目标应用尝试；失败统一回退 copy-only |
| `file` | copy-only | P0 不承诺跨应用 file URL direct paste，一律不模拟“自动粘贴文件” |
| `truncated` / `unsupported` | copy-only 或 view-only | 根据是否存在可复制摘要决定是否开放 copy-only |

## 失败分类
- `NO_ACCESSIBILITY`
- `TARGET_APP_NOT_FOCUSED`
- `PASTEBOARD_WRITE_FAILED`
- `PAYLOAD_UNSUPPORTED`
- `SHORTCUT_CONFLICT_SYSTEM`
- `SHORTCUT_CONFLICT_APP`
- `SHORTCUT_INVALID`
- `SHORTCUT_RECORDING_TIMEOUT`
- `USER_CANCELLED`
- `WINDOW_POSITION_UNAVAILABLE`
- `LOGIN_ITEM_UPDATE_FAILED`
- `RECOVERY_MODE_READ_ONLY`
- `DIAGNOSTICS_EXPORT_FAILED`
- `UNDO_EXPIRED`
- `DB_LOCKED`
- `MIGRATION_IN_PROGRESS`
- `UNKNOWN`

## 典型数据流
1. 用户复制内容
2. Monitor 检测变化
3. Normalizer 解析成统一模型
4. Repository 写入 SQLite + FTS
5. Frontend 收到刷新事件
6. 用户搜索并选中项
7. Paste Orchestrator 执行直接粘贴或仅复制
8. 必要时自动回退并恢复剪贴板快照

## 权限与降级
- 无 Accessibility：允许读取、浏览、搜索、复制；禁止直接粘贴
- 首启未授权：展示引导层
- 用户拒绝授权：面板顶部提示 + 设置页入口，不阻断主流程
- 设置页可重复触发系统设置打开

## 生命周期与恢复
- 支持登录启动
- 关闭窗口不退出，仅隐藏主界面
- 退出必须显式通过功能列表执行
- 崩溃后重启：恢复窗口状态、监听状态与数据库连接
- 登录启动默认只恢复后台驻留，不主动弹出主界面；是否启动时自动显示由设置项单独控制。
- 登录启动开关更新失败时，返回 `LOGIN_ITEM_UPDATE_FAILED`，并发出 `startup-integration-failed` 事件。
- 同一进程会话内的 reopen（快捷键 / tray / Dock）允许恢复瞬时搜索上下文；完整重启、登录启动自动展示与崩溃后恢复默认清空旧搜索词。
- 若启用 `show_on_startup`，启动后仅自动展示一次主界面壳体；不重复回放上次搜索结果，也不额外打开设置窗口。
- 迁移失败：进入恢复模式，优先保障历史可读
- 若 DB 锁冲突：串行写入 + busy timeout
- 迁移进行中 / 恢复中：属于阻塞态，前端显示全局遮罩，不开放交互写操作。
- 恢复模式下只开放浏览、搜索、复制与诊断，不开放直接粘贴。
- 恢复模式下禁止 `clipboard:pin` / `clipboard:unpin` / `clipboard:delete` / `clipboard:clear` / `settings:update` 等写库 command。
- `clipboard:delete` 将条目移入默认 30 秒的短期恢复缓冲区，便于撤销；过期项由后台自动清理，不影响正常历史列表。
- `clipboard:restore` 仅在缓冲期内可用，恢复成功后重新进入正常排序与搜索结果。
- `clipboard:clear` 直接永久清空历史，不进入恢复缓冲区。

## 空状态派生规则
- `startup_autoshow`：满足 `show_on_startup=true` 且冷启动首次展示时触发，默认使用空搜索态文案，不读取旧搜索词。
- `no_history`：历史列表为空且当前无关键词时触发。
- `search_empty`：当前存在关键词且结果集为空时触发。
- `recovery_mode`：恢复模式优先级最高；若同时满足无历史或搜索无结果，仍优先展示恢复模式文案与只读限制。
- 前端不得自行凭 UI 猜测首屏语义，优先依据后端派生状态与 `presentation_reason` 渲染。

## 安全边界
- 数据默认只存本地 SQLite，不同步到任何远端服务。
- 前端不直接持有大 payload 的长期引用，避免无意扩散敏感内容。
- 临时图片、截断内容和迁移中间态都必须可清理、可追踪、可恢复。
- 允许用户通过排除规则跳过敏感来源，但不强制自动识别密码类内容。

## 搜索与排序
- 默认顺序：置顶优先，其余按最近复制 / 使用倒序
- 置顶项内部按最近置顶时间倒序
- 搜索命中优先级：精确 > 前缀 > 包含 > 最近性
- 中文搜索：FTS + 归一化列 + `LIKE` / contains 回退
- 搜索结果支持高亮与来源标记
- 当置顶数量超过 50 条时，后端在列表响应与 `settings:get` 中附带 `pin_count_warning=true`，由前端展示轻量提示但不阻断操作。

## 性能预算
- 启动到可唤起：目标 3 秒内进入可交互状态。
- 搜索结果刷新：1k 条历史记录下 P95 不超过 120ms。
- 菜单栏唤起：P95 不超过 300ms。
- 后台监听空转：持续 CPU 低于 5%。
- 常驻内存：目标低于 220MB。
- direct paste 失败回退并给出提示：目标 1 秒内完成。
- WAL + busy_timeout 保证写入高峰不阻塞前端浏览。

## 性能验证口径与证据
- **冷启动口径**：从宿主进程创建到 `tray-popover` 搜索框可输入为止；日志需记录 `app_start`、`window_ready` 两个时间点。
- **搜索口径**：基于固定 1000 条样本集执行至少 20 次查询，输出 P50 / P95 / max，并记录查询词类别（精确 / 前缀 / 包含 / 中文回退）。
- **菜单栏唤起口径**：分别测量主屏 tray 点击、副屏快捷键、Dock reopen 三类入口，每类至少保留一次录屏或结构化计时日志。
- **CPU / 内存口径**：在监听空转 5 分钟窗口内采样，保留 Activity Monitor 截图或等价结构化采样结果。
- **失败回退口径**：至少保留 1 次 direct paste 失败后回退 copy-only 的录屏、错误码与完成耗时。
- **恢复模式口径**：至少保留 1 次迁移失败进入恢复模式的截图与诊断导出样例。

## 错误处理
- Clipboard 读取失败：重试 + 轻提示
- DB 锁冲突：排队写入
- 权限缺失：降级到仅复制，并提示打开系统设置
- popover 打开失败：回退到主窗口 / 重试定位
- 登录启动集成失败：保留当前设置页上下文，提示重试，不影响主界面常规使用
- 直接粘贴失败：自动回退为仅复制并恢复快照
- 删除单条后若用户点击撤销，优先从短期恢复缓冲区恢复；若缓冲区过期则给出已过期提示，不当作系统错误。
- Dock reopen 失败时，优先回退为主显示器居中工具窗口，不把失败暴露成致命错误。

## Capability / Feature Matrix
### Rust features
- `tray-icon`：系统托盘必开
- `positioner` 插件在 tray-relative 场景下需要启用 `tray-icon` feature

### Capability permissions
- `core:default`：主窗口基础 IPC
- `global-shortcut:allow-is-registered` / `global-shortcut:allow-register` / `global-shortcut:allow-unregister`：全局快捷键注册与注销
- `positioner:default`：定位菜单栏 popover
- 与打开系统设置相关的权限按最小授权原则单独配置，例如 `shell:allow-open` 或等价能力
- 诊断导出需要最小范围的保存对话框与目标路径写入能力，不给整个用户目录宽泛写权限

### Window scope
- `tray-popover` 允许读取历史、执行复制/粘贴、更新局部状态
- `settings` 允许更新设置、查看诊断、触发诊断导出
- `permission-guide` 仅允许权限检查与跳转系统设置

## 测试策略
- Rust 单元测试：归一化、hash、去重、schema 迁移
- 集成测试：SQLite 读写、FTS 搜索、权限降级
- 前端测试：列表渲染、搜索、设置持久化、状态展示
- 手工 smoke：复制、唤起、暂停、恢复、直接粘贴、删除后撤销、诊断导出

## 验收与证据映射
| 场景 | 主验证层 | 最低证据 |
|---|---|---|
| tray 唤起 | 手工 smoke | 当前显示器录屏 |
| 副屏快捷键唤起 | 手工 smoke | 副屏录屏 + 定位日志 |
| 登录启动失败降级 | 手工 smoke + 集成 | 设置页提示截图 + 错误日志 |
| 启动自动显示空搜索态 | 手工 smoke + 前端测试 | 首屏截图 + 无旧搜索词日志 |
| 搜索无结果空状态 | 前端测试 + 手工 smoke | UI 截图 |
| 恢复模式只读 | 集成 + 手工 smoke | 状态截图 + 诊断导出文件 |
| 删除后撤销 | 集成 + 前端测试 | UI 录屏 + restore 日志 |
| 诊断导出取消 | 手工 smoke | 无错误 toast 录屏 |
