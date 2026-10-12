# SuperClip 剪贴板类型支持面扩展 · 实施计划

日期：2026-10-12 ｜ 需求目录：`.docs/20261012-plan/`
状态：待用户确认（确认前不实施，P-* 与 V-* 仅为计划项）
前置分析：`.docs/20261012-analyze/20261012-clipboard-type-coverage.md`

---

## ① 共识与目标

**问题**：当前只接入 5 个类型家族（text / html / rtf / image / file），且读取是"first-match"（命中即返回）。后果：主页类型面只露 3 类（chips 只有 文本/图片/文件）；macOS 其他常见类型（链接、颜色、vCard、日历、RTFD、PDF、WebArchive、音视频…）**静默丢弃**（`lib.rs:5838` `Ok(None) => {}`）；同一剪贴板上的其余表示（例如文本+HTML+RTF 同时存在时只存 HTML）也被丢弃。基座 clipboard-rs 0.3.5 已提供完整逃生口（`available_formats()` / `get_buffer(fmt)` / `set_buffer(fmt, bytes)` / `ClipboardContent::Other`），能力未被使用。

**调用方**：本机用户（macOS，本地开发环境，无历史数据兼容要求）。

**成功标准（R-*）**：

| ID | 可验收标准 |
| --- | --- |
| R-01 | 复制任意内容后，剪贴板上出现过的表示都被记录：5 个已知家族进入既有列，其余 flavor 进入新的 `clipboard_flavors` 表；不再出现"什么都没记"的静默丢弃。两类例外：① 超限部分（单 flavor 超限写截断标记行；数量/总量超限的部分汇总进 meta 摘要）；② 无数据可读的承诺型 flavor（promise）与拒绝名单类型（不可还原，记录无价值，不产生条目） |
| R-02 | 记录的主类型（kind）与用户复制意图一致：链接、富文本、图片、文件、文本、其他 6 类可分辨（判定规则见 D-06，边界情形由 V-04~V-09 实测确认） |
| R-03 | 主页类型筛选覆盖：全部 / 文本 / 富文本 / 图片 / 文件（常驻）+ 链接 / 其他（计数 > 0 时出现）；计数正确；行内图标与标签能区分 6 类 |
| R-04 | 详情（预览浮窗）能看到"这条记录携带哪些表示"（flavor 名称 + 体积），也能看到其他类型的"仅复制"说明 |
| R-05 | 粘贴保真：写回已存表示（Text/Html/Rtf/Image/Other*）；**files 与其他表示同时存在时按文件优先（其他表示本次不写回，结果标降级并说明）**；`其他` 类型固定"仅复制 + 明确提示"，不尝试直接粘贴 |
| R-06 | 既有能力零回归：搜索 / 置顶 / 回收站与恢复 / 排除规则 / 历史保留上限 / 恢复模式只读 / 自写抑制 / 监控稳态零子进程 |
| R-07 | 迁移安全：schema v5 在 空库 / 旧库 / 二次启动 三种情形均成功且幂等；清理数据库后可重新开始 |
| R-08 | 质量门禁：`cargo test`、`npm run build`、`npm run test:frontend` 全绿 |

**非目标（明确不做）**：多 item pasteboard 展开（Photos 多选图片仍只记第一条，S-14）；富文本渲染（D-05）；颜色等专用语义解析（D-03）；拖拽（drag）路径；iOS/Windows；搜索算法与 FTS schema 调整；数据库历史数据回填。

---

## ② 范围边界与场景账本（S-*）

边界状态说明：目标变化 / 保持现状 / 不适用 / 范围外（最终计划中不允许"待确认"）。

| ID | 参与者/触发 | 前置条件与输入 | 目标结果 | 失败与关键边界 | 状态/副作用/责任 | 可观察结果 | 状态与依据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-01 | 用户复制纯文本 | 剪贴板含 `public.utf8-plain-text` | 记一条 `kind=text` | 空/纯空白文本 → 不记录（沿用现状） | 插入 items+payloads | 列表出现文本条目，chips「文本」计数 +1 | 保持现状（`lib.rs:1200`） |
| S-02 | 用户复制富文本（网页选区/Word/备忘录） | 含 `public.html` 和/或 `public.rtf`（通常也有纯文本） | 记一条 `kind=html` 或 `rtf`，**同一记录同时保存** text/html/rtf 全部已有表示 | 只有 RTF → 记 rtf；HTML 为空字符串 → 视为无该表示 | 插入 items+payloads（多列同时非空） | 列表行标签显示 HTML 或 RTF；chips「富文本」计数 +1；粘贴回目标保留格式 | 目标变化（当前只存单一表示，`lib.rs:1448`） |
| S-03 | 用户复制图片（截图 / 预览 / 照片） | 含 `public.png` / `public.tiff`（可能同时含 `public.file-url`） | 记 `kind=image`；图片 RGBA 入 `image_blob`；`public.file-url` 属跳过集合（不入库，避免与文件语义混淆） | 图片 + 文件 + 无文本 → 仍判为**图片**（D-06③：files 与 image 同存时以 image 为准）；图片解码失败 → 该表示跳过，若有其他表示则按其他类型记 | 插入 items+payloads | 列表出现图片条目；chips「图片」+1；粘贴到图像目标正常 | 目标变化（当前 image+file-url 会记为 file，`lib.rs:1546`） |
| S-04 | 用户复制文件（Finder，1 个或多个） | 含 `public.file-url`，无 image / html / rtf | 记 `kind=file`，`file_urls` 全量 | 文件不存在于磁盘（粘贴时被删除）→ 跳过该文件路径（沿用库行为，D-07）；全部路径不存在 → `PASTEBOARD_WRITE_FAILED` | 插入 items+payloads | 列表出现文件条目（"N 个本地文件"）；粘贴回 Finder 落盘 | 保持现状（`lib.rs:1301`） |
| S-05 | 用户复制链接（浏览器地址栏/链接） | 含 `public.url`（`Apple URL pasteboard type` 不单独作判据，见 D-06①） | 记 `kind=link`，URL 文本入 `text_plain`，URL flavor 入 flavors 表 | 只有 URL flavor 无文本 → 用 flavor 字节按 UTF-8 解码作 URL 文本；解码失败 → 记 `kind=other` | 插入 items+payloads+flavors | 列表出现链接条目（显示域名+路径）；chips「链接」出现并计数 | 目标变化（当前记为 text 或丢弃） |
| S-06 | 用户复制未识别类型（颜色/vCard/日历/PDF/RTFD/WebArchive…；`com.apple.coredrag` 等拖拽会话类型在拒绝名单，不记录） | 只有"其他 flavor"（无 text/html/rtf/image/files） | 记 `kind=other`；flavor 原样入表 | 单 flavor > 1MB → 存截断标记行（无数据 + digest）；总量 > 2MB 或非跳过 flavor > 8 个 → 只取前 8 个，其余汇总进 meta（`另有 N 个格式未存`）；无数据（promise）→ 跳过 | 插入 items+payloads+flavors | 列表出现"其他"条目，meta 显示 flavor 摘要；chips「其他」出现并计数 | 目标变化（当前完全丢弃） |
| S-07 | 同一次复制含多种表示（文本+HTML+RTF+图片） | 任意组合 | 一条记录保存全部表示；kind 按 D-06 优先级取一个 | 任一表示超限 → 该表示按各自限额截断（文本 2MB/图片 8MB/flavor 1MB），`is_truncated=1` | 插入 items+payloads+flavors | 详情页显示表示清单；粘贴写回全部表示 | 目标变化 |
| S-08 | 用户点类型 chip | 列表已加载 | 过滤出对应 kind（富文本 = html+rtf） | 计数为 0 的「链接」「其他」chip 不显示；选中后清空搜索词（沿用现状） | 前端状态变化，无 DB 副作用 | 列表只剩该类型；chip 高亮 | 目标变化（`MainTabNavigation.tsx:14-16`） |
| S-09 | 用户查看详情/预览浮窗 | 条目存在 | 显示表示清单（flavor + 体积）与类型徽标 | flavors 为空（旧记录）→ 不渲染该区块；超过 6 项 → 折叠为"等 N 项" | 只读查询 | 详情出现「表示」区块 | 目标变化（`PreviewApp.tsx`） |
| S-10 | 用户对「其他」类型执行默认动作（粘贴路径与复制路径都算） | 条目 `kind=other` | 写入原样表示到剪贴板，返回 `mode=copy_only` + 提示文案 + `error_code=COPY_ONLY_TYPE`；不触发 Cmd+V（`build_paste_result` 与 `build_copy_result` 两条路径都要有这个分支）；**`kind=other` 时后端不调用 `hide_popup_window`**（D-13 要求 popup 存活以显示行内反馈） | 目标应用不接受该 flavor → 用户手动粘贴失败（不额外承诺）；写回失败 → `PASTEBOARD_WRITE_FAILED` | 写剪贴板 + `mark_self_write_hash` + `mark_item_used` | Toast 显示"已复制（该类型仅支持复制）"；主窗口场景 popup 照常关闭；popup 场景不立即关闭、行内一次性提示（D-13） | 目标变化 |
| S-11 | 用户配置排除规则 | 设置 → 排除规则 | 规则类型下拉新增 链接 / 其他；命中后不记录 | 规则值非法（非 7 类之一）→ 沿用后端宽松匹配（按 kind 字符串比较，不报错） | 规则持久化 | 复制被排除类型的对象后列表不新增 | 目标变化（`settings-shell.tsx:84-90`） |
| S-12 | 用户删除条目 → 撤销恢复 | 条目含 flavors | 删除时 flavors 随条目进回收站；恢复后 flavors 完整回归 | 令牌过期 → `UNDO_EXPIRED` 且不删 trash 行（沿用现状）；旧 trash 行无 `flavors_json`、或旧 `payload_json` 无 `flavors` 字段（升级前删除的）→ 反序列化取默认空值，恢复为空 flavors，不报错 | trash 写读 + items/payloads/flavors 重插 | 恢复后的条目粘贴仍能还原全部表示 | 目标变化（`clipboard_trash` 需带 flavors） |
| S-13 | 应用启动（空库 / 旧库 / 二次启动） | DB 存在或不存在 | 迁移到 v5；旧记录可浏览、可粘贴（无 flavors） | 迁移失败 → 走既有恢复模式降级（只读 + `RECOVERY_MODE_READ_ONLY`） | `migrate_database` 幂等执行 | `sqlite3 <db> "PRAGMA user_version"` = 5，且 `_superclip_migrations` 含 v5 行；二次启动无报错 | 目标变化 |
| S-14 | 用户多选复制（Photos 多张图片） | pasteboard 含多个 item | 只记第一条能被识别的表示集合（第一条 item 优先） | 不展开为多条记录 | 单条插入 | 列表只出现 1 条 | 范围外（基座 `get_image`/`dataForType` 只取首项；记录分界，后续事项） |
| S-15 | 用户复制超大 flavor（如 >1MB 的 PDF） | 单 flavor 超限 | 记录该 flavor 的元数据行（`is_truncated=1`，无数据），meta 标注"已截断" | 粘贴时跳过被截断 flavor；其余表示正常写回；**若全部表示都不可写 → 不碰剪贴板并返回 `PAYLOAD_UNSUPPORTED`（D-14）** | 插入 flavors 行（data 空） | 详情表示清单显示"1.2 MB（已截断）" | 目标变化 |
| S-16 | 从 SuperClip 粘贴后监控 | 任意类型 | 监控不产生新记录（自写抑制） | hash 覆盖"实际写回的表示集合"（被截断 flavor 不参与，见 D-10），避免不同表示组合相互覆盖 | `self_write_hash` 比较（`lib.rs:2163 mark_self_write_hash`） | 粘贴 20 次后历史不增长 | 保持现状（D-10） |

