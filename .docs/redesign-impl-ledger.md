# SuperClip 全表面重设计 · 实施账本

来源计划：`.docs/redesign-ledger.md`（D1–D13）｜设计基准：`.docs/redesign-mockup.html`、`.docs/flow.html`
日期：2026-10-11 ｜ 状态：**待用户确认后开工**

---

## 表头区

### 目标与验收标准

1. 五个表面（Popup / Main / QuickPanel / Preview / Settings）落地设计稿的布局、配色、交互。
2. 消除 D8 记录的 QuickPanel 底部溢出 bug（实测 3–8px）。
3. 新增回收站 UI（D10），删除可获得撤销与恢复通道。
4. 配色收敛为单一强调色 `#0A84FF`，类型色 4 → 0。

**整体验收**：`npm run test`（前端 + Rust）全绿 + `npm run build` 通过 + `npm run tauri dev` 实机截图逐表面核对尺寸与溢出。

### 范围 / 非目标 / 约束

- **范围内**：前端 5 表面重做；Rust 侧尺寸常量、5 项后端能力补缺；`tauri.conf.json` 尺寸。
- **非目标**：不改监控/搜索/去重算法；不做云同步、AI、检查更新。
- **兼容/回滚**：数据库无 schema 迁移（回收站沿用既有 `clipboard_trash` 表结构，仅改 `expires_at` 语义）；回滚 = `git checkout` 本次提交前的 HEAD（工作区当前干净，HEAD=`1dc6aad`）。

### 测试与验证要求

| 命令 | 用途 |
|---|---|
| `npm run test:frontend` | vitest（15 文件 / 159 用例，基线全绿） |
| `npm run test:rust` | cargo test |
| `npm run build` | tsc 类型检查 + vite 生产构建 |
| `rg` 静态扫描 | 旧 token / 旧尺寸残留检查 |
| `npm run tauri dev` + `screencapture` | 尺寸、溢出、配色的唯一有效证据 |

**基线记录**：`npm run test:frontend` = 15 files / 159 tests passed，4 条 unhandled rejection（`transformCallback is not a function`，预先存在，非本次引入）。

### 已确认决策（用户 2026-10-11 拍板）

| # | 决策 |
|---|---|
| C1 | **授权改 Rust**：`clipboard_trash_list`、`clipboard_trash_purge`、`settings_reset`、`clipboard_paste` 加 `asPlainText`、`ClipboardItemSummary` 补 `useCount`+`payloadSizeBytes` |
| C2 | 回收站与撤销 **统一 30 天**：`expires_at = now + 30天`；`clipboard_restore` 过期时返回 `UNDO_EXPIRED` 但不删行；Toast 5 秒后消失、条目留在回收站 |
| C3 | Main 默认 **900×620**，`minWidth 820 / minHeight 520` |
| C4 | 缩略图策略：**列表行保持中性灰图标**；网格卡片与 Preview 用真实缩略图 |
| C5 | 配色：**只改 token 值，保留现有变量名**（`--accent` / `--type-*` 等），类型色 4 个改成中性灰值 |
| C6 | **授权 `npm run tauri dev` + 截图验证** |

### 调查纠正（与来源计划不符，已核实）

| 计划原文 | 实测 | 处理 |
|---|---|---|
| D10「后端 clipboard_trash 命令已实现」 | `clipboard_trash` 是表名；无"列出回收站"命令 | P3 新增 list 命令 |
| D10「30 天后自动清空」 | `expires_at = now + 30`（30 **秒**） | P3 改 30 天（C2） |
| 「全部恢复」按钮 | 无批量恢复命令 | 前端循环调用 `clipboardRestore` |
| 「重置所有设置」 | 无 `settings_reset` | P5 新增（C1） |
| 高级页「数据库体积 / 压缩数据库」 | 无对应命令，**不在 C1 授权清单内** | 列为遗留，不实现 |
| 关于页「检查更新」 | 无 updater 插件 | 列为遗留，不实现 |
| 「内置帮助浮层」 | 需新组件，超出设计稿已知面 | 改为跳转到设置对应分区，记偏差 |

### 已确认范围外、记为遗留

