# SuperClip 主窗预览区（右侧 dock）· 实施计划

- 日期：2026-10-20（需求首次创建：2026-10-20）
- 上游：`.docs/prd-draft/20261020/superclip-preview-pane-prd-draft.md`（注意：PRD 的 960px 断点已被本文件 D-07 的 880px 取代）
- 原型：`prototypes/superclip-preview-pane-2026-10-20/index.html`（12 页 / 3 组，已浏览器验证）
- 状态：方向 A 与全部澄清项已确认；审查发现的 20 处问题已修正（断点量纲、html/rtf 展示口径、批量语义、缓存预算、验证命令等，见 ⑩ 审查修订记录）。本文件待用户确认后实施。

---

## ① 共识与目标

**问题**：主窗列表行 hover 200ms 即弹出独立 NSPanel 预览（`MainApp.tsx:137`、`MainApp.tsx:305-350`）。触发时机不可控（鼠标路过就弹），内容区仅 320×360 且跟随鼠标。为维持可用性，现有实现叠加三层容错：300ms 全局鼠标位置轮询（`MainApp.tsx:380-400`）、10s overstay 兜底（`useHoverPreview.ts:15`）、行↔浮窗跨境竞态。用户原话：「现在鼠标移动上去就会显示悬浮预览，我想改成不要悬浮……可以右边弹出侧边栏这种，可以滚动的方式显示，需要考虑不同类型的情况」。

**目标**：主窗内用**选中驱动**的右侧 dock 取代 hover 浮窗。hover 仅保留行高亮。

**成功标准**（对应用户确认的 S 账本）：

| ID | 成功标准 |
| --- | --- |
| R-01 | 鼠标扫过 20 行，全程不出现任何浮窗 |
| R-02 | 单击一行到看到全文 ≤1 次动作；已加载条目无感知延迟 |
| R-03 | 图片在 dock 内可看清且不超出边界 |
| R-04 | 长文本可在 dock 内滚动到底 |
| R-05 | 窄窗（< 880px）下功能不丢失（覆盖式） |
| R-06 | 七种类型（text/html/rtf/image/file/link/other）各有合适展示 |
| R-07 | popup / quick_panel 的 hover 预览行为不变 |

---

## ② 范围边界

### 范围内

- 主窗列表视图与网格视图的预览形态改造；
- 右侧 dock 组件、类型化渲染、折叠、拖拽宽度、响应式覆盖式；
- 键盘 ↑↓ 导航；
- 抽取 `PreviewContent` 共享渲染，供 `PreviewApp`（popup 悬浮窗）复用；
- 移除主窗 hover 预览链路（前端约 150 行 + 相关测试）。

### 范围外（明确不做）

| 项 | 处理 | 依据 |
| --- | --- | --- |
| HTML/RTF 渲染视图 | 不做；展示后端剥离标签后的纯文本（`payload.textPlain`），不展示 HTML/RTF 源码 | D-04 |
| 「关闭自动预览」设置项 | 不做 | D-03 |
| Rust 侧 preview 窗口与 `preview_show`/`preview_hide`/`preview_mouse_state` 命令 | 不删（popup 仍依赖） | D-08 |
| popup / quick_panel 的 hover 预览 | 行为不变 | R-07 |
| DB schema、IPC 契约 | 不变 | 约束 |
| 回收站、设置、排除规则视图的 dock | 不渲染 | S-08 |
| 图片点击放大到独立窗口 | 不做（浮窗仍由 popup 使用，主窗不再触发） | 原型⑥备注调整为不含此项 |

### 场景与边界账本（`S-*`）