**连接点闭合检查**：入口与权限（无新入口；`其他`类型的权限行为 = 只复制，不依赖 Accessibility —— 已在 S-10 定义）｜字段与 schema（v5 新表 + trash 新列，读写方见 P-01/P-03；旧数据空值语义见 S-12/S-13）｜状态与任务（无新任务；历史保留清理与回收站清理沿用）｜API/event（`clipboard_get` 详情响应增加 `flavors` 字段——向后兼容的加法字段；无新事件）｜副作用与观测（每说明确的 meta/`is_truncated` 作为可见证据；不新增日志/指标，理由见 ⑥.5）。

---

## ③ 现状与证据

| 事实 | 证据（文件:符号/行） |
| --- | --- |
| 读取是 first-match，顺序 files→text→html→rtf→text→image | `src-tauri/src/lib.rs:1538` `read_clipboard_snapshot` |
| 不认识的内容静默丢弃 | `src-tauri/src/lib.rs:5838` `Ok(None) => {}` |
| 5 类 normalize 各自构造 payload（单一表示） | `lib.rs:1200` `normalize_text_snapshot`、`1246` rtf、`1301` file、`1381` image、`1461` html；`1437` `strip_html_tags` |
| hash 现有签名 | `lib.rs:865` `content_hash(kind, primary, secondary)`；调用点：1218/1270/1309/1394/1486/5416，另有诊断用的 4503（`content_hash("db", …)`） |
| payload 列已能并存多表示 | `clipboard_payloads(text_plain, text_html, text_rtf, image_blob, image_width, image_height, file_urls_json, extra_json)`；`kind` 无 CHECK 约束（`lib.rs:692`） |
| 迁移是"多次 `execute_batch` + 版本行 + `PRAGMA user_version`" | `lib.rs:671` `migrate_database`；v1..v4 块 |
| 回收站只存 item_json + payload_json，恢复时重算 hash | `lib.rs:725` 表结构；`5303` `clipboard_delete`（INSERT 在 5330）；`5384` `restore_trash_entry` |
| 写回是单表示或 set_files | `lib.rs:2084` `write_payload_to_clipboard` |
| 粘贴结果与降级文案 | `lib.rs:2207` `build_paste_result`；file 固定 copy_only（`lib.rs:5214`，`clipboard_paste` 在 5187；`clipboard_copy` 在 5146） |
| 基座能力（全部未使用） | `macos.rs:245 available_formats()`（返回 pasteboard 全部 type）、`:297 get_buffer(fmt)`、`:427` 读为 `Other`、`:442 set_buffer`、`:215` 写入 `Other`（与其他表示同一个 NSPasteboardItem） |
| 基座写文件会清空剪贴板 | `macos.rs:129` 固有 `set_files` 只做 `writeObjects`；清空发生在 `macos.rs:169 write_to_clipboard` 与 `:462` trait `set_files`（内部 `self.clear()`）；`write_to_clipboard` 的 `Files` 分支单独调用它 → **files 不能与其他表示混在一次 `set` 中** |
| 图片容器只支持 PNG（无 to_tiff） | `common.rs:285` `to_png`（另有 `to_jpeg`、`to_rgba8`）；TIFF 需自行编码（`image` crate 已带 `tiff` feature） |
| 前端类型面 | `kind-meta.ts:10-14`（5 类标签/图标）、`history-row.tsx:5`（`ClipboardKind` 联合类型）、`MainTabNavigation.tsx:14-16`（3 个 chip）、`MainApp.tsx:142-158`（计数与过滤）、`PreviewApp.tsx:12-18`（`KIND_LABELS`）、`settings-shell.tsx:84-90`（content_kind 选项 5 项） |
| 限额常量 | `lib.rs:35-38`：TEXT 2MB / IMAGE 8MB / 预览边 360 / 轮询 900ms（监控已换 watcher，见上一轮计划） |

**关键推断**（用于设计，非事实）：Finder 复制文件不带图片数据（S-03/S-04 的判别前提）；浏览器复制链接同时带文本与 `public.url`。两者由 V-04~V-09 实测确认。

---

## ④ 已确认决策（D-*）

用户已把 Q1–Q4 的处理权交给我（原话："这4个问题，都按你的处理"），下列决定状态为**已授权实施**；技术细节若在实施中与仓库现实冲突，按下表"受影响项"回退重开。