- 数据库体积显示、压缩数据库（VACUUM）
- 检查更新
- Population 内置帮助浮层（以分区跳转替代）

---

## 计划项

| ID | 来源 | 目的与变更内容 | 实现逻辑 | 关联文件/符号 | 依赖 | 完成判据 | 验证方式 | 状态 |
|---|---|---|---|---|---|---|---|---|
| **阶段 A · 基础设施** |
| P1 | D1/D2/D5 | 配色收敛：单一强调色 `#0A84FF`，类型色 4→0（中性灰），置顶留琥珀 | 改 `App.css` token 值（浅色 `--accent:#0066d6`、深色 `#0A84FF`；`--pinned:#FF9F0A`；新增 `--success`；`--type-*` 4 个 → `--icon-idle` 灰）；替换 8 个文件里 117 处 `rgba(56,189,248,…)` 与 39 处旧 hex | `src/App.css`、`settings-shell.tsx`、`QuickPanelApp.tsx`、`MainListView.tsx`、`MainGridView.tsx`、`MainTabNavigation.tsx`、`MainTopBar.tsx`、`kind-meta.ts`、`ui/switch.tsx` | — | `rg "#38bdf8|fb7185|60a5fa|a78bfa|rgba\(56, ?189, ?248" src/` 命中数为 0（测试文件除外）；`npm run test:frontend` 仍全绿 | `rg` 静态扫描 + `npm run test:frontend` | 待确认 |
| P2 | D3/D5/D8/D9 | 四表面尺寸落地 900×620 / 320×480 / 248×400 / 320×360 | `lib.rs` 抽公共常量消除 6 处重复硬编码（3108/3109/3186/3187/3394/3442/3654/3699/3743）；`WINDOW_SMALL/LARGE` 改 900×620；`tauri.conf.json` 改 `900/620`、`min 820/520` | `src-tauri/src/lib.rs`、`src-tauri/tauri.conf.json` | — | `rg "760\.0|540\.0|280\.0|420\.0|232\.0|380\.0|320\.0" src-tauri/src/lib.rs` 无尺寸残留；`npm run test:rust` 全绿；`node -e` 解析 tauri.conf.json 得 900/620/820/520 | `rg` + `npm run test:rust` + JSON 解析 + P15 截图 | 待确认 |
| **阶段 B · 后端能力** |
| P3 | D10/D12/C2 | 回收站可用：新增列表命令 + 永久删除命令 + 修正过期语义为 30 天 | 新增 `clipboard_trash_list`（反序列化 `item_json` → 条目 + `deletedLabel`/`remainingDays`；顺带清理已过期行）与 `clipboard_trash_purge(trashIds: Option<Vec<String>>)`（空=清空回收站，不动主表）；`clipboard_delete` 的 `expires_at` 改 `now + 30*86400`；`clipboard_restore` 过期分支去掉 `DELETE` | `lib.rs`：`clipboard_delete`/`clipboard_restore`/新增两个命令 + invoke_handler；`src/lib/superclip.ts` COMMANDS + 类型 + fallback | P2 | 新增 Rust 单测通过；`npm run test:rust` 全绿 | 新增 cargo 单测（删除→列表含 1 条且 `expiresAt` 约 30 天后→restore 成功→purge 后列表为空） | 待确认 |
| P4 | 设计稿 Preview/关于页 | `ClipboardItemSummary` 补 `useCount` / `payloadSizeBytes`，供 Preview 与关于页显示 | `row_to_summary` 增读两列；核对所有 `SELECT` 使用 `*` 或补列 | `lib.rs`：`ClipboardItemSummary`、`row_to_summary`、list/search 的 SELECT；`superclip.ts` 类型；`history-row.tsx` `ClipboardItem` | P2 | Rust 侧 `payloadSizeBytes`/`useCount` 有值（单测断言）；前端类型编译通过 | cargo 单测 + `npm run build` | 待确认 |
| P5 | D11/C1 | 危险操作与本地面板能力：`settings_reset` + `clipboard_paste` 支持 `asPlainText` | `settings_reset` 删 `settings` 表内容回默认并发 `settings-updated`；`write_payload_to_clipboard(payload, as_plain_text)` 纯文本模式只写 `text_plain`（无则回退原路径）；`clipboard_paste(id, asPlainText)` | `lib.rs`：`write_payload_to_clipboard`、`clipboard_copy`/`clipboard_paste`、`settings_reset` + handler；`superclip.ts` | P2 | cargo 单测：`settings_reset` 后 `load_settings` 回默认；`as_plain_text` 分支写纯文本 | cargo 单测 + `npm run test:rust` | 待确认 |
| **阶段 C · 表面改造** |
| P6 | D5/D6/D7/D12 | Popup 320×480：键盘提示条 + hover 行操作 + 右键菜单 + 撤销 Toast + 今天/昨天分组 | 宽度常量 280→320；新增 `今天/昨天/更早` 分组（虚拟滚动改「组头 24px + 行高」双高度偏移表）；底部改键盘提示条 + 计数；行 hover 时间位换 置顶/删除 按钮；右键菜单（复制 / 粘贴 / 粘贴为纯文本 / 置顶 / 查看详情 / 删除）；删除后 5 秒可撤销 Toast；新增 ⌘⌫ 删除、⌘⇧P 置顶 | `src/popup/PopupApp.tsx`、`PopupHistoryRow.tsx`、`src/components/toast.tsx`(新) | P1,P2,P3,P5 | vitest：分组渲染、⌘⌫ 触发删除、撤销按钮调用 `clipboardRestore`、hover 操作按钮存在 | `npm run test:frontend` + P15 截图 | 待确认 |
| P7 | D8 | QuickPanel 248×400：内容按高度重排，消除底部溢出；移出「外观主题」 | 头部加品牌 + 状态胶囊（监听中实心 / 已暂停描边）；操作组：暂停-恢复监听 / 打开主管理台 / 设置；默认动作分段 + 说明一行；退出独立底部；删除外观分组；整体高度对齐 400 不溢出 | `src/panel/QuickPanelApp.tsx`、`panel.html`（如需要） | P1,P2 | vitest：暂停态文案、移出外观后无主题按钮、默认动作切换 | `npm run test:frontend` + P15 截图实测无溢出 | 待确认 |
| P8 | D9 | Preview 320×360：加来源 App + 元信息层级；类型改中性灰；图片统一 360 高 | 头部 类型 + 时间 + 只读预览；底部 首字母头像 + 来自 App + 体积 + 字符数 + 使用次数；图片区显示 尺寸/格式/体积；`KIND_COLOR` 去掉类型色改中性灰；`PopupApp`/`MainApp` 传 `previewH = 360` 统一 | `src/preview/PreviewApp.tsx`、`PopupApp.tsx`、`MainApp.tsx` | P1,P2,P4 | vitest：元信息（体积/字符数/使用次数）渲染；图片与文本两态 | `npm run test:frontend` + P15 截图 | 待确认 |
| P9 | D3/D4 | Main 骨架：左侧栏 192 + 内容区（900×620） | `MainApp` 改横向布局：左栏 192（历史：全部记录/已置顶/回收站；管理：排除规则/设置；底部监听状态卡）+ 右列（拖拽条 + 标题副标题 + 搜索 + 视图切换 + 筛选 chips + 列表/网格 + 批量栏）；`MainTopBar` 拆成「内容区头部」，新增 `MainSidebar.tsx` | `src/windows/main/MainApp.tsx`、`MainSidebar.tsx`(新)、`MainTopBar.tsx`、`MainTabNavigation.tsx` | P1,P2 | vitest：侧栏 5 项渲染与切换、监听状态卡文案 | `npm run test:frontend` + P15 截图 | 待确认 |
| P10 | D10 | 回收站界面：列表 + 恢复 + 彻底删除 + 清空 + 30 天提示 | 新增 `MainTrashView.tsx`：表格（内容/来源/删除时间/剩余天数）+ 复选 + 顶部「全部恢复 / 清空回收站」+ 底部「恢复所选 / 彻底删除所选 / 已选计数」+ 说明卡；清空与彻底删除走二次确认 | `src/windows/main/MainTrashView.tsx`(新)、`MainApp.tsx`、`superclip.ts` | P3,P9 | vitest：列表渲染、恢复调用、清空走二次确认、空态 | `npm run test:frontend` + P15 截图 | 待确认 |
| P11 | D11 | 设置拆 5 区：通用 / 快捷键 / 排除规则 / 高级 / 关于 | `sections` 增 `rules`/`advanced` 键并重排；「关于」从高级拆出为独立区（版本 + 数据库 Schema + 权限 + 帮助跳转 + 反馈 mailto）；高级补「危险操作」卡（清空全部历史 / 重置所有设置，均二次确认，只读模式禁用）；`vite.config.ts` 注入 `__APP_VERSION__` | `src/components/settings-shell.tsx`、`src/windows/main/MainApp.tsx`、`vite.config.ts`、`superclip.ts` | P5,P9 | vitest：5 个分区导航项、危险操作二次确认文案、只读禁用 | `npm run test:frontend` + P15 截图 | 待确认 |
| P12 | D12 | 统一可撤销 Toast：删除走「已删除 + 撤销」 | 抽出 `src/components/toast.tsx`（success / warn / undo 三态，5 秒自动消失，同一时刻只显示一个）；Main 删除（单条 + 批量）与 Popup 删除接入；撤销调 `clipboardRestore(undoToken)` | `src/components/toast.tsx`(新)、`MainApp.tsx`、`PopupApp.tsx` | P3,P6 | vitest：Toast 三态渲染、撤销回调、5 秒后消失 | `npm run test:frontend` | 待确认 |
| P13 | D13 | 网格 3 列（900 宽） | `MainGridView` 由 `minmax(160px,1fr)` 改固定 `repeat(3, 1fr)`；卡片 250px 宽下标题 2 行 + 摘要 3 行；选中卡片描边加重 | `src/windows/main/MainGridView.tsx` | P9 | vitest：grid 容器列样式为 3 列 | `npm run test:frontend` + P15 截图 | 待确认 |
| **阶段 D · 验证** |
| P14 | — | 测试与类型收口 | 更新受影响的 vitest 用例、补新增组件用例；修 tsc 报错 | 全部涉及文件 | P1–P13 | `npm run test` + `npm run build` 全绿 | `npm run test`、`npm run build` | 待确认 |
| P15 | D8/D13/C6 | 实机 GUI 验证：尺寸、溢出、配色 | `npm run tauri dev`（`PORT_OFFSET=100` 避冲突）逐表面截图核对：Popup 320×480、QuickPanel 248×400 底部无溢出、Preview 320×360、Main 900×620 侧栏 192 与 3 列网格 | 运行时 | P1–P14 | 四表面尺寸实测相符；QuickPanel 底部状态条完整可见；无 4 色类型图标残留 | `screencapture` + 人工核对截图，结果记入账本 | 待确认 |

