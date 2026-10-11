# SuperClip 全表面重设计 · 实施账本

日期：2026-10-11 ｜ 授权：用户全权委托决策（"我看结果即可"）

## 0. 冲突声明

| 冲突 | 解决 |
|---|---|
| 用户要「配色改进」，`feature-easy-prototype` 铁律禁止改配色（黑白灰线框） | 产出 2 份：**A 线框流程原型**（结构/交互/可点击演示） + **B 彩色高保真设计稿**（真实配色排版） |

## 1. 目标

统一 Popup / Main / QuickPanel / Preview / Settings 五个表面的布局、配色、交互，对齐业界成熟产品（Paste / Raycast / Maccy / Just Copy）。

## 2. 决策表（已定，不再征询）

| # | 项 | 现状 | 决定 | 依据 |
|---|---|---|---|---|
| D1 | 强调色 | 蓝 #38bdf8 + 4 个类型色 + 琥珀 | 单一强调色 `#0A84FF`；类型色 4→0（改中性灰）；置顶留琥珀 `#FF9F0A` | Raycast / Maccy 共同点：一种强调色才显高级 |
| D2 | 类型区分 | 4 种彩色图标 | 类型图标改**中性灰**，图片/文件改用真实缩略图 | Just Copy：画成它本来的样子 |
| D3 | Main 窗口 | 760×540 | **900×620** | 现有顶栏+chips+批量栏三层挤压；侧栏才装得下回收站 |
| D4 | Main 结构 | 顶栏 + chips + 列表 | **左侧栏 192px（历史/回收站/设置）** + 内容区 | 回收站无 UI，chips 与导航混在一起 |
| D5 | Popup | 280×420 | **320×480** | 280 宽放不下 图标+标题+预览+时间+操作 |
| D6 | Popup 底栏 | "共 N 条 / 悬停预览"（零信息量） | 改**键盘提示条**（↑↓ ↵ ⌘↵ ⌘⌫）+ 计数 | Maccy/Raycast 键盘优先 |
| D7 | Popup 行操作 | 无（只能键盘） | hover 显示 置顶/删除 图标 | 鼠标用户当前无法删除单条 |
| D8 | QuickPanel | 280×420，**底部状态条被裁** | **248×400**，内容按高度重排 | 实测截图：420 高下底部状态条溢出 3–8px（真实 bug） |
| D9 | Preview | 280×320，仅类型+时间 | **320×360**，加来源 App + 元信息层级（大小/字节/尺寸） | 现信息价值低 |
| D10 | 回收站 | 后端 `clipboard_trash/restore/clear` 已实现，前端 0 引用 | **新增回收站 UI**（列表 + 恢复 + 彻底删除 + 清空 + 30 天过期提示） | 后端能力闲置 |
| D11 | 设置分区 | 通用/快捷键/排除规则/高级 | 拆成 **5 区**：通用 / 快捷键 / 排除规则 / 高级 / 关于 | 关于页塞在"高级"里，语义不清 |
| D12 | 撤消失效 | 删除无撤销入口 | 删除后 **Toast 可撤销**（undo_token 后端已具备） | 后端 `clipboard_restore(undo_token)` 已实现 |
| D13 | 网格列数 | 760 宽下 4 列（~160px 挤） | 900 宽下 **3 列**（~250px） | 截图实测过挤 |

## 3. 页面清单（18 页，4 组）

| 组 | 页 | id |
|---|---|---|
| 取用与预览 | Popup 默认态 | popup-default |
| | Popup 搜索态（含高亮 / 无结果空态） | popup-search |
| | Popup 行操作（hover 操作 + 右键菜单） | popup-actions |
| | Preview 文本（含代码块） | preview-text |
| | Preview 图片 / 文件 | preview-image |
| 主管理台 | Main 历史列表 | main-history |
| | Main 网格视图 | main-grid |
| | Main 多选批量 | main-selection |
| | Main 回收站 ★新增 | main-trash |
| | Main 空态与状态横幅 | main-empty |
| 设置 | 通用 | settings-general |
| | 快捷键 | settings-shortcuts |
| | 排除规则 | settings-rules |
| | 高级 | settings-advanced |
| | 关于 | settings-about |
| 菜单栏与反馈 | QuickPanel 默认态 | panel-default |
| | QuickPanel 暂停态 | panel-paused |
| | 操作反馈 Toast（复制 / 粘贴降级 / 删除可撤销） | toast-feedback |

## 4. 帧尺寸（线框原型用）

| 表面 | 尺寸 | 说明 |
|---|---|---|
| Main | 900×620 | 含侧栏 192 |
| Popup | 320×480 | 行高 46，一屏 8 条 |
| QuickPanel | 248×400 | 内容按高度重排，不溢出 |
| Preview | 320×360 | |

## 5. 产出物

| # | 路径 | 内容 | 状态 |
|---|---|---|---|
| A | `prototypes/superclip-redesign-2026-10-11/index.html` | 线框流程原型（18 页 / 4 组 / 可点击演示） | ✅ 已生成 + 自检通过 |
| A' | 同目录 `flow.html` | 页面片段源（可重跑） | ✅ |
| B | 同目录 `design-mockup.html`（源：`.docs/redesign-mockup.html`） | 彩色高保真设计稿（深/浅双主题） | ✅ 已生成 |

产出源文件：`.docs/flow.html`（线框片段源）、`.docs/redesign-mockup.html`（彩色稿源）。

## 6. 验收结果

| 检查项 | 结果 |
|---|---|
| `new_prototype.py` 生成 + `verify.py` 自检 | ✅ 0 错误 |
| 18 页 / 4 组全部渲染，尺寸符合账本 | ✅ 实测：Popup 320×480、Preview 320×360、QuickPanel 248×400、Main 900×620 |
| 适应屏幕后整图进一屏 | ✅ 各组均进一屏 |
| 分组切换条生效，跨组连线挂文字标签 | ✅ |
| 演示模式可点通主链（点①→搜索态） | ✅ 实测截图确认 |
| 彩色稿无溢出 | ✅ 溢出检查 0 条 |
| 彩色稿深浅双主题可切换 | ✅ |

## 7. 不做（超范围）

- 不改 Rust 后端逻辑与前端实现代码（本阶段只出原型；实现需另立账本并再次确认）
- 线框原型沿用 skill 铁律的黑白灰配色（配色方案在彩色稿中表达）

## 8. 待用户决策

实现阶段前需确认：
1. 是否接受 D1–D13 全部决策（尤其 D3/D5/D8 尺寸变更，需同步改 `tauri.conf.json` 与 `lib.rs` 的常量）。
2. 实现顺序（建议：配色 token 先行 → Popup → QuickPanel → Preview → Main+回收站 → 设置）。

