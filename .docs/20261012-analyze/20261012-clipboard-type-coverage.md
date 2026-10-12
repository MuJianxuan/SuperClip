# SuperClip 剪贴板类型支持面分析

日期：2026-10-12
范围：仅分析（不改代码）。问题：新基座（clipboard-rs 0.3.5）支持的类型，是否比当前记录/展示的更多？当前支持是否完整？

## ① 结论（TL;DR）

1. **基座能力 > 当前接入面**。clipboard-rs 0.3.5 提供 5 个类型家族，外加**任意 flavor 逃生口**（列全部类型 / 读原始字节 / 写原始字节）。
2. **内容级已接入 5 个家族**：text / html / rtf / image / file。读取、存储、展示、粘贴四条链路都有路径。
3. **类型面不完整（UI）**：主页过滤 chips 只有「全部 / 文本 / 图片 / 文件」。html、rtf 条目已入库，但**不可筛选、不计数**。
4. **OS flavor 面完全没有接入**：颜色、URL、联系人、日历事件、RTFD、WebArchive、PDF、音视频、延迟 promise 等，读到不认识的内容时**静默丢弃**（无记录、无提示）。
5. 所以"是否完整"要分三问：内容能不能用（基本可以）｜类型是否显式（不完整）｜其他 flavor 是否记录（完全没有）。

## ② 四层能力对照

层级 | 覆盖 | 证据
--- | --- | ---
L1 macOS NSPasteboard flavors | 数十种 | `public.utf8-plain-text` / `public.html` / `public.rtf` / `public.png` / `public.tiff` / `public.file-url` / `public.url` / `public.vcard` / `com.apple.NSColorPboardType` / `com.apple.flat-rtfd` / `com.adobe.pdf` / `com.apple.webarchive` / `com.apple.ical.ics` …（举例，不穷举）
L2 clipboard-rs 0.3.5 | 5 家族 + 任意 flavor | `macos.rs:245` `available_formats()` 返回 pasteboard 全部 type；`macos.rs:297` `get_buffer(fmt)` 读任意 flavor 原始字节；`macos.rs:427` 读为 `ClipboardContent::Other`；`macos.rs:442` `set_buffer(fmt, bytes)`；`macos.rs:215` 写入 `Other`（与 Text/HTML/RTF/PNG 同一个 NSPasteboardItem）
L3 SuperClip 读取 + 存储 | 5 kind | `lib.rs:1538` `read_clipboard_snapshot`；kind 取值 text/html/rtf/image/file；`clipboard_items.kind TEXT NOT NULL` 无 CHECK 约束（`lib.rs:692`）
L4 UI 露出 | 5 kind 有图标/标签；chips 只有 3 | `src/windows/main/kind-meta.ts:10-14`（文本/HTML/RTF/图片/文件）；`src/windows/main/MainTabNavigation.tsx:14-16`（全部/文本/图片/文件）；计数 `src/windows/main/MainApp.tsx:142-158` 只统计 text/image/file

## ③ 现状行为细节

读取顺序固定（`lib.rs:1546-1577`）：

```
get_files ──▶ get_text(存为 plain) ──▶ get_html ──▶ get_rich_text ──▶ normalize_text ──▶ get_image ──▶ Ok(None)
   文件优先        先取纯文本备用          有则记为 html   有则记为 rtf      纯文本兜底        最后才是图片
```

由此产生的**优先序副作用**：

- 从「预览 / 照片」复制图片时，剪贴板常同时带 `public.file-url` → 会记为**文件**而不是**图片**。
- 同一 pasteboard 同时有文本与图片（部分 Office / 表格场景）→ 只存文本，图片表示丢失。
- 一次变更只落**一条**记录：不展开"一个 pasteboard 多条 item"。
- 多文件：`get_files` 遍历 `readObjectsForClasses`（`macos.rs:335`）→ 多个文件正常。
- 多 item 的其他类型（如 Photos 多选图片）：`dataForType` / `get_image` 只取第一个 item。
- 不认识的 flavor：`process_clipboard_monitor_tick` 的 `Ok(None) => {}`（`lib.rs:5838`）→ 静默丢弃，无错误码、无日志。

## ④ 缺口清单（"今天会丢什么"）

场景 | 涉及 flavor | 今天的行为 | 影响
--- | --- | --- | ---
取色器/设计工具复制颜色 | `com.apple.NSColorPboardType` | 无记录 | 完全丢失
浏览器复制链接 | `public.url` + 通常有纯文本 | 记为 **text** | 能粘贴，但类型与"链接"语义丢失
只有 URL 没有文本 | `public.url` | 无记录 | 完全丢失
复制联系人 | `public.vcard` | 无记录（若带文本则记为 text） | 结构化字段丢失
复制日历事件 | `com.apple.ical.ics` | 无记录 | 完全丢失
带附件的富文本 | `com.apple.flat-rtfd` | 无记录 | 完全丢失
Safari 网页归档 | `com.apple.webarchive` | 无记录 | 完全丢失
PDF 对象 | `com.adobe.pdf` | 无记录 | 完全丢失
音频 / 影片片段 | `com.apple.coredrag` 等 | 无记录 | 完全丢失
Excel/Numbers 复制区域 | 延迟 promise | 无记录 | 复制瞬间数据未写出，直接丢弃
Photos 多选图片 | 多个 pasteboard item | 只记第一张 | 部分丢失
html / rtf 条目 | —（已入库） | 出现在「全部」，**不可筛选、不计数** | UI 缺口
JPEG / ICNS 等非 PNG/TIFF 图片 | `public.jpeg` / `com.apple.icns` | 待实测（`NSImage initWithPasteboard` 兜底可能可读，`macos.rs:317-334`） | 不确定

