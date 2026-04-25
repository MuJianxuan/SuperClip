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

## IPC 契约
### Commands
- `clipboard:list`：分页获取历史列表
- `clipboard:search`：按关键词、来源、类型搜索
- `clipboard:get`：获取单条记录详情与预览
- `clipboard:copy`：仅复制到系统剪贴板
- `clipboard:paste`：执行直接粘贴或回退
- `clipboard:delete`：删除单条记录
- `clipboard:clear`：清空历史
- `monitor:toggle`：切换监听状态
- `settings:get` / `settings:update`：读取与更新设置
- `permission:check-accessibility`：检查 Accessibility 状态
- `permission:open-accessibility`：打开系统设置引导
- `app:show-settings`：打开设置窗口
- `app:quit`：显式退出

### Events
- `history-updated`
- `search-results-updated`
- `monitor-status-changed`
- `permission-status-changed`
- `paste-failed`
- `migration-state-changed`
- `reindex-started`
- `reindex-finished`
- `settings-updated`

### Windows
- `tray-popover`：主交互窗口
- `settings`：设置窗口
- `permission-guide`：权限引导层

### Payload 约定
- 前端默认仅接收摘要、预览文本、元信息与状态，不直接暴露大字段。
- 原始 payload 通过按需接口获取，并且仅对当前选中项开放。
- 所有 command / event payload 都必须包含稳定的 `version` 或兼容字段，避免后续迁移破坏。

## 数据模型
### clipboard_items
- id
- kind（text / image / file / html / rtf）
- content_hash
- preview_text
- source_app
- is_pinned
- use_count
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
- extra_json

### settings
- key
- value_json

### exclusion_rules
- id
- rule_type（bundle_id / keyword / content_kind）
- rule_value
- is_enabled
- created_at / updated_at

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

## 直接粘贴时序
1. 读取当前选中项的可粘贴 payload。
2. 写入系统剪贴板。
3. 若 Accessibility 可用，则恢复目标应用焦点并触发粘贴快捷键。
4. 若目标应用失焦、快捷键失败或权限不足，则立即回退为仅复制。
5. 回退完成后恢复可追踪状态，并发出 `paste-failed` 事件与可读提示。

## 失败分类
- `NO_ACCESSIBILITY`
- `TARGET_APP_NOT_FOCUSED`
- `PASTEBOARD_WRITE_FAILED`
- `PAYLOAD_UNSUPPORTED`
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
- 迁移失败：进入恢复模式，优先保障历史可读
- 若 DB 锁冲突：串行写入 + busy timeout
- 恢复模式下只开放浏览、搜索、复制与诊断，不开放直接粘贴。

## 安全边界
- 数据默认只存本地 SQLite，不同步到任何远端服务。
- 前端不直接持有大 payload 的长期引用，避免无意扩散敏感内容。
- 临时图片、截断内容和迁移中间态都必须可清理、可追踪、可恢复。
- 允许用户通过排除规则跳过敏感来源，但不强制自动识别密码类内容。

## 搜索与排序
- 默认顺序：置顶优先，其余按最近复制 / 使用倒序
- 搜索命中优先级：精确 > 前缀 > 包含 > 最近性
- 中文搜索：FTS + 归一化列 + `LIKE` / contains 回退
- 搜索结果支持高亮与来源标记

## 性能预算
- 启动到可唤起：目标 3 秒内进入可交互状态。
- 搜索结果刷新：1k 条历史记录下 P95 不超过 120ms。
- 菜单栏唤起：P95 不超过 300ms。
- 后台监听空转：持续 CPU 低于 5%。
- WAL + busy_timeout 保证写入高峰不阻塞前端浏览。

## 错误处理
- Clipboard 读取失败：重试 + 轻提示
- DB 锁冲突：排队写入
- 权限缺失：降级到仅复制，并提示打开系统设置
- popover 打开失败：回退到主窗口 / 重试定位
- 直接粘贴失败：自动回退为仅复制并恢复快照

## Capability / Feature Matrix
### Rust features
- `tray-icon`：系统托盘必开
- `positioner` 插件在 tray-relative 场景下需要启用 `tray-icon` feature

### Capability permissions
- `core:default`：主窗口基础 IPC
- `global-shortcut:allow-is-registered` / `global-shortcut:allow-register` / `global-shortcut:allow-unregister`：全局快捷键注册与注销
- `positioner:default`：定位菜单栏 popover
- 与打开系统设置相关的权限按最小授权原则单独配置，例如 `shell:allow-open` 或等价能力

### Window scope
- `tray-popover` 允许读取历史、执行复制/粘贴、更新局部状态
- `settings` 允许更新设置与查看诊断
- `permission-guide` 仅允许权限检查与跳转系统设置

## 测试策略
- Rust 单元测试：归一化、hash、去重、schema 迁移
- 集成测试：SQLite 读写、FTS 搜索、权限降级
- 前端测试：列表渲染、搜索、设置持久化、状态展示
- 手工 smoke：复制、唤起、暂停、恢复、直接粘贴