| ID | 参与者/触发 | 前置条件与输入 | 目标结果 | 失败与关键边界 | 状态/副作用/责任 | 可观察结果 | 状态与依据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-01 | 用户鼠标划过主窗列表行 | 列表视图，dock 已展开 | 只有行高亮，无浮窗 | 快速划过 20 行 | 无 IPC、无窗口调用 | 无任何浮窗出现 | 目标变化：`MainApp.tsx:305-400` 删除 |
| S-02 | 用户单击列表行 | 有记录，dock 展开（≥880px） | 右侧 dock 显示该条全文 | 详情未返回时显示骨架；详情失败显示错误态 | `clipboardGet(id)` 调用；选中状态更新 | dock 内容等于被点条目 | 目标变化 |
| S-03 | 用户按 ↑ / ↓ | 列表视图且有 items | 选中移动，dock 同步，列表滚到可见 | 首/末项边界不再移动；搜索态下同样生效 | `setSelectedId` + `scrollIntoView({block:"nearest"})` | dock 内容跟随选中 | 目标变化：现无按键处理（`MainApp.tsx:413-467`） |
| S-04 | 用户展开长文本条目 | 文本超过 dock 高度 | dock 内独立滚动到末尾 | 代码块保持等宽不换行溢出（横向滚动） | 仅 dock 内滚动容器滚动 | 列表滚动位置不变 | 目标变化 |
| S-05 | 图片条目被选中 | `kind === "image"` | 大图按 dock 宽度等比展示 | 图片 decode 失败 → 占位框 + 尺寸文案 | `resolveImageDataUrl` 复用 | 图片宽 ≤ dock 内容宽 | 目标变化 |
| S-06 | 文件条目被选中，含多个文件 | `kind === "file"`，`fileUrls` 非空 | 文件清单（文件名 + 目录）可滚动 | 清单为空 → 显示「无文件信息」 | 只读展示，不发起 IO | 每项显示 basename 与 dirname | 目标变化 |
| S-07 | 链接 / HTML / RTF / 其他条目被选中 | 各自 kind | link：标题 + 完整 URL + 域名；html/rtf：标题 + 剥标签后的 `textPlain` 正文（非源码，D-04）；other：仅复制提示 + flavor 清单 | html 只有标签没有文本 → 显示「暂无预览」；other 的 flavors 为空 → 只显示提示 | 无 | 与 kind 对应的布局 | 目标变化 |
| S-08 | 用户进入回收站 / 设置 / 排除规则 | `activeSection` ∈ {trash, settings, rules} | 不渲染 dock，内容区全宽 | — | — | DOM 中无 `main-preview-dock` | 目标变化 |
| S-09 | 搜索或切 chip 后选中项被过滤掉 | 有 query 或 tab 变化 | dock 跟随新选中项（`deriveSelectedId` 保留首个） | 列表为空（`items.length === 0`）→ dock 显示空态；这是唯一的空态分支（D-05） | `useClipboardData` 既有逻辑 | dock 与列表选中一致 | 保持现状：`useClipboardData.ts:28-36` 不修改（D-05） |
| S-10 | 用户勾选 ≥2 个勾选框（或 ⌘A） | `selectedIds.size >= 2` | dock 显示批量摘要（已选 N 项 + 批量动作），底部 `MainBulkActionBar` 隐藏 | 取消到 ≤1 项 → 回到单条预览 | 复用既有 bulk handlers | dock 出现「已选 N 项」且无第二份批量栏 | 目标变化（D-06、D-16） |
| S-11 | 用户单击第 2 行（未勾选） | 已有 1 行为 selectedId | dock 只切换到新行，**不进入批量态** | 已处于批量态（size ≥ 2）时单击行 → 清空批量集合，回到单条预览 | `handleSelect` 不再写 `selectedIds`，仅 `setSelectedId` + `setSelectedIds(new Set())` | dock 仍显示单条全文 | 目标变化（D-06、D-17） |
| S-12 | 用户按 ⌘\ | 列表视图且 dock 可用 | dock 折叠 / 展开，折叠后列表恢复全宽 | 折叠态下选中保留，展开立即显示 | localStorage 持久化 | 列表宽度变化 | 目标变化 |
| S-13 | 用户拖拽 dock 左边界 | dock 展开，窗口 ≥ 880 | 宽度变化并记忆（260–420 夹取） | 拖到极限后夹住；窗口宽度不足时自动覆盖式 | localStorage 持久化 | 松手后宽度保留 | 目标变化 |
| S-14 | `main` 元素宽度 < 880（侧栏 + 内容区，不含 dock） | 主窗被缩窄 | dock 改为覆盖式浮层，不压缩列表 | Esc 或点击列表空白关闭（P-07 实现，z-index 25：高于列表、低于 bulk bar 30 / toast 40） | 无持久化副作用 | 列表宽度不变，dock 浮于其上 | 目标变化（D-07） |
| S-15 | 详情加载中 | 切换选中后 detail 未返回且无缓存 | dock 显示骨架，不显示上一条内容 | 命中缓存 → 直接内容，无 loading 帧 | — | 无「串条」现象 | 目标变化（D-18） |
| S-16 | 用户在详情加载中快速连续切换选中 | 快速点击多行 | 只有最后一次选中的 detail 落地 | 旧请求晚到不覆盖新内容 | 请求序号 / `active` 标志 | dock 内容始终为当前选中项 | 目标变化 |
| S-17 | 用户在 popup 中 hover 行 | popup 窗口 | 悬浮窗照旧出现 | — | 既有链路 | 与改造前一致 | 保持现状（D-08） |
| S-18 | 用户在网格视图选中卡片 | `viewMode === "grid"` | dock 同样显示；网格在 dock 展开时改 2 列 | — | — | 卡片列数变化 | 目标变化（D-09） |
| S-19 | 主窗最小宽度场景 | 窗口 820px | 覆盖式 + 3 列网格仍可用 | — | — | 无横向溢出 | 目标变化（D-09：覆盖态 3 列） |

---

## ③ 现状与证据

