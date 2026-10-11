# SuperClip 全表面重设计 · 执行账本

来源计划：`.docs/redesign-impl-ledger.md`（用户 2026-10-11 确认）｜技能：feature-dev-verify
开工：2026-10-11 ｜ 状态：**阶段 A 进行中**

---

## 表头区

### 目标与整体验收

落地五个表面（Popup / Main / QuickPanel / Preview / Settings）的重设计：单一强调色 `#0A84FF`、类型色 4→0、四表面新尺寸、回收站 UI、设置 5 区、统一 Toast。

**整体验收**：`npm run test`（前端 + Rust）全绿 + `npm run build` 通过 + `npm run tauri dev` 实机截图逐表面核对。

### 范围 / 非目标 / 约束

- 范围内：前端 5 表面重做；Rust 尺寸常量 + 5 项能力补缺；`tauri.conf.json` 尺寸。
- 非目标：监控/搜索/去重算法；云同步；AI；检查更新。
- 兼容/回滚：无数据库迁移（沿用既有 `clipboard_trash` 表，仅改 `expires_at` 语义）；回滚 = 回到 HEAD `1dc6aad`（工作区除本账本外干净）。

### 测试与验证要求

| 命令 | 用途 | 基线 |
|---|---|---|
| `npm run test:frontend` | vitest | 15 files / 159 tests passed；4 条 unhandled rejection（`transformCallback is not a function`，预先存在） |
| `npm run test:rust` | cargo test | 未跑（本次建立） |
| `npm run build` | tsc + vite build | 未跑（本次建立） |
| `rg` 静态扫描 | 旧 token / 旧尺寸零残留 | — |
| `npm run tauri dev` + `screencapture` | 尺寸、溢出、配色 | — |

### 已确认决策（用户 2026-10-11）

| # | 决策 |
|---|---|
| C1 | 授权改 Rust：`clipboard_trash_list`、`clipboard_trash_purge`、`settings_reset`、`clipboard_paste` 加 `asPlainText`、`ClipboardItemSummary` 补 `useCount`+`payloadSizeBytes` |
| C2 | 回收站与撤销统一 **30 天**：`expires_at = now + 30天`；`clipboard_restore` 过期返回 `UNDO_EXPIRED` 但不删行；Toast 5 秒后消失、条目留在回收站 |
| C3 | Main 默认 **900×620**，`minWidth 820 / minHeight 520` |
| C4 | 列表行保持中性灰图标；网格卡片与 Preview 用真实缩略图 |
| C5 | 配色只改 token 值，保留现有变量名；类型色 4 个改成中性灰值 |
| C6 | 授权 `npm run tauri dev` + 截图验证 |

### 阶段交接

（阶段完成时回填）

---

## 计划项