| ID | 问题 | 决定 | 理由/证据 | 受影响项 | 状态 |
| --- | --- | --- | --- | --- | --- |
| D-01 | Q1：主页类型面怎么补 | chips = **全部 / 文本 / 富文本（=html+rtf）/ 图片 / 文件**（常驻）+ **链接 / 其他**（计数 > 0 时出现）；行内仍显示精确标签 HTML / RTF | 用户按"富文本"思考，不区分 HTML/RTF；计数为 0 的类型不出现在默认界面，避免 7 个 chip 长期占位；后端 `kind_filter` 已支持任意值，纯前端改动 | S-08、P-05 | 已授权实施 |
| D-02 | Q2：链接是否独立类型 | **是**：`kind=link`，判定 = 存在 `public.url`；URL 文本存 `text_plain`，原始 flavor 存 flavors 表 | 链接是最高频的非文本类型；独立后可筛选、可搜索引擎化；写回仍带 text+url 两种表示。**不能用 `Apple URL pasteboard type` 作判据**：Finder 复制文件的 `writeObjects(NSURL)` 也会写它（上一轮计划 `.docs/20261011-plan/20261011-clipboard-rs-migration-plan.md:61`），否则文件会被误判成链接 | S-05、S-08、P-02、P-04、P-05 | 已授权实施 |
| D-03 | Q2：颜色是否独立类型 | **不独立**：颜色（`com.apple.NSColorPboardType`）归 `kind=other`，字节级原样保存与还原，不解析成色块/HEX | NSColor 的 pasteboard 数据是 NSKeyedArchiver plist，Rust 端解析脆弱、维护成本高；字节还原已能满足"可粘贴回颜色输入框"；等实测数据证明高频再做阶段 2 | S-06、P-02 | 已授权实施 |
| D-04 | Q3：通用 flavor 记录 | **做**：新增 `clipboard_flavors` 表（v5）。过滤规则：跳过 6 个已知家族 flavor（text/html/rtf/png/tiff/file-url）及其别名（`NSStringPboardType`、`public.utf16*`、`NSFilenamesPboardType`、`Apple URL pasteboard type`）、跳过与 `text_plain` 字节完全相同**且不在保留名单**的 flavor（豁免 `public.url`，否则链接的 URL flavor 会被误跳）、跳过取不到数据的 promise flavor；限额：单 flavor ≤ 1MB、单条合计 ≤ 2MB、表内行数 ≤ 8（数据行 + 标记行合计，按 pasteboard 顺序取前 8 个非跳过 flavor）；单 flavor 超限 → 写"无数据 + is_truncated=1 + digest=sha256(原始字节)"的标记行；累计或数量超限 → 停止处理，剩余 flavor 只汇总进 meta（`另有 N 个格式未存`）并置 is_truncated | 基座已提供 `available_formats`/`get_buffer`/`set_buffer`；表比 JSON 更省（二进制不 base64 膨胀）且可级联删除 | S-06、S-07、S-15、P-01~P-03 | 已授权实施 |
| D-05 | Q4：富文本是否渲染 | **不渲染**：详情/预览继续按纯文本展示；新增「表示」区块与类型徽标，让"携带什么"可见 | 避免把 HTML 注入到应用窗口（安全/样式/可访问性成本）；本需求目标是类型完整性，不是渲染 | S-09、P-06 | 已授权实施 |
| D-06 | 主类型判定优先级 | 按下表自上而下取第一个成立的：① `public.url` 存在 → `link`（不含 `Apple URL pasteboard type`，理由见 D-02）；② html 或 rtf → `html`（优先）否则 `rtf`；③ files 且无 image → `file`；④ 非空文本 → `text`；⑤ image → `image`；⑥ 其他 flavor → `other` | 覆盖 S-01~S-06 六种典型意图；③ 用"无 image"硬条件区分 Finder 文件（files+文件名文本）与预览/照片图片（image+file-url） | S-01~S-06、P-02 | 已授权实施（边界由 V-04~V-09 实测，必要时按 K-02 微调） |
| D-07 | 写回策略 | 单 item 多表示：`Text`/`Html`/`Rtf`/`Image(PNG)`/`Other*`（顺序：Html→Rtf→Text→Image→Others）；images 额外 best-effort 附带由 RGBA 编码的 TIFF（`Other("public.tiff")`，编码失败或超 8MB 则跳过）；**files 存在时一律走 `set_files`（文件优先；其他表示本次不写回，结果标 `degraded=true` 并在文案说明）**；`kind=other` 固定 copy_only | `macos.rs:169 write_to_clipboard` 会先 `clearContents`、`:462` trait `set_files` 内部 `self.clear()` → files 与多表示互斥，只取一边；TIFF 提升老应用兼容（上一轮 K-01） | S-03~S-07、S-10、P-04 | 已授权实施 |
| D-08 | 排除规则类型面 | `content_kind` 选项增加 `link`、`other`（前端选项表 + 后端零改动，`snapshot_is_excluded` 按 kind 字符串比较） | 规则语义是"按类型排除"，新类型必须可排 | S-11、P-07 | 已授权实施 |
| D-09 | 详情接口 | `ClipboardItemDetail` 增加 `flavors: [{format, sizeBytes, isTruncated, ordinal}]`（不含二进制）；二进制只走"粘贴/回收站"内部路径 | 前端不需要 2MB 二进制；避免详情响应膨胀 | S-09、P-01、P-03 | 已授权实施 |
| D-10 | hash 扩展 | `content_hash(kind, parts: &[&[u8]])` 覆盖"实际会被写回的内容表示"（html/rtf/纯文本/图片 w+h+RGBA/文件列表/flavor 的 `format` + 数据；**flavor 先按 `format` 排序再拼接**，保证重读顺序变化不影响 hash）；**被截断的 flavor 不参与 hash**（与 D-11"不参与粘贴"一致，保证粘贴后监控重算的 hash 与存储 hash 相同，S-16 不产生重复条目）；**例外：若参与 hash 的表示为空（例如唯一 flavor 被截断），退化为全部 flavor 的 `format` + `size_bytes` + `digest` 列表**（digest = 原始字节的 SHA-256，截断行也必须保存），避免同尺寸不同内容撞同一 hash；此时粘贴为零可写表示 → 不碰剪贴板并返回 `PAYLOAD_UNSUPPORTED`（D-14），监控不会读到新内容，自写抑制不受影响；旧数据 hash 不重算 | 保证"同文本不同 flavor 组合"不互相去重；自写抑制依赖同一函数 | S-16、P-02、P-03 | 已授权实施 |
| D-11 | 截断与限额 | 沿用 2MB/8MB；新增 1MB/2MB/8 行（flavor）；超限只影响该表示，`is_truncated` 与 meta 文案可见；**被截断的 flavor 不参与粘贴（文本/图片保持现状：文本超 2MB 仍写回截断内容，图片超 8MB 走既有降级）** | 与现有 2MB/8MB 语义一致（不新增全局限额概念） | S-07、S-15、P-02、P-04 | 已授权实施 |
| D-12 | 测试与验收 | Rust 单测（迁移幂等 / 判定表 / flavor 过滤与截断 / hash 稳定性 / 写回组合 / trash 保真）+ 前端测试（chips 计数与隐藏、标签、选项）+ 人工验收 V-04~V-15 | 与仓库既有测试方式一致（`cargo test`、vitest+jsdom） | P-08、⑧ | 已授权实施 |
| D-13 | `其他` 类型的反馈宿主 | 主窗口：用既有 feedback Toast 显示 result.message；popup：`kind=other` 的默认动作**不立即关闭 popup**（后端跳过 `hide_popup_window`，前端在提示结束后调用 `hidePopup()`），行内显示一次性提示（文案 = result.message）1.5s 后清除；预览浮窗：面板内固定"仅复制"说明 | `PopupApp` 的 `handleAction` 不展示 `result.message`；且后端 `clipboard_paste`/`clipboard_copy` 末尾无条件 `hide_popup_window`（`lib.rs:5236/5181`）→ 不改后端就看不到反馈 | S-10、P-04、P-06 | 已授权实施 |
| D-14 | 零可写表示的粘贴行为 | 当可写表示集合为空（例如唯一 flavor 被截断、或只剩拒绝名单类型）→ **不碰剪贴板**，返回 `PAYLOAD_UNSUPPORTED`，前端文案"该条记录没有可粘贴的数据"；不写 `self_write_hash`（剪贴板未变） | 沿用 `write_payload_to_clipboard` 现对空负载的 `Err("PAYLOAD_UNSUPPORTED")`（`lib.rs:2143`），避免"静默什么都不做"导致用户困惑或产生伪记录 | S-15、P-04 | 已授权实施 |

**被拒绝的备选**：① 用 `extra_json` 存 flavor（二进制需 base64 膨胀 ~33% + 无法随条目级联删除 + 读写都要自己解析 JSON 与限额）；② 颜色/PDF 等逐类型专用解析（成本高、收益未证实）；③ 多 item 展开（基座只取首项，需要自己写 objc2 遍历 `pasteboardItems()`，超出本次范围）。

---

## ⑤ 实现设计适用性矩阵