## ⑤ 若要补齐：可扩展性评估

- **基座：够用**，不需要 fork，也不需要新的 objc2 手写代码（通用 flavor 读写已内建）。
- **存储**：`kind` 无 CHECK 约束 → 新增类型**不需要迁移**（`lib.rs:692`）。但 `clipboard_payloads` 没有通用 flavor 列，只有 `extra_json TEXT`（当前仅用于图片预览 fallback，`lib.rs:1337`）。
  - 复用 `extra_json` 存 flavor：JSON + 文本承载二进制需 base64，体积约 +33%，且要定截断策略（现有 TEXT 2MB / IMAGE 8MB / 预览 360px 均有限额）。
  - 更稳的做法：新增迁移 v5（例如 `clipboard_flavors(item_id, format, blob, size)` 表），按 flavor 存原始字节。
- **UI**：新增 kind 要同步 4 处 —— `ClipboardKind` union（`src/components/history-row.tsx:5`）、`kind-meta.ts`、chips（`MainTabNavigation.tsx` TabId + `MainApp.tsx` counts/filter）、`PreviewApp.tsx` 的 `KIND_LABELS`。popup/preview 复用同一 map。
- **粘贴侧**：`set_buffer(fmt, bytes)` 能还原任意 flavor；但"还原后目标应用是否接受"不可控。这类类型更适合固定"仅复制"（与 file 类型同一策略）。
- **搜索**：FTS5 只索引 title/preview/source_app/meta/normalized_plain_text → 新类型若无文本，只能按类型/来源搜。

## ⑥ 选项与推荐

选项 | 内容 | 成本 | 风险
--- | --- | --- | ---
**A** | 把已入库的 html/rtf 露出来（chips + 计数；或合并为"富文本"） | 低（前端 2-3 个文件，后端无改动：现在过滤在前端，`kind_filter` 也已支持任意值） | 低（不动捕获与粘贴）
**B** | 显式识别新类型（如 link / color），各成新 kind + 展示 + 仅复制 | 中（读取路径加分支 + 存储复用 `extra_json` + UI 4 处） | 中（新类型的粘贴语义要定义）
**C** | 通用 flavor 记录：快照 `available_formats()`，未识别 flavor 原样入库，新增"其他/未知"kind + flavor 详情 | 高（DB 迁移 + UI 设计 + 体积策略 + 粘贴语义 + 搜索策略） | 高（数据量与体验影响大）

推荐顺序：**A → 实测探针 → 再定 B/C**。理由：A 消除你观察到的"主页类型少"的直接原因，且无后端风险；B/C 的取舍取决于你的真实工作流里到底出现哪些 flavor。

## ⑦ 待实测探针（不改代码；真实复制 + 查 `types()` + 查库）

应用 | 操作 | 期望 flavor | 验证点
--- | --- | --- | ---
Finder | 复制 1 个文件 / 多个文件 | `public.file-url` | file 记录、多文件完整性
Safari | 复制链接 / 复制网页选区 | `public.url`、`public.html` | 链接是否记为 text；HTML 是否优先于 text
预览 / 照片 | 复制图片 | `public.tiff` 或 `public.png` + 可能 `public.file-url` | 结果记为 image 还是 file（验证优先序副作用）
备忘录 / Word | 复制带格式文本 | `public.rtf` / `public.html` | rtf/html 记录与降级粘贴
系统取色器 / 设计工具 | 复制颜色 | `com.apple.NSColorPboardType` | 是否完全无记录
联系人 | 复制联系人 | `public.vcard` | 是否无记录
日历 | 复制事件 | `com.apple.ical.ics` | 是否无记录
Excel / Numbers | 复制单元格区域 | promise / `public.tiff` | 是否无记录
Photos | 多选复制 | 多个 item | 是否只记第一张

每条探针只需：复制后 2 秒，读一次 `NSPasteboard.types()`，查一次库最近 1 条。

## ⑧ 需要你决策

- Q1 主页类型面：只补 html / rtf 两个 chip（保持 5 类），还是把 html+rtf 合并为"富文本"一类？
- Q2 是否要"其他类型"的显式 kind（如 链接、颜色）？
- Q3 是否要通用 flavor 记录（选项 C）？若做，用 `extra_json` 还是新增迁移表？
- Q4 html/rtf 条目是否需要富文本渲染？（当前按纯文本展示是安全设计，改动会影响详情与预览表面）
- Q5 新类型的默认动作：跟随全局设置，还是固定"仅复制"（file 类型同策略）？

## ⑨ 证据等级

- 已核实（代码级）：② ③ ④ 中的行为与行号、⑤ 的存储与 UI 约束、L2 的基座 API。
- 待实测：④ 中"JPEG/ICNS 能否读"、⑦ 全部探针的具体 flavor 组合（不同应用版本可能不同）。
- 未做：本分析期间未产生任何代码改动；DB 已为空库（无历史分布数据可统计）。