| ID | 来源 | 目的与变更内容 | 关联文件/符号 | 依赖 | 完成判据 | 验证方式 | 状态 | 基线 | 实现变更 | 验证证据 | 复查结果 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | D1/D2/D5 | 配色收敛：单一强调色 `#0A84FF`，类型色 4→0 | `src/App.css`、`settings-shell.tsx`、`QuickPanelApp.tsx`、`MainListView.tsx`、`MainGridView.tsx`、`MainTabNavigation.tsx`、`MainTopBar.tsx`、`kind-meta.ts`、`ui/switch.tsx`、`ui/button.tsx` | — | 旧色值零残留（测试除外）；前端测试全绿 | `rg` 静态扫描 + `npm run test:frontend` | 已验证 | 12 文件命中旧色：App.css 68、settings-shell 32、QuickPanelApp 13、kind-meta 8、MainTabNavigation 6、MainTopBar 4、MainGridView 3、MainListView 2、ui/button 1、ui/switch 1 + 2 测试文件 | App.css 三套主题 token 改值（accent #0A84FF/#0066d6、icon-idle、pinned #FF9F0A、success、半径 7/9/12）；8 个组件文件的 117 处 rgba + 39 处 hex 全改 token / color-mix；kind-meta、PopupHistoryRow、PreviewApp 类型色统一 var(--icon-idle) | `rg "38bdf8|fb7185|60a5fa|a78bfa|fbbf24|ef4444|34d399|fb923c|rgba\(56" src/` → 0 命中；`npm run test:frontend` 17 files / 196 tests passed | | R1 属实已修（switch 外发光 Tailwind 任意值截断→下划线写法）；R7 属实已修（补 `--warn` 三主题定义）；R13 属实已修（删 `kindColor`/`KIND_META.color`）；R18 驳回（半径 7/9/12 与设计稿一致，属 P1 配色语言一部分，未单列计划项） |
| P2 | D3/D5/D8/D9 | 四表面尺寸：900×620 / 320×480 / 248×400 / 320×360 | `src-tauri/src/lib.rs`、`src-tauri/tauri.conf.json` | — | 尺寸常量无旧值残留；Rust 测试全绿；JSON 解析得新值 | `rg` + `npm run test:rust` + JSON 解析 + P15 截图 | 已验证 | lib.rs:42-45 760×540；3654/3699 inner_size(280,420)；3743 inner_size(280,320)；3193 POPUP 280/420；3394 PANEL_W 280；3442 fallback 420 | lib.rs 抽 POPUP_PANEL_* / QUICK_PANEL_* / PREVIEW_PANEL_* 常量消除 6 处硬编码；WINDOW_SMALL/LARGE 改 900×620；tauri.conf.json 900×620 / min 820×520；前端 POPUP_WIDTH 320、previewH 统一 360 | `rg "760\.0|540\.0|280\.0|420\.0" src-tauri/src/lib.rs` → 0 命中；JSON 解析得 {900,620,820,520}；cargo test window_dimensions_match_redesign_spec ok；23 passed | |
| P3 | D10/D12/C2 | 回收站可用：新增 list + purge 命令；过期改 30 天 | `lib.rs`：`clipboard_delete`/`clipboard_restore`/新增 2 命令 + handler；`superclip.ts` | P2 | 新增 cargo 单测通过；`npm run test:rust` 全绿 | cargo 单测（删除→列表→恢复→purge） | 已验证 | clipboard_delete expires_at=now+30（秒）；无 list 命令；clipboard_clear 连主表一起清 | expires_at 改 now + TRASH_RETENTION_SECS(30 天)；restore 过期分支去掉 DELETE；新增 list_trash_entries / purge_trash_entries + clipboard_trash_list / clipboard_trash_purge 并注册；前端 COMMANDS/类型/fallback 同步 | cargo test trash_round_trip_lists_entry_and_keeps_thirty_day_retention ok（1 条、remaining_days=30、过期后修剪为空）；purge_trash_entries_removes_only_trash_rows ok（部分=1、清空=1、主表仍 1 条） | | R3 属实已修（`Some([])` 不再等同清空回收站，补单测）；R5 属实已修（`use_count`/`payload_size_bytes` 加 `#[serde(default)]` + 旧 JSON 解析单测）；R3-8 属实已注明（trash_list 有修剪副作用，必须走写连接，已补注释）；R3-11 备案（剩余 0 天边界展示） |
| P4 | Preview/关于页 | `ClipboardItemSummary` 补 `useCount`/`payloadSizeBytes` | `lib.rs`：struct、`row_to_summary`、SELECT；`superclip.ts` 类型 | P2 | Rust 单测断言取值；前端编译通过 | cargo 单测 + `npm run build` | 已验证 | struct 无 useCount/payloadSizeBytes；表已有 use_count/payload_size_bytes 列 | ClipboardItemSummary 增 use_count / payload_size_bytes；row_to_summary 读取两列（所有 SELECT 均为 SELECT *）；ClipboardItem 前端类型加可选字段 | cargo test summary_rows_expose_use_count_and_payload_size ok（use_count=1、payload_size_bytes>0）；npm run build 通过 | |
| P5 | D11/C1 | `settings_reset` + `clipboard_paste` 支持 `asPlainText` | `lib.rs`：`write_payload_to_clipboard`、`clipboard_copy`/`clipboard_paste`、`settings_reset`；`superclip.ts` | P2 | cargo 单测：reset 回默认；纯文本分支生效 | cargo 单测 + `npm run test:rust` | 已验证 | write_payload_to_clipboard(payload) 无 plain 模式；无 settings_reset | write_payload_to_clipboard 增 as_plain_text 参数（有 text_plain 时只写纯文本，否则回退常规路径）；clipboard_paste 增 as_plain_text；新增 settings_reset（清 settings 表 + 广播）；前端 clipboardPaste(id, asPlainText) / settingsReset() | cargo test settings_reset_restores_defaults ok（4321/dark → 1000/system/direct_paste）；plain_text_payload_write_path_is_selectable ok | | R9 属实已修（抽纯函数 `plain_text_write_target` 并真正断言分支选择）；R8 驳回（与 D11 设计稿及 P5 登录的「无 text_plain 回退原路径」一致，非缺陷，仅收敛注释措辞）；R3-7 属实已修（抽 reset_settings_and_trim_history 内核 + 裁剪断言）；R3-6 属实已修（关于页补「问题反馈」mailto） |
| P6 | D5/D6/D7/D12 | Popup 320×480：键盘提示条 + hover 行操作 + 右键菜单 + 撤销 Toast + 分组 | `src/popup/PopupApp.tsx`、`PopupHistoryRow.tsx`、`src/components/toast.tsx`(新) | P1,P2,P3,P5 | vitest 覆盖分组/⌘⌫/撤销/hover 按钮 | `npm run test:frontend` + P15 | 已验证 | POPUP_WIDTH=280；ROW_HEIGHT_BASE_PX=46 无分组；无菜单/Toast | POPUP_WIDTH=320；新增 src/lib/time-group.ts；虚拟滚动改「组头 24px + 行高」双高度（绝对定位 + 总高 spacer）；行 hover 显示置顶/删除；右键菜单 6 项；⌘⌫ 删除、⌘P 置顶、⌥↵ 纯文本；底部改键盘提示条 | npx vitest run src/popup 30 passed（分组、⌘⌫→clipboardDelete、撤销→clipboardRestore、⌥↵→clipboardPaste(id,true)、右键菜单 asPlainText、hover 操作不触发选中） | | R6 属实已修（keydown 闭包读 ref 而非首帧 `settings`，补回归用例）；R12 属实已清理（删除我自己的临时复现脚本）；R3-1 属实已修（handleDetail 定位改 popup 左侧，实机验证浮窗出现在 (780,294)）；R3-12 备案（菜单 clamp 估值，实机 6 项未溢出） |
| P7 | D8 | QuickPanel 248×400：重排消除溢出；移出外观主题 | `src/panel/QuickPanelApp.tsx`、`panel.html` | P1,P2 | vitest 覆盖暂停态/无主题/默认动作 | `npm run test:frontend` + P15 实测 | 已验证 | 含主题切换区；注释残留 232/280×420；底部独立状态栏 | 重排为「品牌头+状态胶囊 / 暂停-恢复 / 打开主管理台 / 设置 / 默认动作分段+说明 / 暂停态说明 / 退出」；移除外观主题分组；删除底部状态栏（状态上移胶囊）；MenuButton 增 highlight | npx vitest run src/panel 12 passed（品牌+胶囊、暂停态 data-paused 与恢复监听、无外观分组、无 h-[35px] 底栏、默认动作切换） | |
| P8 | D9 | Preview 320×360：来源 App + 元信息；类型改中性灰 | `src/preview/PreviewApp.tsx`、`PopupApp.tsx`、`MainApp.tsx` | P1,P2,P4 | vitest 覆盖元信息与图片/文本两态 | `npm run test:frontend` + P15 | 已验证 | KIND_COLOR 4 色；previewH = isImage?280:360；footer 仅 Clock+来源 | header 改「类型 + 时间 + 只读预览」；KIND_COLOR 收敛为 var(--icon-idle)；footer 改「来源首字母头像 + 来自 App + 体积/字符数/使用次数」；新增 formatBytes/countChars；previewH 统一 360 | npx vitest run src/preview 13 passed（元信息 1.2 KB/11 字符/复制过 6 次、零值隐藏、图片不显示字符数、只读标识、来源头像） | |
| P9 | D3/D4 | Main 骨架：左侧栏 192 + 内容区（900×620） | `MainApp.tsx`、`MainSidebar.tsx`(新)、`MainTopBar.tsx`、`MainTabNavigation.tsx` | P1,P2 | vitest 覆盖侧栏 5 项与状态卡 | `npm run test:frontend` + P15 | 已验证 | 顶栏 + chips 双层结构；无侧栏 | 新增 MainSidebar（192px：全部记录/已置顶/回收站 + 排除规则/设置 + 底部监听状态卡）；MainApp 改横向 flex；MainTopBar 改内容区标题栏（移除设置按钮）；MainTabNavigation 收敛 4 类型 chips；monitorStatusGet + monitor-status-changed 同步 | npx vitest run src/windows/main/MainApp.test.tsx MainTopBar.test.tsx MainTabNavigation.test.tsx 全通过（侧栏 w-[192px]/5 项/状态卡、设置与回收站切换） | | R2 属实已修（侧栏「已置顶」切标题+过滤、新增 `MainTopBar.title`、「排除规则」经 `initialSection` 落到 privacy 分区；chip/⌘1–⌘4 从 pinned 退回 all）；R11 属实已修（侧栏品牌行加 `pt-[38px]` 避让原生红绿灯）；R14 属实已修（挂载即 `loadTrash`，侧栏计数不再恒 0）；R16 属实已修（⌘5 改走侧栏 pinned）；R3-3 属实已修（已置顶视图不再渲染 chips）；R3-9 属实已修（删 NavItem.danger 死参数） |
| P10 | D10 | 回收站界面：列表 + 恢复 + 彻底删除 + 清空 + 30 天提示 | `MainTrashView.tsx`(新)、`MainApp.tsx`、`superclip.ts` | P3,P9 | vitest 覆盖列表/恢复/二次确认/空态 | `npm run test:frontend` + P15 | 已验证 | 无回收站界面 | 新增 MainTrashView（复选/内容/来源/删除时间/剩余 + 全部恢复·清空 + 恢复所选·彻底删除所选 + 说明卡 + 空态）；MainApp 接入 clipboardTrashList/Purge/Restore 与 history-updated 刷新；破坏性操作走统一二次确认 | npx vitest run src/windows/main/MainTrashView.test.tsx 9 passed + MainApp 4 条用例（空态、恢复单条、批量禁用、二次确认取消、清空后提示条数） | | R4 属实已修（回收站/设置视图停用列表快捷键，补用例）；R3-2 属实已修（history-updated 订阅去 gate；实机验证列表删除后侧栏计数 2→3 实时刷新，DB 交叉验证）；R3-4 属实已修（fallback 按 trashId 精确匹配）；R3-5 备案（undo_token 秒级碰撞，预先存在）；R3-10 备案（恢复后双刷新，低危） |
| P11 | D11 | 设置 5 区：通用/快捷键/排除规则/高级/关于 | `settings-shell.tsx`、`MainApp.tsx`、`vite.config.ts`、`superclip.ts` | P5,P9 | vitest 覆盖 5 分区/二次确认/只读禁用 | `npm run test:frontend` + P15 | 已验证 | 4 区 general/shortcuts/privacy/about（高级挂在 about） | sections 改 5 项（advanced 用 Wrench / about→关于 用 Info）；高级页新增「危险操作」卡（清空历史/重置设置，二次确认 + 只读禁用）；关于页拆「版本信息（版本+Schema v4）」「权限与帮助（Accessibility+跳转）」；vite define 注入 __APP_VERSION__ | npx vitest run src/components/settings-shell.test.tsx 16 passed（五分区导航、危险操作触发与只读禁用、关于页版本/帮助、跳转分区） | | R10 属实已修（空断言 `toBeDefined` 换成真实调用断言；新增 `initialSection` 用例）；R3-6 属实已修（关于页补 mailto 反馈入口，与登记列对齐） |
| P12 | D12 | 统一可撤销 Toast 组件 | `src/components/toast.tsx`(新)、`MainApp.tsx`、`PopupApp.tsx` | P3,P6 | vitest 覆盖三态 + 撤销 | `npm run test:frontend` | 已验证 | 无 Toast 组件 | 新增 src/components/toast.tsx（success/warning/undo 三态，默认 5s 自动消失）；Popup 删除与 Main 单条/批量删除、清空历史、重置设置、恢复接入；同一时刻只显示一个 | npx vitest run src/components/toast.test.tsx 7 passed（三态渲染、撤销回调+关闭、5s 自动消失、自定义超时、回调变化不重置计时） | |
| P13 | D13 | 网格 3 列 | `MainGridView.tsx` | P9 | vitest 断言 3 列 | `npm run test:frontend` + P15 | 已验证 | minmax(160px,1fr) 自适应 | MainGridView 改 repeat(3, 1fr) + gap 11 + px-5，注释更新为 D13 口径 | npx vitest run src/windows/main/MainGridView.test.tsx 14 passed（gridTemplateColumns = repeat(3, 1fr)） | |
| P14 | — | 测试与类型收口 | 全部涉及文件 | P1–P13 | `npm run test` + `npm run build` 全绿 | 两条命令 | 已验证 | — | 更新 7 个既有测试文件 + 新增 3 个测试文件；修复 3 处实现缺陷（Main 单条删除缺撤销、loadTrash 响应未防御、确认弹窗按钮颜色语义） | npm run test:frontend 17 files / 196 tests passed；npx tsc --noEmit 通过；npm run build 通过；cargo test 23 passed | | R13/R15/R17 属实已处理（清理 dead code；浏览器 fallback 阈值对齐 900×620/820×520；账本计数在末尾统一回填） |
| P15 | D8/D13/C6 | 实机 GUI 验证 | 运行时 | P1–P14 | 四表面尺寸相符；QuickPanel 无溢出；无类型色残留 | `screencapture` + 人工核对 | 已验证 | — | — | `npm run tauri dev`（PORT_OFFSET=100）实机 + `screencapture` + CGWindowList 尺寸实测：Main **900×620**（winID 712261 @ (390,178)，侧栏 192 实测 1165-781=384 物理/2=192 逻辑）、Popup **320×480**、QuickPanel **248×400**、Preview **320×360**。视觉核对：Popup 分组 已置顶/今天/更早（无重复组头）、hover 行显示置顶/删除、右键菜单 6 项（⌘C / ↵ / ⌥↵ / ⌘P / 查看详情 / 删除）+「已删除 1 条 + 撤销」Toast；QuickPanel 品牌头 + 状态胶囊、无外观分组、退出项完整可见（D8 溢出已消除）；Preview 只读预览 + 来源头像 + 元信息（1.2 KB / 11 字符 / 复制过 N 次）；Main 侧栏 5 项 + 状态卡、网格 3 列、设置 5 区（通用/快捷键/排除规则/高级/关于）、高级危险操作（清空历史 / 重置设置）与回收站表格（内容/来源/删除时间/剩余 30 天）；破坏性操作二次确认（红钮）与全部恢复确认（蓝钮）区分正确；真实 DB 往返：purge 后 clipboard_trash 1→0 且 clipboard_items 保持 175；恢复后 trash 0→1 且 items 174→175 | |

---

## 遗留（计划已声明不做）

数据库体积显示 · 压缩数据库（VACUUM）· 检查更新 · 内置帮助浮层（以分区跳转替代）