---

## 执行顺序与阶段门禁

```
阶段 A (P1,P2)  ← 基础设施先行
   ↓ 门禁：静态扫描 0 残留 + Rust 测试全绿
阶段 B (P3,P4,P5)  ← 后端能力
   ↓ 门禁：新增 cargo 单测全绿
阶段 C (P6,P7,P8,P9,P10,P11,P12,P13)  ← 表面改造（P6/P7/P8 互不依赖；P9→P10/P11/P13）
   ↓ 门禁：前端测试全绿
阶段 D (P14,P15)  ← 验证
```

## 已知风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| P1 触碰 8 文件 156 处硬编码色值 | 漏改导致配色不统一 | 阶段 A 门禁用 `rg` 做零残留断言 |
| P6 分组 + 虚拟滚动（双高度） | 滚动错位、选中行滚动定位失准 | 保留行高公式；组头高度单列常量；vitest 覆盖分组渲染 |
| P9 大范围重构 MainApp（702 行） | 现有 12 个 Main 相关用例回归 | 保留全部 props 签名，改布局不改数据流；P14 统一收口 |
| 回收站与撤销共用 `undo_token` | 撤销后同一 token 失效（`clipboard_restore` 删行） | 符合设计：撤销即恢复，回收站条目同步消失 |
| GUI 验证依赖本机环境 | 无法在 CI 复现 | 截图结论记入账本，标注为人工验证 |