| 维度 | 状态 | 判断依据 | 处理安排 |
| --- | --- | --- | --- |
| 核心主链路 | 适用 | 捕获→存储→展示→粘贴四条链路都改（新增表示集合与主类型判定） | ⑥.1（本文件内完成，无需额外轮次） |
| 数据存储与表设计 | 适用 | 新增表 + 回收站列 + 迁移 v5 + 级联删除 | ⑥.2 |
| 接口设计 | 适用 | `clipboard_get` 响应加 `flavors`；粘贴返回新增 `COPY_ONLY_TYPE`；无新命令 | ⑥.3 |
| 实现逻辑与非功能 | 适用（轻） | 限额、截断、best-effort 写回、无新并发/缓存/队列；可观测性明确不扩展 | ⑥.4、⑥.5 |

---

## ⑥ 推荐设计

### ⑥.1 核心主链路

```
变化检测（不变：clipboard-rs watcher 500ms）
  → read_clipboard_representations()           ← 新增：一次读全
        available_formats()                    ← 全部 flavor 名
        get_text / get_html / get_rich_text / get_image / get_files
        get_buffer(fmt) × 其余 flavor          ← 过滤 + 限额
  → decide_primary_kind(representations)       ← D-06 优先级表
  → build_snapshot(kind, representations)      ← 复用既有 normalize 的预览/截断/meta 文案
        content_hash(kind, parts…)             ← D-10
  → upsert_clipboard_snapshot（事务）
        clipboard_items + clipboard_payloads（多表示并存）+ clipboard_flavors（≤8 行）
        去重：hash 命中 → 仅更新 last_seen_at
        cleanup_history(limit)（不变）
  → emit "history-updated"

粘贴（不变入口，扩展写回）
  clipboard_paste / clipboard_copy
    → get_item + get_payload + get_flavors（二进制）
    → write_payload_to_clipboard(payload, flavors, as_plain_text)   ← D-07 组合规则
    → kind=other → 固定 copy_only + COPY_ONLY_TYPE（不调 trigger_direct_paste；分支置于 Accessibility 判定之前）
    → mark_self_write_hash(hash)（覆盖实际写回集合，见 D-10）→ mark_item_used → item-updated → hide popup（other 时按 D-13 处理反馈）

删除 / 恢复（扩展保真）
  clipboard_delete：item_json + payload_json + flavors_json（base64）
  restore_trash_entry：解析 flavors_json → 重插 flavors → 用同一 content_hash 重算 hash
```

### ⑥.2 数据存储与 schema v5

```sql
CREATE TABLE IF NOT EXISTS clipboard_flavors (
    item_id TEXT NOT NULL REFERENCES clipboard_items(id) ON DELETE CASCADE,
    format TEXT NOT NULL,
    ordinal INTEGER NOT NULL DEFAULT 0,
    size_bytes INTEGER NOT NULL,
    digest TEXT NOT NULL DEFAULT '',
    is_truncated INTEGER NOT NULL DEFAULT 0,
    data BLOB NOT NULL,
    PRIMARY KEY (item_id, format)
);
-- clipboard_trash.flavors_json 由 Rust 侧 guard 添加（见下方要点），不放进本 batch
INSERT OR IGNORE INTO _superclip_migrations(version, description, applied_at)
VALUES (5, 'clipboard flavors for full pasteboard representation coverage', unixepoch());
PRAGMA user_version = 5;
```

- 迁移实现要点：`CREATE TABLE IF NOT EXISTS` 天然幂等；`ALTER TABLE ... ADD COLUMN` 不幂等（第二次启动会报 duplicate column）→ **不放进上述 batch**，在 Rust 里先 `PRAGMA table_info(clipboard_trash)` 检查列存在性，缺失才单独执行。
- flavors 与 payload 的关系：`clipboard_flavors` 是唯一权威存储；`ClipboardPayloadSnapshot` 里的 `flavors` 字段仅供内部传递，必须标 `#[serde(default, skip_serializing)]` → 不会被写进 `clipboard_trash.payload_json`（回收站走独立的 `flavors_json`），旧 `payload_json`（无该字段）反序列化取默认空值。
- 清理语义：`clipboard_items` 删除 → flavors 级联删除；回收站在删除时把 flavors 编码进 `flavors_json`（base64，`base64 = "0.22"` 新依赖，已在依赖树中）。
- 体积：单条 ≤ 2MB flavor 数据（D-04/D-11）；`history_limit` 与 30 天回收站保留策略不变。

### ⑥.3 接口设计

| 接口 | 变化 | 兼容性 |
| --- | --- | --- |
| `clipboard_get`（详情） | 响应增加 `flavors: [{format, sizeBytes, isTruncated, ordinal}]`；`version` 保持 `1`（纯加法字段，前后端同包） | 纯加法；前端旧版本忽略即可（本项目前后端同包，无跨版本） |
| `clipboard_paste` / `clipboard_copy` | `kind=other` 返回 `mode=copy_only`、`error_code="COPY_ONLY_TYPE"`、`degraded=false`、`fallback_used=false`；覆盖 `build_paste_result`（2207）与 `build_copy_result`（2195 一带）两条路径 | 既有 `ClipboardActionResult` 结构不变，仅新增取值 |
| `clipboard_search` / `clipboard_list` | 无变化（`kind` 取值新增 link/other；`kind_filter` 已支持任意字符串） | 向前兼容 |
| 事件 | 无新增；`item-updated` / `history-updated` 语义不变 | — |
| 诊断 | `runtime_state` / `diagnostics_export` 不新增字段（理由见 ⑥.5） | — |

### ⑥.4 实现逻辑与非功能

- **读取容错**：每个表示独立 `Result`，失败只跳过该表示（`get_image` 解码失败不影响文本）；全部失败且无表示 → 返回 `Ok(None)`（沿用"空剪贴板不记录"）。
- **可读性（不解析数据）**：`其他` 类型用"flavor 显示名映射表"生成人类可读标题（颜色/联系人/PDF…）；映射表只做名称→中文名映射，不解析 flavor 内容（D-03）。**原始 flavor 名写入 `meta`**（被 FTS 索引），中文名只用于 title/preview。
- **搜索**：`insert_fts`（`lib.rs:1654`）已把 `meta` 纳入 FTS 列 → `其他` 类型可按 flavor 名（如 `NSColor`）搜到（原始 flavor 名在 meta）；`link` 的 URL 文本进入 `text_plain`/title/preview，可正常搜索。
- **过滤规则落地**（D-04）：
  - 跳过集合：`public.utf8-plain-text`、`NSStringPboardType`、`public.utf16-external-plain-text`、`public.utf16-plain-text`、`public.html`、`public.rtf`、`public.tiff`、`public.png`、`public.file-url`、`NSFilenamesPboardType`、`Apple URL pasteboard type`；
  - 生成式跳过：`data` 与 `text_plain` 的 UTF-8 字节完全相同**且不在保留名单**（豁免 `public.url`；覆盖私有文本别名）；
  - 拒绝名单：`com.apple.coredrag`（拖拽会话，体积大且无粘贴价值）、`com.apple.pasteboard.promised-*`（无实际数据）；
  - 保留：`public.url`、`public.jpeg`、`com.apple.icns`、`com.apple.NSColorPboardType`、`public.vcard`、`com.apple.ical.ics`、`com.apple.flat-rtfd`、`com.apple.webarchive`、`com.adobe.pdf` 等一切有数据的 flavor（`Apple URL pasteboard type` 与 `NSFilenamesPboardType` 已进跳过集合；`public.file-url` 一律跳过 —— 图片场景不存文件引用，见 S-03）。
- **files 与多表示互斥**：`payload.file_urls` **只在 `kind=file` 时写入**（图片场景不写，见 S-03）；正常路径因此不存在 files+其他表示的组合。若历史/异常数据出现该组合，粘贴按 D-07 文件优先，返回 `degraded=true` + 文案"已复制文件（其他格式本次未写回）"。
- **零可写表示**（D-14）：写入集合为空时不得静默返回成功；直接 `PAYLOAD_UNSUPPORTED`，且不调用剪贴板 API。
- **写回 best-effort**：逐个表示构建，任一表示在基座层面写入失败（极少：`writeObjects` 返回 false）→ 整条 `PASTEBOARD_WRITE_FAILED`，不做部分承诺；TIFF 编码失败单独跳过（不影响其他表示）。TIFF 属于已知跳过家族，监控重读时不计入 flavor 集合，也不影响 D-10 的 hash。
- **并发与幂等**：写入仍在 `state.db`（单写连接）事务内；flavors 与 items/payloads 同事务 → 不会出现"有 item 无 flavors"的半状态。粘贴路径无并发新风险（沿用现有锁顺序：`db_read` → 剪贴板写入 → `db`）。
- **性能**：读取增加 `available_formats()` + 每个额外 flavor 一次 `dataForType`（O(flavor 数)，典型 ≤ 10 次内存读取）；hash 计算新增 flavor 字节摘要，受 2MB 上限约束。粘贴新增 TIFF 编码（best-effort，大图可能 10–30ms）。
- **已登记的边界未知**：若 `get_image` 的 `NSImage::initWithPasteboard` 兜底把 PDF 也读成图（`macos.rs:317-334`），PDF 复制会落到 `kind=image` 而不是 `other`；由 V-09 实测，必要时在 `decide_primary_kind` 内对同时含 `com.adobe.pdf` 的输入豁免 image 分支（一处函数，K-02）。