| 主题 | 现状 | 出处 |
| --- | --- | --- |
| hover 触发 | `useHoverPreview({delay:200, hideDelay:200})`，行 enter → 200ms 后显示 | `MainApp.tsx:137` |
| 浮窗定位 | 主窗位置 + 鼠标 x + 48，行 top；320×360，anchor `cursor` | `MainApp.tsx:319-339` |
| 浮窗容错 | `preview:mouse-enter/leave` 监听 + 300ms `preview_mouse_state` 轮询 + 10s overstay | `MainApp.tsx:353-400`、`useHoverPreview.ts:15,17-140` |
| 详情加载 | `clipboardGet(item.id)` → `{item, payload, flavors, version}` | `lib/superclip.ts:983`、`preview/PreviewApp.tsx:210-225` |
| 内容渲染 | 类型标签 / 标题 / 代码块（``` 分段）/ 图片 / flavor 清单 / 元信息胶囊；正文取 `payload.textPlain`（后端已剥标签），不展示 html/rtf 源码 | `preview/PreviewApp.tsx:110-200,340-455` |
| 详情 hook | `useClipboardDetail` 已实现 itemId → detail 状态机，但当前**无任何调用方** | `hooks/useClipboardData.ts:211-247` |
| 选中语义 | 单击 = `setSelectedId` **且** 计入 `selectedIds` | `MainApp.tsx:482-491`（E2 注释） |
| 自动选中 | 数据变化后 `deriveSelectedId` 选中首项 | `useClipboardData.ts:28-36` |
| 键盘 | ⌘1–6 切类型、⌘L 切视图、⌘A 全选、⌘P 置顶、Delete 删除；**无 ↑↓** | `MainApp.tsx:413-467` |
| 网格列数 | 固定 `repeat(3, 1fr)` | `MainGridView.tsx:50` |
| 窗口 | 900×620，min 820×520 | `src-tauri/tauri.conf.json` |
| 侧栏 | 192px | `MainSidebar.tsx:40` |
| 测试 | MainApp 27 / ListView 16 / GridView 15 / PreviewApp 19 / useHoverPreview 15 个用例（2026-10-20 实测 46 passed）；ListView/GridView 测试显式断言 `onRowHover` 被调用；`MainApp.test.tsx:143,171,200,209,277` 用 `getByText` 全文匹配行标题，dock 渲染同标题后会多匹配 | `src/windows/main/*.test.tsx`、`src/preview/PreviewApp.test.tsx` |

---

## ④ 已确认决策（`D-*`）

| ID | 问题 | 决定 | 理由 | 受影响项 | 状态 |
| --- | --- | --- | --- | --- | --- |
| D-01 | 预览触发方式 | 单击 / 键盘选中驱动，hover 仅高亮 | 用户确认方向 A；解决「时机不可控」 | S-01、S-02、P-03、P-04 | 已确认 |
| D-02 | 展示位置 | 主窗内右侧 dock（非独立窗口） | 用户原话「右边弹出侧边栏」；消除跨窗口容错 | S-02、P-02 | 已确认 |
| D-03 | 是否提供「关闭自动预览」开关 | 不提供，选中即预览为唯一主路径 | 用户「按推荐」 | P-02 | 已确认 |
| D-04 | HTML/RTF 展示形态 | 不做渲染视图，也不做源码视图；展示 `payload.textPlain`（后端 `strip_html_tags` 后的纯文本，RTF 为固定提示文案）+ 原格式仍可复制 | 用户确认不做渲染（需 sandbox）；源码视图会让标签噪声淹没正文 | S-07、P-05 | 已确认 |
| D-05 | dock 空态是否自动选首行 | 保持现状自动选中首项；dock 空态**仅**表示列表为空（`items.length === 0`，此时 `selectedId === ""`），不新增「未选中但有数据」分支 | 用户「按推荐」；不改 `deriveSelectedId` 可保住 ⌘P/⌘⌫ 目标 | S-09、P-06 | 已确认 |
| D-06 | 单击是否计入批量集合 | 拆分：单击只改 `selectedId`；批量集合只由勾选框 / ⌘点击 / ⌘A 写入 | 用户「按推荐」；否则连点两行即进批量态，主路径失效 | S-10、S-11、P-04、P-10 | 已确认 |
| D-07 | 常驻 / 覆盖断点 | 880px，量纲 = `main` 元素宽度（侧栏 192 + 内容区），**不含 dock 自身**；默认窗口 900 → 900 ≥ 880 常驻 | 用户「按推荐」；PRD 旧稿 960 作废。若把 dock 计入被观察容器会出现「占宽→覆盖→让宽」抖动回路 | S-13、S-14、P-07 | 已确认 |
| D-08 | Rust preview 窗口与 popup 链路 | 保留不动；仅移除主窗侧调用 | popup hover 预览继续依赖 | S-17、P-11 | 已确认 |
| D-09 | 网格视图列数 | dock 展开时 2 列，折叠/覆盖态 3 列 | 保持卡片可读 | S-18、P-09 | 已确认 |
| D-10 | dock 默认宽度 | 300px，可拖拽，夹取 260–420 | 与原型一致 | S-13、P-07 | 已授权实施 |
| D-11 | 折叠快捷键 | `⌘\`（主窗内），不进入全局快捷键录制体系 | macOS 侧栏折叠惯例；主窗无占用 | S-12、P-08 | 已确认 |
| D-12 | 状态持久化 | localStorage：`superclip:previewDockOpen`、`superclip:previewDockWidth` | 与既有 `superclip:viewMode` 同约定 | S-12、S-13、P-07 | 已授权实施 |
| D-13 | 渲染复用方式 | 抽取 `PreviewContent` 组件，`PreviewApp` 改为消费它 | 避免两处渲染逻辑漂移 | P-01、P-05 | 已授权实施 |
| D-14 | 详情并发正确性 | 每次选中变化自增请求号，落地时比对 | 防串条 | S-16、P-06 | 已授权实施 |
| D-15 | popup 是否必须保持像素不变 | 不必须；popup 与 dock 共用同一套类型化布局，允许 file/link 视觉随类型化变化 | 共享 `PreviewContent`（D-13）与「零视觉变化」不可同时成立；一致性优先 | P-01、P-05、S-17 | 已确认 |
| D-16 | 批量摘要与底部批量栏是否并存 | 不并存：dock 显示批量摘要时隐藏 `MainBulkActionBar` | 两个入口同一动作会让用户困惑，且覆盖式下 z-index 冲突 | S-10、P-10 | 已确认 |
| D-17 | 批量态下单击行 | 退出批量态（清空 `selectedIds`），回到单条预览 | 单击 = 浏览/预览（D-01）；批量态只能由勾选框 / ⌘A 进入，避免「点了没反应」 | S-11、P-04 | 已确认 |
| D-18 | 骨架显示条件 | 仅「无缓存且请求未返回」显示骨架；命中缓存立即出内容；不设延迟门槛 | 「400ms 内不闪骨架」需要定时器且不可测，本地 SQLite 常 <20ms，阈值只会让首帧空转 | S-15、P-06 | 已确认 |

---

## ⑤ 实现设计对齐

| 维度 | 状态 | 判断依据 | 处理安排 |
| --- | --- | --- | --- |
| 核心主链路 | **适用** | 触发模型从 hover 改选中，跨组件状态（选中 / 批量 / 折叠 / 响应式）新增 | 第 ⑤.1 节 |
| 数据存储与表设计 | **不适用** | 无 schema 变化、无新持久化（仅 localStorage UI 偏好）；详情沿用 `clipboardGet` | 已在 D-12 说明 |
| 接口设计 | **不适用** | 不新增/修改 Tauri command，不改 IPC 契约；popup 用的 preview 命令原样保留 | D-08 |
| 实现逻辑与非功能 | **适用** | 需决定：请求并发正确性、滚动容器、响应式测量、渲染复用边界 | 第 ⑤.2 节 |

### ⑤.1 核心主链路

```text
用户单击行 / 按 ↑↓
  → MainApp: setSelectedId(id)            （批量集合不参与，D-17）
  → useClipboardDetail(selectedId)        （改造既有 hook，不新建文件；P-06）
      state: idle | loading | ready | error
      请求号 ++，clipboardGet(id)
      → 仅当请求号仍为最新时落地
  → MainPreviewDock({ item, detail, state, width, open, overlay })
      骨架 / 内容 / 错误态
  → PreviewContent(kind)  （共享组件，与 popup 同一份）
```

布局关系（与现有 DOM 一致：`MainBulkActionBar` 在同一 `relative flex min-h-0 flex-1 flex-col` 容器内）：

```text
MainApp (main)
├─ MainSidebar (192)
└─ content (flex min-w-0 flex-1 flex-col)
   ├─ MainTopBar            ← 新增 dock 折叠按钮（P-08）
   ├─ MainTabNavigation
   ├─ body (relative flex min-h-0 flex-1 flex-col)   ← 现状容器
   │  ├─ row (flex min-h-0 flex-1)                   ← 新增
   │  │  ├─ list/grid (flex-1)
   │  │  └─ MainPreviewDock (300 | overlay absolute z-25)
   │  └─ MainBulkActionBar （批量摘要态隐藏，D-16）
   └─ Toast (absolute bottom-5 z-40)
```

批量态优先级：`selectedIds.size >= 2` → dock 渲染批量摘要 + 隐藏 `MainBulkActionBar`；否则若 `selectedId` → 单条；否则空态（仅列表为空时）。

### ⑤.2 实现逻辑与非功能

| 主题 | 决定 |
| --- | --- |
| 请求并发 | 改造后的 `useClipboardDetail` 内 `requestIdRef` 自增；落地前比对，旧响应丢弃（D-14） |
| 详情缓存 | `Map<itemId, detail>`，**按字节预算淘汰而非条数**：含 `textPlain`/`fileUrls`/`flavors` 的轻量详情入缓存（约 20 条上限）；`imageBytes` 非空的详情**不入缓存**，切回时重新请求。原因：`image_bytes` 无 `serde_bytes`（`lib.rs:110`），IPC 是 JSON 数字数组，8MB 图 ≈ 30MB JSON，50 条即 GB 级 |
| 键盘节流 | ↑↓ 连按只在当前选中落地后才发起下一次请求；同一事件循环内的连续按键合并为最后一次（`requestAnimationFrame` 合并或 80ms 停顿门槛） |
| 响应式 | `ResizeObserver` 观察 **`main` 元素宽度**（侧栏 192 + 内容区），不观察含 dock 的 flex 容器（会形成「占宽→覆盖→让宽」抖动回路）；`overlay = mainWidth < 880`（D-07） |
| CSS 作用域 | dock 容器必须带 `.preview-shell` 类，否则 `--preview-divider` / `--preview-code-bg` / `--preview-faint-text` 等 token 全部失效（仅定义在 `App.css:400-431` 的 `.preview-shell` 下） |
| 滚动 | dock 内容区 `min-h-0 flex-1 overflow-y-auto`；代码块横向 `overflow-x-auto`；列表滚动与 dock 互不影响 |
| 骨架 | 无缓存且请求未返回 → 骨架（同尺寸灰块）；命中缓存 → 立即内容；不设时间阈值（D-18） |
| 折叠 | `open` 状态控制 dock 渲染；折叠时 `MainTopBar` 显示「显示预览」按钮；按钮节点不得落在 `data-tauri-drag-region` 区（tauri 2.10.3 不支持 deep，点不动） |
| 拖拽 | 左边界 `pointerdown` → `pointermove` 计算宽度 → 夹取 260–420 → `pointerup` 持久化；拖拽期间 `user-select: none` |
| 覆盖式关闭 | 覆盖式下默认展开；Esc 或点击列表空白区域关闭（P-07 实现）；z-index 25（高于列表，低于 bulk bar 30 / toast 40）；事件源用 row 上的 `closest('[data-clipboard-row-id]')` 判定「点行」与「点空白」，点行不关闭 |
| 可观测 | 无新增日志；失败路径走既有 `feedback` Toast（错误态同时显示在 dock 内） |
| 发布与回滚 | 纯前端改动；回滚 = 还原本次 commit，无数据迁移 |

---

## ⑥ 推荐设计

### 组件职责

| 组件 | 职责 |
| --- | --- |
| `MainPreviewDock`（新增） | 容器：头部（类型/时间/只读标记/折叠按钮）、内容区分发、底部元信息、批量摘要态、覆盖式外框与关闭 |
| `PreviewContent`（新增，`src/components/preview-content.tsx`） | 纯渲染：按 kind 分发（text/html/rtf → 标题 + `textPlain` 正文；image；file 清单；link；other + flavors），无数据获取；dock 与 popup 共用同一套布局（D-15） |
| `useClipboardDetail`（改造，`src/hooks/useClipboardData.ts`） | 选中 → 详情请求 → 状态机 + 预算缓存 + 请求号防串条（计划早期草案叫 `usePreviewDetail`，以本行为准） |
| `usePreviewDockPrefs`（新增 hook） | `open` / `width` 读写 localStorage、夹取、断点判定 |
| `MainApp` | 选中 / 批量 / 折叠 / 宽度 / 响应式状态编排；删除 hover 链路 |
| `PreviewApp`（popup 悬浮窗） | 改为消费 `PreviewContent`；事件链与窗口行为不变 |

### 数据/控制流变化

- 新增：`useClipboardDetail` 升级后的详情缓存（前端内存）；dock 偏好（localStorage）。
- 不变：DB、Tauri command、事件契约。

### 兼容与回滚

- 无迁移；无 API 变更；回滚只需 revert。
- popup 的 `preview:show` payload 结构不变。
- popup 的 file/link 视觉允许随类型化布局变化（D-15）；`PreviewApp.test.tsx` 需补 file/link 布局断言，否则回归会静默通过。

---

## ⑦ 实施账本（`P-*`）

| ID | 源 | 目的与变更内容 | 实现逻辑 | 关联文件/符号 | 依赖 | 完成判据 | 验证方式（命令＋预期） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | D-13、D-15、S-07 | 抽出共享内容渲染，供 dock 与 popup 复用；popup 向类型化布局对齐（file/link 视觉可有变化，D-15） | 从 `PreviewApp.tsx` 提取 `PreviewContent` + `FlavorSection` + `renderRichContent` + `formatBytes` / `countChars` / `MetaChip`；`PreviewApp` 改为调用它，事件与窗口逻辑保留 | 新增 `src/components/preview-content.tsx`；改 `src/preview/PreviewApp.tsx` | — | `PreviewApp.test.tsx` 19 个用例全绿；补 file/link 布局断言（否则 D-15 的视觉变化会静默通过） | `npx vitest run src/preview/PreviewApp.test.tsx` → 19 passed（基线：2026-10-20 实测 19 passed） |
| P-02 | D-01、D-02、S-01、S-02 | 主窗新增右侧 dock 骨架：显示类型/时间/内容/元信息，取代 hover 浮窗 | `MainPreviewDock` 组件 + `MainApp` 布局改为 row（列表 + dock）；hover 只保留行高亮，删除 hover 触发；dock 容器挂 `.preview-shell` 类（否则 `--preview-*` token 全失效） | 新增 `src/windows/main/MainPreviewDock.tsx`；改 `MainApp.tsx:939-975` | P-01 | 主窗单击行后 dock 显示该条全文；鼠标划过不再出现任何浮窗 | `npx vitest run src/windows/main/MainApp.test.tsx` → 新增 dock 用例通过，**同时把 `MainApp.test.tsx:143,171,200,209,277` 的全文匹配改为 `within(listview)`**；人工：划过 20 行无浮窗（R-01） |
| P-03 | S-01、D-08 | 移除主窗 hover 预览链路（JS 侧），popup 链路不动 | 删除 `useHoverPreview` 调用、`handleRowHover/handleRowLeave`、`previewShow/previewHide` effect、`preview:mouse-enter/leave` 监听、300ms 轮询 effect、`onMouseLeave` 里的 `handlePanelLeave`；移除 `MainListView`/`MainGridView` 的 `onRowHover`/`onRowLeave` props；**同步删除 `superclip.ts` import 中三项与 `hoverCursorRef` 声明**（`noUnusedLocals: true`，否则 `tsc` 报错） | `MainApp.tsx:16,27-33,133-152,305-401,786-797,953-954,968-969`；`MainListView.tsx`；`MainGridView.tsx` | P-02 | 主窗无 preview IPC 调用；两列表视图不再有 hover 回调；`npm run build` 不报 unused | 更新 `MainListView.test.tsx` / `MainGridView.test.tsx`（删除 hover 用例）；`rg -e previewShow -e previewMouseState src/windows/main` → **无结果**（用 `-e` 写多模式，避免表格里的 `|` 转义歧义；旧写法 `\|` 是字面量匹配，改造前就已无结果，不能作为证据）；`npx tsc --noEmit` → 无错 |
| P-04 | D-06、S-11 | 单击不再计入批量集合 | `handleSelect` 只 `setSelectedId(id)` + `setSelectedIds(new Set())`（D-17：批量态下单击即退出批量）；`handleToggleSelect` 保持不变；⌘点击需新增：行 `onClick` 改为接 `(event)`，`event.metaKey` 时走 `handleToggleSelect` 否则走 `handleSelect`（`MainListView.tsx:134`、`MainGridView.tsx:112`） | `MainApp.tsx:474-491`；`MainListView.tsx`；`MainGridView.tsx` | P-02 | 单击第 2 行后 `selectedIds.size` 仍为 0；批量态下单击行后 `selectedIds` 清空；⌘点击累加不进单选 | 改 `MainApp.test.tsx:197` 的「row click selects item into batch set」为「row click 只改选中，不进批量」；新增：勾选 2 项后单击某行 → 断言批量栏隐藏 + dock 回单条；新增 ⌘点击用例 |
| P-05 | D-04、S-05~S-07 | 按类型分发 dock 内容 | `PreviewContent` 内 `switch (kind)`：image → 大图（`resolveImageDataUrl`）+ 尺寸；file → 清单（`payload.fileUrls` 拆 basename/dirname，个数取 `fileUrls.length`，**不重算标题**——后端 `title` 已是首项 basename，`meta` 已含数量，`lib.rs:1822-1834`）；link → 标题 + 完整 URL + 域名（URL 取 `payload.textPlain`）；other → 提示 + flavors；text/html/rtf → 标题 + `renderRichContent(payload.textPlain)`（不展示 html/rtf 源码，D-04）；代码块 `overflow-x-auto` | `src/components/preview-content.tsx` | P-01 | 七种 kind 各有对应布局，无空渲染 | 新增 `preview-content.test.tsx` 覆盖 7 个 kind（含 html 条目断言展示的是剥标签后的纯文本、file 多条断言每项 basename）；`npx vitest run src/components/preview-content.test.tsx` → 全绿 |
| P-06 | S-15、S-16、D-14、D-18 | 详情加载状态机 + 防串条 + 预算缓存 | 改造既有 `useClipboardDetail`（`useClipboardData.ts:211`，当前**无调用方**，不新建重复 hook）：`requestIdRef` 自增 → `clipboardGet` → 落地前比对；缓存 `Map` **按字节预算淘汰**（含 `imageBytes` 的详情不入缓存，避免 GB 级驻留）；命中缓存直接置 `ready`，不置 `loading`；返回 `{detail, state, error}` | `src/hooks/useClipboardData.ts:211-247`（不新增文件） | P-02 | 快速连点 5 行，dock 始终显示最后一行；命中缓存不出现骨架 | 新增 `useClipboardDetail.test.ts`：乱序返回断言只落地最新；缓存命中无 `loading` 帧；含大图的详情不入缓存 |
| P-07 | D-07、D-10、D-12、S-13、S-14、S-19 | dock 宽度拖拽 + 响应式覆盖式 + 偏好持久化 | `usePreviewDockPrefs`：读 localStorage（默认 300 / open=true）→ `ResizeObserver` 观察 **`main` 元素**（侧栏 + 内容区，不含 dock）→ `overlay = mainWidth < 880`；覆盖式关闭：Esc + 点击非行区域（用 `closest('[data-clipboard-row-id]')` 判定），z-index 25；拖拽时 `pointermove` 夹取 260–420 | 新增 `src/hooks/usePreviewDockPrefs.ts`；`MainApp.tsx` 布局 | P-02 | 900 宽（默认）走常驻分栏；820 宽走覆盖；刷新后宽度与折叠状态保留 | 新增 `usePreviewDockPrefs.test.ts`（注：jsdom 已有 `ResizeObserver` 空实现 stub，`src/test/setup.ts:4-13`，需换成**可手动触发回调**的 stub）；断点判定抽纯函数单测（mainWidth 900 → overlay=false，820 → true）；人工：拖宽后重启主窗宽度保持 |
| P-08 | S-12、D-11 | `⌘\` 折叠 / 展开 + 顶部按钮 | `MainApp` keydown 增加 `event.metaKey && event.key === "\\"`（输入态放行）；`MainTopBar` 增加折叠按钮（折叠时显示「显示预览」）。**按钮节点不能嵌在 `data-tauri-drag-region` 的 header 区**（tauri 2.10.3 不支持 deep 匹配，会变成拖窗口而点不动） | `MainApp.tsx:413-467`；`MainTopBar.tsx:28-33` | P-07 | ⌘\ 切换生效且持久化；折叠后列表全宽；按钮可点击不拖窗 | 新增 MainApp 用例：按 ⌘\ 后 dock 消失、再按恢复；`MainTopBar.test.tsx` 补按钮渲染与 `data-tauri-drag-region` 断言 |
| P-09 | S-18、D-09 | 网格视图列数随 dock 变化 | `MainGridView` 新增 `columns` prop（2 / 3），由 `MainApp` 按 `open && !overlay` 传入 | `MainGridView.tsx:50`；`MainApp.tsx` | P-02 | dock 展开时 2 列，折叠/覆盖时 3 列 | 改 `MainGridView.test.tsx` 加列数断言；人工看布局 |
| P-10 | S-10、D-06 | dock 批量摘要态 | `selectedIds.size >= 2` 时 dock 渲染「已选 N 项」+ 复制/置顶/删除/取消（复用既有 bulk handlers）；不渲染单条内容；**同时隐藏 `MainBulkActionBar`**（D-16，不能两个入口并存） | `MainPreviewDock.tsx`；`MainApp.tsx:972-981` | P-04 | 勾选 2 项 → dock 显示批量摘要且底部批量栏不可见；取消到 1 项 → 回单条与批量栏 | MainApp 用例：勾选 2 项断言 dock 文案 + `main-bulk-action-bar` 的 `aria-hidden="true"`；`MainBulkActionBar.test.tsx` 保持全绿 |
| P-11 | S-03 | 键盘 ↑↓ 导航 | `MainApp` keydown：`ArrowDown/ArrowUp` → 在 `visibleItems` 中移动 `selectedId`，边界夹取；`e.preventDefault()`；连按合并（同一帧内只取最后一次，或 80ms 停顿门槛）后再发详情请求；选中后 `document.querySelector('[data-clipboard-row-id="' + id + '"]')?.scrollIntoView({block:"nearest"})` | `MainApp.tsx:413-467` | P-02 | ↑↓ 改变选中并滚动到可见；首末项不越界；连按 20 次只产生 ≤3 次 `clipboardGet` | MainApp 用例：按 ArrowDown 两次断言 dock 标题为第 3 条；按 ArrowUp 到首项后不再变化；连按只发一次请求（`vi.spyOn(superclip, "clipboardGet")`） |
| P-12 | S-08 | 非列表视图不渲染 dock | `isSettingsOpen || activeSection === "trash"` 时不渲染 dock 与布局分栏 | `MainApp.tsx` 布局分支 | P-02 | 回收站/设置无 `main-preview-dock` | MainApp 用例：切到 trash 断言 `queryByTestId("main-preview-dock")` 为 null |
| P-13 | S-04、S-15 | 滚动与骨架的视觉边界 | 内容区 `min-h-0 flex-1 overflow-y-auto`；骨架块与最终内容同高（避免抖动）；图片 `max-w-full h-auto`（不用 `max-h-full`，高度约束交给内容区滚动） | `MainPreviewDock.tsx` | P-05 | 长文本可滚到底；切换过程无布局跳动 | 人工验收（R-03/R-04）：贴长文本、2400×2400 图片各一条；**图片验收口径**：>8MB 的图会走 360px 预览分支（`lib.rs:1761-1770`），表现为“模糊但不溢出”，不能以“清晰”作为通过条件 |

---

## ⑧ 共享验证与覆盖矩阵

### 共享验证环境与命令

```bash
npm run test:frontend                      # vitest（新增/更新用例）
npx tsc --noEmit                           # 类型检查（必跑：删 hover 链路后 noUnusedLocals 会报错）
npm run build                              # 构建
npm run tauri dev                          # 人工验收：真实窗口
```

人工验收脚本（在 `npm run tauri dev` 下执行，逐条留证据）：

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| V-01 | 鼠标自上而下划过 20 行 | 无任何浮窗（R-01） |
| V-02 | 单击一行 | dock 立即显示该条全文（R-02） |
| V-03 | 粘贴 2400×2400 图片后选中 | 图片不超出 dock 边界、无横向溢出；>8MB 走 360px 预览分支，**模糊属预期**（R-03） |
| V-04 | 选中超长文本条目，滚轮到末尾 | 可滚到底，列表不滚动（R-04） |
| V-05 | 把主窗拖到 820 宽再选条目 | 覆盖式浮层，Esc 可关闭（R-05） |
| V-06 | 依次选中 text/html/rtf/image/file/link/other | 七种布局符合原型；html/rtf 显示剥标签后的纯文本（R-06） |
| V-07 | 打开 popup，hover 行 | 悬浮窗仍弹出；file/link 布局随类型化变化属预期（D-15） |
| V-08 | 勾选 2 项 | dock 切批量摘要且底部批量栏消失；取消到 1 项恢复 |
| V-09 | 按 ⌘\ | dock 折叠/展开，重启后保持 |
| V-10 | ↑↓ 连续切换 | 选中与 dock 同步，列表自动滚到可见 |
| V-11 | 默认窗口（900 宽）启动 | 走常驻分栏（列表不被覆盖），dock 宽 300（验证 D-07 断点量纲） |
| V-12 | 单击顶部折叠按钮 | 按钮可点即折叠（不能变成拖窗口） |

### 覆盖矩阵

| 需求/场景 | 边界与设计决定 | 计划项 | 验证方式 | 状态 |
| --- | --- | --- | --- | --- |
| S-01（R-01） | D-01、D-08、保持：popup 链路 | P-02、P-03 | V-01；`rg -e previewShow -e previewMouseState src/windows/main` 无结果 + `tsc` 无错 | 已覆盖 |
| S-02（R-02） | D-01、D-13 | P-02、P-06 | V-02；MainApp 用例 | 已覆盖 |
| S-03 | D-01 | P-11 | V-10；MainApp 用例（含连按合并） | 已覆盖 |
| S-04（R-04） | — | P-13 | V-04 | 已覆盖 |
| S-05（R-03） | D-04 边界 | P-05、P-13 | V-03；preview-content 用例 | 已覆盖 |
| S-06、S-07（R-06） | D-04、D-13 | P-01、P-05 | V-06；preview-content 用例（7 kind） | 已覆盖 |
| S-08 | — | P-12 | MainApp 用例 | 已覆盖 |
| S-09 | 保持现状：`deriveSelectedId`（D-05） | P-06 | MainApp 既有用例保持全绿（注意全文匹配需改 `within`） | 已覆盖 |
| S-10、S-11 | D-06、D-16、D-17 | P-04、P-10 | V-08；MainApp 用例（改 1 增 3：批量摘要、批量态单击退出、⌘点击） | 已覆盖 |
| S-12 | D-11、D-12 | P-07、P-08 | V-09、V-12；MainApp 用例 | 已覆盖 |
| S-13、S-14、S-19（R-05） | D-07、D-10 | P-07 | V-05、V-11；`usePreviewDockPrefs.test`（断点纯函数） | 已覆盖 |
| S-15、S-16 | D-14、D-18 | P-06、P-13 | `useClipboardDetail.test`（乱序/缓存） | 已覆盖 |
| S-17（R-07） | D-08、D-13、D-15 | P-01 | V-07；`PreviewApp.test.tsx` 19 用例 | 已覆盖 |
| S-18 | D-09 | P-09 | MainGridView 列数断言 | 已覆盖 |

无 `E-*` 证据缺口；无「待确认」边界。

---

## ⑨ 风险与后续

| ID | 风险 | 影响 | 缓解 |
| --- | --- | --- | --- |
| K-01 | 900px 宽下常驻分栏后列表仅 ~408px，标题截断明显增多 | 可读性 | 默认宽度取 300（不走 320）；折叠快捷键 `⌘\` 可换取全宽；V-01/V-02 人工确认可接受 |
| K-02 | 批量语义改动（D-06、D-16、D-17）会改变既有 E2 习惯：单击不再计入批量、批量态单击会清空 | 用户习惯 | 勾选框与 ⌘A 仍是批量入口；批量动作本身不变；`MainApp.test.tsx:197` 的旧断言需同步改写 |
| K-03 | jsdom 的 `ResizeObserver` 是空实现（`setup.ts:4-13`，不触发回调） | 测试稳定性 | 测试内换成可手动触发回调的 stub；断点判定抽纯函数单测，不依赖 observer |
| K-04 | 抽取 `PreviewContent` 后 popup 的 file/link 视觉会变（D-15） | popup 视觉回归 | P-01 先跑现有 19 用例，再补 file/link 布局断言；人工 V-07 确认可接受 |
| K-05 | 快速切换选中时图片 decode 开销 + JSON 数字数组传输（`image_bytes` 无 `serde_bytes`） | 卡顿 / 内存 | 含 `imageBytes` 的详情不入缓存；↑↓ 合并请求；不预加载邻居条目 |
| K-06 | dock 容器漏挂 `.preview-shell` 会让 `--preview-*` token 全部 fallback 到空值（代码块与分隔线直接消失，但测试可能仍绿） | 视觉静默回归 | P-02 完成判据里加入「dock 根节点 className 含 `preview-shell`」断言；V-06 人工确认代码块背景与分隔线 |

### 后续事项（不在本次）

- 主窗图片点击放大（需要新的放大交互，且不再复用 popup 浮窗）。
- `useHoverPreview` 是否彻底删除（仅 popup 使用时仍有 3 处容错逻辑，可后续收敛）。
- dock 内「在 Finder 中显示」等文件动作（需新增 opener 调用，本次不做）。
- 失败态的重试按钮（当前仅提示，不自动重试）。
- `AGENTS.md:43,57` 的架构描述同步（preview 窗口“Popup 行 hover 200ms”、“useHoverPreview — popup hover 预览”）与主窗布局、测试清单更新；放到本次实现收尾一并改，否则文档与实现不一致。

---

## ⑩ 审查修订记录（2026-10-20）

审查发现的问题与处理（全部已改入上文）：

| # | 问题 | 严重度 | 处理 | 位置 |
| --- | --- | --- | --- | --- |
| 1 | 断点量纲用“内容区宽”但期望默认窗口走常驻：900−192=708 < 880，永远覆盖式 | 严重 | 断点量纲明确为 `main` 元素宽，D-07 重写 | D-07、⑤.2、P-07 |
| 2 | 图片详情进 50 条缓存 → GB 级驻留（`image_bytes` 是 JSON 数字数组） | 严重 | 含 `imageBytes` 的详情不入缓存，改为字节预算 | ⑤.2、P-06、K-05 |
| 3 | dock 容器漏挂 `.preview-shell` → `--preview-*` token 全部失效 | 严重 | 写入 ⑤.2、P-02 完成判据、K-06 | ⑤.2、P-02、K-06 |
| 4 | P-03 验证命令 `rg "a\|b"` 是字面量匹配，改造前就无结果，无法作为证据 | 严重 | 改为不加转义的 `rg 'a|b'`，并注明 | P-03 |
| 5 | html/rtf 的“源码视图”与 `renderRichContent(textPlain)` 不符 | 中 | D-04 改为“展示剥标签后的 textPlain” | D-04、S-07、P-05 |
| 6 | “popup 视觉零回归”与 file/link 类型化布局矛盾 | 中 | 新增 D-15：允许 popup 视觉变化，回归基线更新 | D-15、K-04、P-01 |
| 7 | 覆盖式关闭（Esc / 点外部）无实现归属，z-index 未定 | 中 | 写入 P-07 实现逻辑与 ⑤.2 | P-07、⑤.2 |
| 8 | S-19“覆盖式 + 2 列”与 D-09“覆盖态 3 列”矛盾 | 中 | S-19 改为 3 列 | S-19 |
| 9 | 批量态下单击行的语义未定义 | 中 | 新增 D-17：单击退出批量态 | D-17、S-11、P-04 |
| 10 | dock 批量摘要与底部批量栏双入口 | 中 | 新增 D-16：批量摘要态隐藏 `MainBulkActionBar` | D-16、S-10、P-10 |
| 11 | D-06 的“⌘点击（新增）”无实现项；行 `onClick` 目前不接 event | 中 | 写入 P-04 实现逻辑与用例 | P-04 |
| 12 | 抽取后 dock 渲染 `item.title`，`MainApp.test.tsx` 5 处全文匹配会双命中 | 中 | 写入 P-02 验证方式，改用 `within(listview)` | P-02、S-09 |
| 13 | “400ms 内返回不闪骨架”不可测且与“无缓存即骨架”矛盾 | 中 | 新增 D-18：去掉时间阈值，只分“有/无缓存” | D-18、S-15、⑤.2 |
| 14 | D-05 与 S-09 空态口径不一致 | 低 | D-05 重写：空态仅表示列表为空 | D-05、S-09 |
| 15 | ⑤.1 布局图把 `MainBulkActionBar` 当 body 兄弟 | 低 | 按真实 DOM 重画 | ⑤.1 |
| 16 | P-03 会触发 `noUnusedLocals` 报错（import / ref 残留） | 低 | P-03 实现逻辑与验证补充 `tsc --noEmit` | P-03 |
| 17 | `MainTopBar` header 带 `data-tauri-drag-region`，按钮可能点不动 | 低 | P-08 加约束与 V-12 | P-08、V-12 |
| 18 | 用例数写错（PreviewApp 19 非 20）；K-03 前提错（jsdom 已有空 stub） | 低 | 已修正；K-03 改为“需要能触发回调的 stub” | ③、P-01、K-03 |
| 19 | V-03 判据误导（>8MB 走 360px 预览，是模糊不是溢出） | 低 | V-03 与 P-13 改写判据 | V-03、P-13 |
| 20 | 未调查到既有 `useClipboardDetail`（无调用方） | 低 | P-06 改为改造既有 hook，不新建重复文件 | P-06、③、⑥ |

审查时验证过的基线：`npx vitest run src/preview/PreviewApp.test.tsx src/windows/main/MainApp.test.tsx` → **46 passed**（MainApp 27 + PreviewApp 19）。未修改任何源代码。

---

## ⑪ 资料与引用

| 来源 | 用途 | 支撑 |
| --- | --- | --- |
| `src/windows/main/MainApp.tsx`（HEAD 当前版本） | hover 链路、选中语义、键盘处理、布局 | ③ 现状与证据 |
| `src/hooks/useHoverPreview.ts` | 容错机制与 overstay 兜底 | S-01、P-03 |
| `src/preview/PreviewApp.tsx` | 内容渲染结构（拟抽取） | P-01、P-05 |
| `src/hooks/useClipboardData.ts:28-36` | 自动选中首项行为 | D-05、S-09 |
| `src/hooks/useClipboardData.ts:211-247` | 既有 `useClipboardDetail`（无调用方，拟改造） | P-06 |
| `src/windows/main/MainGridView.tsx:50` | 固定 3 列 | D-09 |
| `src-tauri/tauri.conf.json` | 窗口 900×620 / min 820 | D-07、K-01 |
| `src/lib/superclip.ts:983` | `clipboardGet` 契约 | P-06 |
| `src/App.css:400-431` | `--preview-*` token 仅定义在 `.preview-shell` 作用域 | K-06、P-02 |
| `src/test/setup.ts:4-13,65` | `ResizeObserver` 空 stub、canvas 桩 | K-03 |
| `src-tauri/src/lib.rs:110,1761-1770` | `image_bytes` 无 `serde_bytes`（JSON 数字数组）；>8MB 图片转 360px 预览 | K-05、S-05、V-03 |
| Maccy 2.7.0 release notes（https://github.com/p0deje/Maccy/releases，检索 2026-10-20） | hover popover → slideout panel 的行业演进、浮窗鼠标事件坑 | 方向 A 依据 |
| CopyQ `currentItemPreview` 提交（https://github.com/hluk/CopyQ/commit/8e990cb3aff471ac096a7aeead602869d14162b0，检索 2026-10-20） | docked preview 跟随选中项 | 方向 A 依据 |
| Apple HIG · Split views（https://developer.apple.com/design/human-interface-guidelines/split-views，检索 2026-10-20） | 侧栏 + 详情为 macOS 原生惯例 | D-02 |