## 遗留（明确不做）

数据库体积显示 · 压缩数据库（VACUUM） · 检查更新 · 内置帮助浮层（以分区跳转替代）

---

## 实现记录（2026-10-11 · feature-dev-verify 执行完毕）

### 状态

全部 15 项（P1–P15）完成并逐项验证；经 3 轮独立复查（subagent 全量审查），38 条发现全部处置闭环（属实修复 / 有据驳回 / 备案遗留）。

### 验证结果

| 项 | 命令 | 结果 |
|---|---|---|
| 前端 | `npx vitest run` | **17 files / 205 tests passed**（基线 15/159，净增 46 用例） |
| 后端 | `cargo test` | **28 passed**（基线 23 → 新增 5：窗口尺寸、trash/purge/restore 内核、serde 兼容、纯文本分支、settings_reset 内核） |
| 类型 | `npx tsc --noEmit` | 通过 |
| 构建 | `npm run build` | 通过（1.3s） |
| 静态门禁 | `rg` 旧色值/旧尺寸扫描 | 零残留 |
| 实机 | `npm run tauri dev` + CGWindowList + screencapture | 四表面尺寸精确匹配（900×620 / 320×480 / 248×400 / 320×360）、侧栏 192px、分组/hover/右键菜单/Toast/回收站往返（DB trash 1→0→1，items 175→174→175）/设置 5 区/恢复模式确认弹窗语义 |