### ⑥.5 可观测性与运维（连接点答复）

- 新类型捕获是**确定性行为**，可观察结果是列表条目、meta 文案、`is_truncated` 与详情「表示」区块；不新增日志/指标。
- 需要排障时：`runtime_state` / `diagnostics_export`（既有）与 `recent_errors`（既有）足够定位"写库失败/迁移失败"；flavor 级别异常不产生错误码，因为其影响已在条目上可见（截断标记）。
- 发布与回滚：本地开发、无发布流程；回滚 = 回退代码 + `rm` 数据库（非目标数据兼容）。迁移是加法（新表 + 新列），旧代码遇到新库不会报错（多出的表/列被忽略）。

---

## ⑦ 实施账本（P-*）

顺序即依赖顺序。每项结束时必须 `cargo check`/测试可编译通过。

| ID | 来源 | 目的与变更内容 | 实现逻辑 | 关联文件/符号 | 依赖 | 完成判据 | 验证方式（命令＋预期） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | R-07、D-04、D-09、S-12、S-13 | schema v5 就绪：`clipboard_flavors` 表 + `clipboard_trash.flavors_json` 列；详情结构扩展 | `migrate_database` 追加 v5 batch（CREATE TABLE + migration 行 + `PRAGMA user_version=5`）；`ALTER TABLE` 前用 `PRAGMA table_info` 判存在；新增 `struct ClipboardFlavorRow/ClipboardFlavorSummary`（serde camelCase）与 `ClipboardItemDetail.flavors`；`base64` 依赖加入 `Cargo.toml` | `src-tauri/src/lib.rs`:`migrate_database`、`ClipboardItemDetail`；`src-tauri/Cargo.toml` | — | 空库/旧库/二次启动三种情形迁移成功；`_superclip_migrations` 有 v5 行；重复启动不报 "duplicate column" | `cargo test migration`（新增 `migration_v5_creates_flavors_table_and_is_idempotent`：内存库连续 `migrate_database` 两次 → `Ok`；`PRAGMA table_info(clipboard_trash)` 含 `flavors_json`） |
| P-02 | R-01、R-02、D-02、D-03、D-04、D-06、D-10、D-11、S-01~S-07、S-14、S-15 | 读取链路改为"全表示采集 + 主类型判定"；hash 覆盖全部表示；新类型的 title/preview/meta 定义 | 新增 `read_clipboard_representations()`：`available_formats()` → 逐家族读取 + `read_flavor_payloads()`（过滤/限额/去重）；新增 `decide_primary_kind()`（D-06 表）；`ClipboardPayloadSnapshot` 增加 `flavors`（内部结构，带 data；字段标 `#[serde(default, skip_serializing)]`，不进 trash 的 `payload_json`）；5 个 `normalize_*` 改为共享 `build_snapshot`；`content_hash(kind, parts)` 签名改造并更新全部调用点（含 `restore_trash_entry`）；新增常量 `FLAVOR_PAYLOAD_LIMIT_BYTES=1MB`、`FLAVOR_TOTAL_LIMIT_BYTES=2MB`、`FLAVOR_MAX_COUNT=8`、`FLAVOR_DENYLIST`、`FLAVOR_SKIPLIST`；既有 text/html/rtf/image/file 的预览/截断/meta 文案不变；**`get_files` 结果只在 `kind=file` 时写入 `payload.file_urls`（图片场景一律不写，否则粘贴会走 set_files 而不写图片）**；超限 flavor 计算 `digest = sha256(原始字节)` 存入截断行（供 hash 与恢复重算）。新类型文案：**link** → title=URL 去 scheme 的 host+path（≤ 28 字，用字符串截取实现：`split_once("://")` + 截到 `?`/`#`，**不新增 `url` 依赖**）、preview=URL 全文（≤ 140 字）、meta=`链接 · <host>`；**other** → title/preview 由 flavor 显示名映射生成（内置映射表：`com.apple.NSColorPboardType`→颜色、`public.vcard`→联系人、`com.apple.ical.ics`→日历事件、`com.adobe.pdf`→PDF、`com.apple.flat-rtfd`→富文本（RTFD）、`com.apple.webarchive`→网页归档、`public.url`→链接；未命中则显示 flavor 原名），**meta 必含原始 flavor 名**（供 FTS 搜索）+ `N 种格式 · 合计 X KB`（有截断时追加"· 已截断"）。**只做显示名映射，不解析 flavor 数据**（D-03） | `lib.rs`:`read_clipboard_snapshot`→新实现、`normalize_*`、`content_hash:865`、`ClipboardPayloadSnapshot`、常量区 | P-01 | 六类判定表逐条成立；flavor 过滤/截断/去重符合 D-04；link/other 的 title/preview/meta 与上述文案一致；`kind=image` 时 `payload.file_urls` 为空；**条件判据：若 V-09 实测 PDF 落到 `kind=image`，则在 `decide_primary_kind` 对同时含 `com.adobe.pdf` 的输入豁免 image 分支并补单测**；`cargo check` 无 unused 警告 | `cargo test clipboard_kind`（判定表 6 条 + image 场景 `file_urls` 为空）+ `cargo test flavor`（过滤/去重/截断/digest/显示名 5 条）+ `cargo test content_hash`（同文本不同 flavor → 不同 hash；flavor 顺序打乱 → 同 hash；被截断 flavor 不改变 hash（等于"写回集合"的 hash）；**唯一 flavor 被截断且内容不同 → 不同 hash（靠 digest）**；同表示重复 → 同 hash） |
| P-03 | R-01、R-06、R-07、D-04、D-09、S-12、S-13、S-15 | 存储与回收站保真 | `upsert_clipboard_snapshot`（`lib.rs:1687`）事务内插入 flavors 行（数据行 + 标记行合计 ≤ 8，含 `digest`）；新增 `get_flavors_by_id`（摘要，供详情）与 `get_flavor_blobs_for_paste`（二进制，供粘贴）；`clipboard_delete`（5303）序列化 flavors（base64）写入 `clipboard_trash.flavors_json`；`restore_trash_entry`（5384）解析并重插 flavors（含 digest），hash 用同一 `content_hash`（`data` 或 `format+size_bytes+digest`）重算；`clipboard_get` 返回 `flavors` 摘要 | `lib.rs`:`upsert_clipboard_snapshot`、`get_payload_by_id`、`clipboard_delete`、`restore_trash_entry`、`clipboard_get`、`insert_fts`（文本字段来源不变） | P-01、P-02 | 删除→恢复后 flavors 与 hash 与删除前一致；无 flavors 的旧 trash 行恢复不报错 | `cargo test trash_restore_preserves_flavors`（构造含 flavor 的 snapshot → delete → restore → 断言 flavors 表与 hash 相同）+ `cargo test upsert_stores_flavors`（数据行+标记行合计 ≤ 8、truncated 行不计入粘贴、digest 保留）+ `cargo test legacy_trash_payload_without_flavors_field_parses`（旧 `payload_json` 反序列化取默认空值） |
| P-04 | R-05、D-07、S-03~S-07、S-10、S-16、K-03、K-06 | 写回全部表示 + `其他` 固定仅复制 + TIFF best-effort | `write_payload_to_clipboard`（2084）扩展为 `(payload, flavors, as_plain_text)` 并组装 `Vec<ClipboardContent>`（Html→Rtf→Text→Image→Other*）；images 用 `RgbaImage::from_raw` + `RustImageData` + `to_png`（走基座），并用 `image::codecs::tiff::TiffEncoder`（`Cursor<Vec<u8>>`）生成 TIFF → `Other("public.tiff")`（失败或 >8MB 跳过）；files 分支：**只要 `file_urls` 非空 → 一律 `set_files`**（文件优先，其他表示不写回，结果 `degraded=true`，不做 `Other("public.file-url")` 尝试）；`clipboard_paste`（5187）/`clipboard_copy`（5146）对 `kind=other` 跳过 `trigger_direct_paste`；`build_paste_result`（2207）与 `build_copy_result`（2195 一带）都增加 COPY_ONLY_TYPE 分支（**置于 Accessibility 判定之前，与 file 同级**）与"已复制（该类型仅支持复制）"文案；前端 `buildFallbackAction`（`src/lib/superclip.ts:673`）同样补 other 分支且**置于 `!fallbackPermissionTrusted && item.kind !== "file"` 判定（`superclip.ts:686`）之前**；`kind=other` 时后端跳过 `hide_popup_window`（D-13）；写入集合为空 → 不碰剪贴板、返回 `PAYLOAD_UNSUPPORTED`（D-14） | `lib.rs`:`write_payload_to_clipboard`、`clipboard_paste`、`clipboard_copy`、`build_paste_result`；`Cargo.toml`（image tiff feature 已具备） | P-03 | 组合规则单测全过；`其他`类型返回 copy_only 且不调 osascript；失败路径返回既有错误码；**>2MB 文本仍写回截断内容（回归）** | `cargo test paste_write`（组合表：纯文本/富文本/图片/图片+TIFF/文件/文件+图片（→ 文件优先 + degraded）/其他；断言 `ClipboardContent` 序列、files 分支与降级标记）+ `cargo test paste_write` 空集合用例（→ `PAYLOAD_UNSUPPORTED`）+ 人工 V-05~V-08、V-10 |
| P-05 | R-03、D-01、D-02、S-08 | 主页类型面 | `TabId` 扩展 `richtext/link/other`；`counts` 增加三项（richtext=html+rtf）；过滤：richtext→`kind in {html,rtf}`；`MainTabNavigation` 渲染 7 chip，链接/其他计数为 0 时隐藏；`kind-meta.ts` 增加 link/other 标签与图标（lucide `Link2`、`Layers`）；`history-row.tsx` 扩展 `ClipboardKind` 联合类型与 iconMap/labelMap | `src/windows/main/MainTabNavigation.tsx`、`MainApp.tsx`、`kind-meta.ts`、`src/components/history-row.tsx` | P-03 | 5 类旧数据界面与现在一致；新类型出现时 chip 才出现；计数与列表一致 | `npm run test:frontend`（扩展 `MainTabNavigation.test.tsx`：7 chip 渲染/Hidden 规则/点击回调；`MainApp.test.tsx` 计数）+ 人工 V-08 |
| P-06 | R-04、R-05、D-05、D-07、S-09、S-10 | 详情与浮窗的类型可见性 | `superclip.ts`：`ClipboardItemDetail.flavors` 类型；`PreviewApp.tsx`：`KIND_LABELS` 增 link/other，「表示」区块（format + 体积 + 截断标记，>6 项折叠），other 类型显示"仅复制"说明；`PopupHistoryRow.tsx`/`PopupApp.tsx`：`KindIcon` 增 link/other；`kind=other` 时菜单**保留**「复制」「查看详情」「置顶」「删除」，**隐藏**「粘贴到前台应用」与「粘贴为纯文本」，默认动作映射为复制 + 行内一次性提示（D-13，1.5s 后调用既有 `hidePopup()`）；`getKindActionLabel`（`superclip.ts:1564`）补 other 分支（当前无生产调用，防未来误用）；`MainApp.tsx` 用既有 feedback Toast 显示同一文案；`src/lib/superclip.ts` 的 fallback 分支同步"仅复制"文案 | `src/lib/superclip.ts`、`src/preview/PreviewApp.tsx`、`src/popup/PopupHistoryRow.tsx`、`src/popup/PopupApp.tsx`、`src/windows/main/MainApp.tsx` | P-03、P-04 | 旧记录（无 flavors）不渲染区块；`kind=other` 菜单项与上述清单逐项一致；反馈按 D-13 可见；文案与 V-10 一致 | `npm run test:frontend`（新增 PreviewApp 表示区块用例、popup 菜单用例）+ 人工 V-09、V-10 |
| P-07 | R-06、D-08、S-11 | 排除规则覆盖新类型 | `contentKindOptions` 增加 `link`、`other`（值 = kind 字符串，与后端比较一致） | `src/components/settings-shell.tsx` | P-05 | 下拉含 7 项；选中保存后规则值正确 | `npm run test:frontend`（settings 规则表单用例断言选项）+ 人工 V-11 |
| P-08 | R-06、R-08、S-01~S-13、S-15、S-16 | 回归核验与清理 | 无产品改动；清理未用 import/死代码；跑全量门禁；确认稳态无 `osascript`/`pbpaste`/`pbcopy` 子进程（上一轮成果不回退） | `src-tauri/src/lib.rs`、`src-tauri/Cargo.toml` | P-01~P-07 | 三套命令全绿；`cargo check` 零警告；9 秒采样零子进程 | `cargo test` 全绿 + `npm run build` 成功 + `npm run test:frontend` 通过（既有 2 个 unhandled rejection 保持存在：`src/windows/main/MainApp.tsx:344/348` 的 `listen("preview:mouse-enter/leave")` 在 jsdom 下缺 `__TAURI_INTERNALS__.transformCallback`，本次不改）+ `ps aux \| grep -E "osascript\|pbpaste\|pbcopy"` 空 |

