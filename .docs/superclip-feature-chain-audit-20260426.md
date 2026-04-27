# SuperClip P0 功能链路完整性与逻辑检查

## 审计范围
- 时间：2026-04-26
- Super Dev 阶段：`quality`
- Active change：`2026-04-25-superclip-p0-local-clipboard-core`
- 输入依据：
  - `output/superclip-prd.md`
  - `output/superclip-architecture.md`
  - `output/superclip-uiux.md`
  - `.super-dev/changes/2026-04-25-superclip-p0-local-clipboard-core/tasks.md`
  - `.docs/quality/*`
  - 当前 `src/` 与 `src-tauri/src/lib.rs`

## 总体结论
P0 代码层主链路已经基本形成：监听 / 入库 / 搜索 / 选中 / copy-only / direct-paste fallback / 设置 / 规则 / 快捷键 / 权限 / 诊断 / 恢复模式均有真实调用链，不是仅停留在 UI 假数据层。

但还不能进入 `delivery`：PRD 的风险关闭门要求真实宿主录屏和场景证据，当前仍缺 `fallback_window`、Dock reopen、登录启动首屏、真实目标应用 rich text / image 反馈、菜单栏点击过程等证据。当前未完成点主要是质量证据与宿主验证，不是核心代码类别缺失。

## 自动验证结果
| 检查 | 结果 | 备注 |
|---|---|---|
| `npm run build` | 通过 | Vite production build 成功 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 通过 | Rust 静态检查通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 通过 | 7 passed |
| `npm run quality:search-benchmark` | 通过 | P50=0.464ms，P95=0.99ms，max=2.835ms |

## 功能链路矩阵
| 功能域 | 文档要求 | 当前实现证据 | 完整性判断 | 缺口 / 风险 |
|---|---|---|---|---|
| 菜单栏与唤起 | 菜单栏图标、全局快捷键、搜索框默认聚焦 | Rust 安装 tray、菜单事件、tray 点击唤起；前端 bootstrap 后刷新 placement 与 session state | 部分闭环 | 菜单栏点击过程录屏仍缺；当前证据主要是截图 |
| 剪贴板监听与入库 | text / image / file / HTML / RTF 捕获、去重、SQLite / FTS | monitor 线程读取 pasteboard、去环 hash、写 SQLite；入库前读取 SQLite `exclusion_rules` 并按规则过滤 | 已闭环 | 仍需真实敏感来源 App Bundle ID 验证 |
| 搜索与定位 | FTS、中文回退、首项高亮、会话恢复 | 前端 `clipboardSearch` 驱动列表；session state 保存 query / selected / scroll；后端返回 `match_type / matched_fields / highlight_ranges`，前端 HistoryRow 渲染高亮 | 已闭环 | 仍需视觉截图证据 |
| 执行动作 copy-only | 选中记录后写回系统剪贴板 | `clipboard_copy` 读取 payload、写 pasteboard、标记 self write、更新 use count | 已闭环 | 真实 file 多文件 copy-only 仍缺目标应用证据 |
| 执行动作 direct paste / fallback | text 强承诺；HTML / RTF / image best-effort；file copy-only | `clipboard_paste` 写 payload，检查 Accessibility，触发 paste，失败进入 `build_paste_result` 与 diagnostics | 部分闭环 | 真实目标应用录屏缺；当前主要由 orchestrator 单测覆盖 |
| 置顶 / 取消置顶 | 单条置顶，置顶项优先，超过 50 提醒 | 前端按钮调用 pin/unpin；Rust 更新 `is_pinned` / `pinned_at`；设置页有 50 条提示 | 已闭环 | 需补搜索结果中置顶排序的集成证据 |
| 删除 / 30 秒撤销 | 单条删除无 confirm，30 秒内可撤销，过期不可恢复 | 前端 30 秒 toast；Rust `clipboard_trash` 缓冲、restore、`UNDO_EXPIRED` | 已闭环 | 录屏仍缺；恢复后排序与搜索结果需要手工勾验 |
| 清空历史 | 二次确认，不撤销，不影响系统当前剪贴板 | 前端 `isClearConfirming` 二次确认；Rust 删除 items / FTS / trash | 已闭环 | 需要真实 UI 录屏 |
| 设置页 | P0 暴露快捷键、历史上限、默认动作、主题、登录启动、启动自动显示、排除规则、诊断导出 | `settings` 表已持久化 `default_action / theme_mode / history_limit / show_on_startup`；登录启动继续同步 autostart | 已闭环 | 仍需真实重启后 UI 验证 |
| 排除规则 | bundle id / content kind / keyword，独立模型，不混 settings 标量 | `exclusion_rules` 表已持久化；`rules:*` command 读写 SQLite；monitor 入库前过滤 | 已闭环 | Bundle ID 规则当前依赖 `source_app`，真实 App Bundle ID 采集仍需后续增强 |
| 快捷键录入与注册 | 默认 Cmd+Shift+V，录入、冲突检测、恢复默认 | 前端录入态完整；Rust shortcut commands 已注册，global shortcut 插件存在 | 部分闭环 | 仍缺真实全局快捷键触发录屏与冲突场景证据 |
| Accessibility 权限 | 未授权不阻断浏览 / 搜索 / copy-only，direct paste 降级 | Rust `AXIsProcessTrusted` 检查；前端 banner / 设置入口 / fallback toast | 已闭环 | 运行中撤销权限的真实录屏仍缺 |
| 登录启动 / 启动自动显示 | 登录启动失败 inline error；show_on_startup 控制首屏 | autostart 插件接入；settings 更新失败返回 `LOGIN_ITEM_UPDATE_FAILED` | 部分闭环 | 登录重启后的真实首屏与 `presentation_reason` 证据缺失；show_on_startup 是否驱动宿主自动展示需继续验证 |
| Dock reopen / 单窗口 | Dock 只复用同一主壳体，不创建第二窗口 | Rust `RunEvent::Reopen` 调用 `show_main_window`；已有 Dock 图标截图 | 部分闭环 | Dock reopen 单窗口复用录屏与 instance 日志缺失 |
| 多显示器 / safe area / fallback window | tray-relative、compact、fallback window，记录 `window-fallback-used` | runtime state 有 `lastWindowMode` / fallback reason；window placement refresh 已接入 | 部分闭环 | 当前 3360 x 2100 环境无法自然触发 fallback，需小屏 / 副屏 / 极端缩放证据 |
| 诊断导出 | 固定分段、脱敏、错误码可定位 | 后端 helper 与真实样例存在；写入失败单测覆盖 | 已闭环 | 取消保存面板录屏缺；窗口回退样例依赖 fallback 场景 |
| 恢复模式只读 | 迁移失败进入 recovery；写路径统一拒绝 | `ensure_not_recovery_mode` 拦截多类写 command；migration fail 注入已完成 | 已闭环 | 恢复模式 UI 录屏与所有危险动作逐项勾验仍缺 |
| UI / UX 约束 | Lucide、Inter、语义 token、shadcn/Radix/Tailwind、无 emoji | 前端使用 lucide-react、@fontsource/inter、CSS token；无功能 emoji | 基本闭环 | 多处圆角为 20-32px，和 UIUX 的 12/10/8px 形状 token 不完全一致，属视觉规范漂移 |