### 主要偏差（均已确认或备案）

| 偏差 | 说明 |
|---|---|
| SQLite v4 文案 | 高级页原写「SQLite v3」→ 按实际 migration 版本修正为 v4 |
| 分组归属置顶 | 置顶项单独成「已置顶」组（原计划按时间分组会出现重复组头），Main/Popup 共用 `lib/time-group.ts` 口径 |
| Main 单条删除补撤销 | 原计划仅批删带撤销；实现统一走 Toast 撤销 |
| `--radius-*` 12/14/18 → 7/9/12 | 与 `.docs/redesign-mockup.html` 设计基准一致（配色语言整体），非无解释变更 |
| 帮助浮层 | 以「关于」页分区跳转替代（登记列内已注明） |
| `src/popup.tsx` 全局 contextmenu preventDefault | P6 自定义右键菜单的必要支撑（抑制 WKWebView 原生菜单） |
| 回收站表格 `table-fixed` | 长内容不再把「删除时间/剩余」挤出可视区 |

### 三轮复查留痕（要点）

- **第 1 轮（R1–R19）**：修 13、驳回 3（R8 纯文本回退=D11 设计、R18 半径=设计基准、R13 部分=既有 token）、备案 3。关键修复：侧栏死导航、purge 空数组误清空、Delete 误删、serde 兼容、`--warn` 未定义、Tailwind 任意值截断、红绿灯避让。
- **第 2 轮（R2-1～15）**：修 12、驳回 0、备案 3。关键修复：`SettingsShell key` 重挂载（互切失效）、虚拟滚动全量绝对偏移表（越窗不跟随，回归 HEAD 行为）、`--bg-window-solid` 浅色 Toast 黑底黑字、「查看详情」行为、恢复模式诊断可用。
- **第 3 轮（R3-1～12）**：修 7、驳回 0、备案 5。关键修复：查看详情定位（实机验证）、history-updated 订阅去 gate（实机验证计数实时刷新）、pinned 视图 chips 口径、settings_reset 裁剪内核、关于页 mailto。

### 遗留与风险（带入后续）

1. **P15 GUI 取证未入库**：截图在会话 `/tmp/sc-shots/`，未纳入仓库；结论已记入 verify-ledger。
2. **undo_token 秒级碰撞**（预先存在）：同一秒「删除→恢复→再删除」同一条目会 PK 冲突；建议后续加随机后缀。
3. **恢复路径双刷新**（低危）：`restoreTokens` 本地 enqueueRefresh + 后端 `history-updated` 事件各触发一次 `clipboard_search`。
4. **右键菜单 clamp 估值**：`menuWidth/menuHeight` 为估算值，极端字号下可能留边不足（实机 6 项未复现）。
5. **账本计数漂移已回填**：verify-ledger 的测试计数以本文为准（205/28）。