---

## ⑧ 共享验证与覆盖矩阵

**验证的分类原则**：单测覆盖确定性逻辑（判定表、过滤、截断、hash、写回组合、迁移、回收站保真）；人工验收覆盖"真实应用 flavor 组合"与视觉/交互（V-04~V-15）。V-04~V-15 依赖真实 GUI 剪贴板与前台应用切换，**无法自动化**（本机 macOS 未授予 Automation 权限，且部分场景需人手在第三方应用内复制）；本计划不把未执行的验证写成已通过。

| V ID | 验证入口 | 预期证据 |
| --- | --- | --- |
| V-01 | `cd src-tauri && cargo test` | 全绿（含新增 ~12 个用例） |
| V-02 | `npm run build` | tsc + vite 构建成功 |
| V-03 | `npm run test:frontend` | 全绿（含新增 chips/详情/菜单/设置用例） |
| V-04 | 人工：Word/备忘录 复制带格式文本 → 主页 → 粘贴回目标 | 记录标签 = HTML 或 RTF；chips「富文本」计数 +1；粘贴保留粗体/字号 |
| V-05 | 人工：截图、预览"拷贝"、照片"拷贝" → 主页 | `kind=image`（不是 文件）；粘贴到预览/备忘录/Pages 图像正常；详情「表示」列出 public.tiff 或 public.png |
| V-06 | 人工：Finder 复制 1 个与 3 个文件 → 主页 → 粘贴回 Finder | `kind=file`、文件数正确；粘贴后落盘文件可打开 |
| V-07 | 人工：Safari 地址栏与页面内链接 复制 → 主页 | `kind=link`；详情显示 URL；粘贴到文本编辑器得到 URL 文本 |
| V-08 | 人工：系统颜色面板/取色器 复制颜色 → 主页 → 粘贴到颜色输入框 | `kind=other`；详情「表示」含 `com.apple.NSColorPboardType`；粘贴回颜色框能取到同色 |
| V-09 | 人工抽查：联系人 vCard、日历事件、PDF、Safari WebArchive | 均记 `kind=other` 且有表示清单；粘贴回对应应用可得原对象（PDF 至少能粘贴到预览/文本编辑器） |
| V-10 | 人工：对 `other` 条目走两条路径——① 默认动作（设置=直接粘贴 → paste 路径）② popup 菜单「复制」（copy 路径） | 两条路径均提示「已复制（该类型仅支持复制）」且前台应用未发生粘贴；paste 路径额外要求 `error_code=COPY_ONLY_TYPE` 出现在诊断 recent_errors（`record_paste_outcome` 仅在 paste 路径调用，copy 路径不要求该证据）；popup 场景为行内一次性提示（D-13） |
| V-11 | 人工：排除规则加 content_kind=link，复制链接 | 列表不新增记录；删除规则后恢复正常 |
| V-12 | 人工：删除含 flavors 的条目 → 撤销恢复 → 再粘贴 | 恢复后条目仍在、表示清单一致、粘贴结果与删除前相同 |
| V-13 | 人工：用上一轮遗留的旧库启动（或先复制旧库文件） | 迁移到 v5 成功（`sqlite3 "$HOME/Library/Application Support/SuperClip/superclip.sqlite3" "PRAGMA user_version"` → 5；`_superclip_migrations` 含 v5 行）；旧记录可浏览/粘贴；二次重启无报错 |
| V-14 | 人工：① 复制 >1MB 的 PDF 或大 SVG flavor → 再粘贴该条目；② 先后复制两个**尺寸相同但内容不同**的 >1MB PDF | ①条目出现且 meta 标注截断；详情显示"已截断"；若该条无其他可写表示 → 提示"该条记录没有可粘贴的数据"（`PAYLOAD_UNSUPPORTED`）且剪贴板内容不变、不产生重复记录；②两条都入库（digest 保证不同内容不互相去重，D-10） |
| V-15 | 人工：连续复制 20+ 次混合类型后检查 | 无重复爆炸（hash 去重生效）、置顶/搜索/回收站/历史上限行为不变；`ps` 采样无子进程 |