## 逻辑检查重点
1. **主链路逻辑成立**：`monitor -> SQLite/FTS -> search -> selected item -> copy/paste -> fallback/diagnostics` 已接通。
2. **恢复模式逻辑成立**：后端统一拒绝 `settings:update`、`clipboard:paste`、`pin/unpin/delete/clear` 等写路径，前端也有只读提示。
3. **权限降级逻辑成立**：无 Accessibility 时仍允许浏览、搜索、复制；direct paste 进入 copy-only fallback。
4. **质量门未关闭**：PRD 明确要求兼容性门、宿主集成门、诊断门、恢复门；当前缺口集中在真实宿主录屏和目标应用反馈。
5. **本轮已修正三个代码断链**：
   - 排除规则已持久化，并接入剪贴板监听入库过滤。
   - 搜索结果已带 `match_type / matched_fields / highlight_ranges`，前端列表已消费高亮。
   - P0 标量设置已落入 SQLite，重启后可从本地库恢复。

## 关键断链修复状态
### 1. 排除规则已闭合到真实采集链路
- 文档要求：排除规则按 App Bundle ID、内容类型、关键词三类配置，并影响入库。
- 当前状态：
  - schema 已新增 `exclusion_rules` 表，并保留三条默认规则。
  - `rules:list / upsert / delete / clear` 改为 SQLite 读写。
  - `start_clipboard_monitor` 在 `upsert_clipboard_snapshot` 前加载规则并执行过滤。
  - 单元测试 `exclusion_rules_persist_and_filter_snapshots` 已覆盖 keyword 过滤。
- 剩余风险：`bundle_id` 规则当前只能匹配已有 `source_app` 字段，真实前台 App Bundle ID 采集还未增强。

### 2. 搜索高亮契约已实现
- 文档要求：搜索 payload 必须带 `match_type`、`matched_fields`、`highlight_ranges`，前端必须消费这些字段。
- 当前状态：
  - `ClipboardItemSummary` 已新增 `match_type / matched_fields / highlight_ranges`。
  - 后端搜索结果会按查询词生成高亮范围。
  - 前端 `HistoryRow` 使用 `highlight_ranges` 渲染 title / preview 高亮。
  - 单元测试 `repository_upsert_and_search_round_trip` 已断言高亮字段存在。

### 3. 设置持久化已补齐
- 文档要求：历史上限、默认动作、主题、启动行为等属于 P0 设置冻结清单。
- 当前状态：
  - schema 已新增 `settings` 表。
  - `settings:get` 从 SQLite 加载标量设置，并继续同步 autostart 状态。
  - `settings:update` 写入 SQLite，并按 `history_limit` 触发历史裁剪。
  - 单元测试 `settings_persist_in_sqlite` 已覆盖持久化读取。
- 剩余风险：`show_on_startup` 的冷启动自动展示仍需真实宿主验证。

## 下一步建议
1. 补真实宿主 proof-pack：菜单栏点击、Dock reopen、登录启动首屏、fallback window、rich text / image 目标反馈、删除撤销。
2. 增强真实前台 App Bundle ID 采集，让 `bundle_id` 排除规则不依赖泛化的 `source_app` 字段。
3. 补重启后设置恢复验证：历史上限、默认动作、主题、show_on_startup。
4. 更新 `.docs/quality/2026-04-25-prd-acceptance-matrix.md` 中对应条目状态，再判断是否进入 `delivery`。