**覆盖矩阵**（正向：每个 S 有设计去向 + P + V；反向：每个 P 有来源）：

| 场景 | 设计决定 | 计划项 | 验证 | 状态 |
| --- | --- | --- | --- | --- |
| S-01 文本 | 保持现状 + D-10 | P-02、P-08 | V-01、V-15 | 已覆盖 |
| S-02 富文本多表示 | D-06、D-07、D-10 | P-02、P-03、P-04 | V-01、V-04 | 已覆盖 |
| S-03 图片（含 file-url） | D-06、D-07 | P-02、P-03、P-04 | V-05 | 已覆盖 |
| S-04 文件（多个） | 保持现状 + D-07 | P-02、P-03、P-04 | V-06 | 已覆盖 |
| S-05 链接 | D-02、D-06 | P-02、P-04、P-05 | V-07 | 已覆盖 |
| S-06 其他类型 | D-03、D-04 | P-02、P-03、P-05 | V-08、V-09 | 已覆盖 |
| S-07 多表示并存 | D-06、D-10、D-11 | P-02、P-03、P-04 | V-01、V-04、V-05 | 已覆盖 |
| S-08 chips 过滤 | D-01 | P-05 | V-03、V-08 | 已覆盖 |
| S-09 详情表示清单 | D-05、D-09 | P-01、P-03、P-06 | V-03、V-09 | 已覆盖 |
| S-10 其他类型仅复制 | D-07 | P-04、P-06 | V-10 | 已覆盖 |
| S-11 排除规则类型 | D-08 | P-07 | V-11 | 已覆盖 |
| S-12 回收站保真 | D-04 | P-01、P-03 | V-01、V-12 | 已覆盖 |
| S-13 迁移 v5 | D-04 | P-01 | V-01、V-13 | 已覆盖 |
| S-14 多 item | 范围外（分界见 ②） | —（不进入账本） | 不验证（记录为后续事项） | 范围外 |
| S-15 超限截断 | D-11 | P-02、P-03、P-04 | V-14 | 已覆盖 |
| S-16 自写抑制 | 保持现状 + D-10 | P-02、P-04、P-08 | V-15 | 已覆盖 |

**证据缺口（E-*）**：
- E-01（转为验证期关闭的假设，带 fallback，不阻塞实施）：各真实应用的 flavor 组合未能在规划期实测（Finder/Safari 自动化权限未授予）。它只影响"主类型标签"（D-06③ 的文件/图片判别），不影响 R-01 的存储与 R-05 的写回（两者与标签无关）；D-02/D-06① 已改为只用 `public.url` 判链接，不再依赖该假设。关闭方式：V-04~V-09 实测；不符时只改 `decide_primary_kind` 一处（K-02）。另含一项需实测的边界：PDF 是否被 `get_image` 兜底读成图（→ kind=image 而非 other），见 ⑥.4 与 V-09。
- E-02（已关闭）：clipboard-rs 单 item 多表示写入行为已读源码确认（`macos.rs:180-230` 逐 flavor `setData_forType` 到同一个 `NSPasteboardItem`）。
- E-03（已关闭）：不再需要写 `Other("public.file-url")`——D-06③/D-07 已把 files 与多表示定为互斥（文件优先）；V-06 验证 Finder 落盘，V-05 验证图片场景不带文件引用。

---

## ⑨ 风险与后续（K-*）

| ID | 风险 | 影响 | 缓解/监控 | 处置 |
| --- | --- | --- | --- | --- |
| K-01 | 单条记录体积增大（flavor ≤2MB）→ 库增长更快 | 磁盘与清理耗时 | 限额 + `history_limit` + 回收站 30 天；`payload_size_bytes` 已统计 | 接受（本地开发环境） |
| K-02 | 个别应用 flavor 组合使主类型标签不符直觉 | 用户看到"文件"而期望"图片"等 | D-06 规则表 + V-04~V-09 实测；调整只涉及 `decide_primary_kind` 一处 | 监控 |
| K-03 | files 与其他表示同存时只能写回其中一边（基座限制，无法两边兼顾） | 另一边本次不可粘贴 | 已定则：文件优先（D-07）+ `degraded=true` 文案；V-05/V-06 实测"图片场景不带文件引用、文件场景不带其他表示"是否符合预期；不符时只改 D-06③/D-07（一处） | 已定则 + 实测确认 |
| K-04 | hash 公式变化使旧数据与新写入不互相去重 | 旧内容再复制一次会出现重复条目 | 一次性、可见、不影响正确性；迁移不重算 hash | 接受 |
| K-05 | 回收站 JSON 携带 base64 flavors 变大 | trash 表增长 | ≤2MB/条 + 30 天 + 清空回收站；`clipboard_clear` 一并清 | 接受 |
| K-06 | TIFF 附加表示增加粘贴耗时/内存 | 大图粘贴变慢 | best-effort + 编码失败跳过；仅 RGBA ≤8MB 时尝试 | 监控 |
| K-07 | 未知 flavor 语义（如 RTFD 附件）无法验证 | 粘贴可能不被目标应用接受 | 字节级还原，不做承诺；`其他`类型文案已说明"仅复制" | 接受 |
| K-08 | 读取超大 flavor 时的瞬时内存占用（基座只能 `get_buffer` 取全量，无"只看大小"API） | 复制超大对象（如几十 MB 的 PDF）时监控线程内存尖峰 | 读完立即释放（不存库，只留 `digest`）；若实测发现卡顿，可改为按 `format` 白名单限制读取（一处常量表） | 监控 |

**后续事项（不进入本次范围）**：多 item 展开（S-14）；颜色→色块/HEX 解析；PDF/图片缩略图预览；flavor 级统计指标；拖拽（drag）来源区分；`其他`类型的搜索摘要优化（例如为 vCard 提取姓名）。

---

## ⑩ 资料与引用（REF-*）

- [REF-01] clipboard-rs 0.3.5 源码：`/tmp/crs035/clipboard-rs-0.3.5/src/lib.rs`（trait `Clipboard` 全 API）、`src/common.rs`（`ClipboardContent::Other`、`RustImageData::to_png/to_rgba8`）、`src/platform/macos.rs:129` 固有 `set_files`（只 writeObjects）、`:169 write_to_clipboard`（`clearContents`）、`:215` `Other` 写入、`:245 available_formats`、`:297 get_buffer`、`:317 get_image`、`:335 get_files`、`:427/442` `Other` 读写、`:462` trait `set_files`（`clear()` + `writeObjects`）。
- [REF-02] 本仓库：`src-tauri/src/lib.rs`（`migrate_database:671`、`clipboard_items:692`、`clipboard_trash:725`、`content_hash:865`、`normalize_*:1200/1246/1301/1381/1461`、`read_clipboard_snapshot:1538`、`upsert_clipboard_snapshot:1687`、`write_payload_to_clipboard:2084`、`mark_self_write_hash:2163`、`build_paste_result:2207`、`clipboard_copy:5146`、`clipboard_paste:5187`、`clipboard_delete:5303`、`restore_trash_entry:5384`、`Ok(None):5838`）、`src-tauri/Cargo.toml`。
- [REF-03] 前端：`src/windows/main/kind-meta.ts:10-14`、`MainTabNavigation.tsx:14-16`、`MainApp.tsx:142-158`、`src/components/history-row.tsx:5,31-45`、`src/preview/PreviewApp.tsx:12-18`、`src/popup/PopupHistoryRow.tsx:216-233`、`src/components/settings-shell.tsx:84-90`、`src/lib/superclip.ts:107-122`。
- [REF-04] 前置分析（类型支持面现状）：`.docs/20261012-analyze/20261012-clipboard-type-coverage.md`。
- [REF-05] `image` 0.25.10：`TiffEncoder::new(W: Write + Seek).write_image(buf, w, h, ExtendedColorType)`（`codecs/tiff.rs:515-590`）——TIFF 附加表示的实现依据。

---

## ⑪ 原型（UI 参考）

原型文件：`.docs/20261012-plan/prototype/index.html`（零依赖单文件，PC 线框帧；页面说明卡片含交互约定）。
页面清单（与 P-05/P-06/P-07 对应）：

| 原型页（stage 编号） | 对应计划项 |
| --- | --- |
| ① 主窗口·全部（7 chip + 混合类型列表） | P-05 |
| ② 主窗口·富文本筛选 | P-05 |
| ③ 主窗口·链接筛选 | P-05 |
| ④ 主窗口·其他筛选（颜色 / 联系人 / PDF） | P-05 |
| ⑤ 主窗口·无「链接 / 其他」数据时（chip 隐藏 + 空状态） | P-05 |
| ⑥ 弹窗（popup）·列表与行菜单（其他类型无"粘贴为纯文本"） | P-06 |
| ⑦ 预览浮窗·链接详情 | P-06 |
| ⑧ 预览浮窗·其他详情（仅复制） | P-06 |
| ⑨ 预览浮窗·多表示与截断标记 | P-06（S-15） |
| ⑩ 反馈·其他类型仅复制 Toast | P-04、P-06 |
| ⑪ 设置·排除规则（content_kind 含链接 / 其他） | P-07 |

共 11 页、3 个分组（主窗口类型面 / 浮窗与详情 / 设置）；与计划项是多对一关系。

开发对照方式：先读本文件 ⑥/⑦ 的机制与账本，再照原型的页面结构与说明卡片实现；原型帧尺寸为 PC 线框（1440×900），实际窗口仍为 760×540（主）/320×480（popup）/320×360（预览），尺寸与配色以 `CONTEXT.md` 与现有组件为准。

---

## ⑫ 需求门槛与设计门禁自查

- 需求理解确认：用户在上一轮分析后明确"都应该支持"，并授权 4 个问题的决定权；本次计划把全部决定写成 D-01~D-14 待其确认。
- 设计门禁：四个维度全部标记为适用并已给出结论（⑥）；无会改变架构/范围/工作量的开放决策（K-03 与 E-01 都有明确 fallback，且仅影响一处函数或一条粘贴策略）。
- 计划组织：单文件。理由：捕获、存储、UI、粘贴属于同一条纵向切片，无法独立交付（只加捕获不可见、只加 UI 无数据），不满足“分阶段可独立验收”的条件。

---

## ⑬ 实施记录（实施阶段逐项回填）

状态：P-01~P-08 已实现；V-01~V-03 已跑通，V-04~V-15 待人工实测。

| 账本项 | 状态 | 实际改动与证据 |
| --- | --- | --- |
| P-01 | 完成 | `Cargo.toml` + `base64 0.22`；`lib.rs` + `FLAVOR_*` 常量、`ClipboardFlavorPayload`/`ClipboardFlavorSummary`、`ClipboardPayloadSnapshot.flavors`（`default+skip_serializing`）、`ClipboardItemDetail.flavors`；迁移 v5（`clipboard_flavors` 表 + `_superclip_migrations` v5 行 + `PRAGMA user_version=5`）+ `ensure_trash_flavors_column` guard（`ALTER TABLE` 单独判定，避免二次启动报 duplicate column）；`get_flavor_summaries` 接入 `clipboard_get` |
| P-02 | 完成 | `read_clipboard_snapshot` → `read_clipboard_representations`（一次读全 5 家族 + `read_flavor_payloads` 注入式取数、跳过/拒绝名单、同 format 去重、单 flavor 1MB / 合计 2MB / 8 行、超限写截断行 + `digest`）；`decide_primary_kind`（D-06 六档）；`build_clipboard_snapshot` 统一构建（link 标题=host+path、other 标题/预览=显示名映射、meta 含原始 flavor 名）；`snapshot_content_hash`（覆盖写回集合、flavor 排序、截断不参与、空集合退化 format+size+digest）；`file_urls` 只在 `kind=file` 写入；旧 `normalize_*` 5 个函数删除（测试改为经 `build_clipboard_snapshot` 的薄封装） |
| P-03 | 完成 | `upsert_clipboard_snapshot` 事务内 `insert_flavor_row`；`get_flavor_records` / `get_payload_with_flavors_by_id`（详情路径不读二进制）；删除入回收站时 `encode_trash_flavor_entries`（base64）写 `flavors_json`，恢复时 `decode_trash_flavor_entries` + `snapshot_content_hash` 重算（与原文一致，测试断言） + 重插 flavor 行 |
| P-04 | 完成 | `build_write_contents`（files 优先 → Html→Rtf→Text→Image(+TIFF)→Other*，截断跳过，空集合 `PAYLOAD_UNSUPPORTED`）；`encode_tiff_bytes`（`image::codecs::tiff::TiffEncoder` + `Cursor`，失败/>8MB 跳过）；`files_take_priority` + 结果分支；`build_copy_result`/`build_paste_result` 增 `other`（COPY_ONLY_TYPE，置于 Accessibility 前）与 `degraded` 分支；`clipboard_paste` 对 `other` 不调 osascript，两条路径对 `other` 跳过 `hide_popup_window`；`set_files` 仍为文件唯一写路径。注：签名为 `(payload, as_plain_text)`（flavors 随 payload 传递，未新增参数） |
| P-05 | 完成 | `ClipboardKind` + `link`/`other`；`KIND_META`、`HistoryRow` 图标/标签；`MainTabNavigation`：常驻 全部/文本/富文本/图片/文件 + 计数>0 才显示的 链接/其他（**当前正停在该 tab 时即使计数归零也保留**，否则过滤器无法切回）；`MainApp` counts（rich = html+rtf）、`visibleItems` rich 合并过滤；⌘1–⌘5 改为 全部/文本/富文本/图片/文件、置顶移至 ⌘6（chips 从 4 个变 5 个的连带调整） |
| P-06 | 完成 | `superclip.ts`：`ClipboardFlavorSummary` + `ClipboardItemDetail.flavors` + fallback `flavors`；`buildFallbackAction` other 分支（置于权限判定前）；`getKindActionLabel` other → 仅复制；新增 `describeActionError` / `shouldSurfaceActionResult`；`PreviewApp`：KIND_LABELS link/other、表示清单（>6 折叠、截断标记、体积）、other 仅复制说明；`PopupHistoryRow`：KindIcon link/other，other 隐藏两个粘贴入口；`PopupApp`：other 默认动作走 copy + 行内 Toast + 1.5s 后 `hidePopup()`；`MainApp` 用既有 Toast 展示 `result.message` 与 `PAYLOAD_UNSUPPORTED` 文案 |
| P-07 | 完成 | `settings-shell.tsx` `contentKindOptions` 增 Link/Other（content_kind 排除规则可用新类型；后端 `snapshot_matches_rule` 直接按 kind 字符串匹配，无需额外改动） |
| P-08 | 完成 | `cargo check` 0 警告；`cargo test` 41 通过/1 ignored（含新增 14 个用例：判定表 2、flavor 2、hash 1、存储/回收站 3、写回 3、结果分支 1、迁移幂等 1、显示名 1）；`npm run build` 成功；`npm run test:frontend` 17 文件/214 用例全通过（新增 9 个：chips +2、PreviewApp 表示区 +3、popup 菜单 +2、popup 其他类型行内提示 +1、chips 条件隐藏 +1；既有 2 个 unhandled rejection 与本次无关，保持原样）；子进程扫描：仅保留 `osascript` 的两处既有用途（Accessibility 检查、直接粘贴），剪贴板读写路径无子进程。

### 实测证据（实施后）

- **V-13 已部分证实**：真库 `~/Library/Application Support/SuperClip/superclip.sqlite3` 已升到 `PRAGMA user_version = 5`，`_superclip_migrations` 含 v5 行；说明 `tauri dev` 热重启后新迁移生效。
- **新捕获链路已在真机运行**：新代码跑起来后新写入的条目（如 22:25 的「基座支持面」）均为 `kind=text` 并正常入库（既有类型零回归）。
- **待人工**：V-04~V-12、V-14、V-15。最高优先级：V-06（Finder 文件仍是 `kind=file`——若 Finder 文件复制也带可读 TIFF 图标，会被 D-06③ 判为 `image`，届时按 K-02 微调 `decide_primary_kind` 一处）、V-07（链接）、V-05（截图→图片）、V-10（其他类型仅复制反馈）。
