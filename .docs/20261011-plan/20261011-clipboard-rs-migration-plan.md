# SuperClip 剪贴板基座替换为 clipboard-rs（I/O + 变更检测）

- 日期：2026-10-11
- 状态：已确认，待实施
- 需求目录：`.docs/20261011-plan/`

## ① 共识与目标

**问题**：SuperClip 的剪贴板读写依赖子进程组合（`osascript` / `pbpaste` / `pbcopy`）+ `arboard`，监控为 900ms 无条件轮询。稳态下每个 tick 产生约 5–6 个子进程（`lib.rs:6097`、`lib.rs:1794`）；HTML / RTF / 文件的写入需经 AppleScript 字符串转义（`lib.rs:1445` `applescript_string_literal`）。

**调用方**：SuperClip 使用者（当前处于本地开发阶段，未投入使用）。

**目标**：用上游 Rust crate `clipboard-rs 0.3.5` 替换剪贴板 I/O 与变更检测，保持其余架构与用户可观察行为不变。

**成功标准**：

| ID | 可验收结果 |
| --- | --- |
| R-01 | 五类格式（text / html / rtf / image / file）的读取与写入全部由 `clipboard-rs` 在进程内完成 |
| R-02 | 监控改为 changeCount 事件驱动（500ms 间隔）；空闲稳态无 `osascript / pbpaste / pbcopy` 子进程 |
| R-03 | 现有用户可观察行为 1:1 保持：捕获顺序、SHA-256 去重、自写抑制、排除规则、启动首读、暂停/恢复、direct paste / copy-only、错误码字符串（D-10 明示的 changeCount 起始窗口除外） |
| R-04 | `cargo test`、`npm run build`、`npm run test:frontend` 全绿 |
| R-05 | 清空本地数据后，空库启动与端到端流程正常 |

**范围外（本次不做）**：DB schema / 迁移 / FTS 搜索、排除规则逻辑、多窗口 UI、主题、快捷键、权限链路；`frontmost_app_bundle_id`（`lib.rs:1784`）仍走 osascript；`trigger_direct_paste` 与 Accessibility 检查仍走 osascript；不引入 Node sidecar；不使用 `cankao/clipboard` npm 包本身（Tauri 运行时无 Node，napi 插件不可链接）。

## ② 范围边界（场景与边界账本 S-*）

| ID | 参与者/触发 | 前置条件与输入 | 目标结果 | 失败与关键边界 | 状态与依据 |
| --- | --- | --- | --- | --- | --- |
| S-01 | 用户复制纯文本 | 任意应用 | `kind=text` 入库；可从历史 direct/copy-only 粘贴 | 空文本不记录；来源仍取 frontmost | 目标变化：读取/写入改进程内（D-01） |
| S-02 | 用户复制富文本 | 浏览器 / 邮件等 | `kind=html`（plain 注入）；粘贴保持格式 | 无 plain 时 `strip_html_tags`；2MB 截断（`TEXT_PAYLOAD_LIMIT_BYTES`） | 目标变化（D-01） |
| S-03 | 用户复制 RTF | TextEdit / Pages | `kind=rtf`；粘贴保持格式 | 无 `{\rtf` 前缀不记录（`normalize_rtf_snapshot`） | 目标变化（D-01） |
| S-04 | 用户复制图片 | 任意应用（含仅 TIFF flavor 来源） | `kind=image`（raw RGBA + w/h）；可粘贴 | >8MB 截断仅存预览；>360px 存缩略图；写回为 PNG（K-01/K-02） | 目标变化（D-01） |
| S-05 | Finder 复制文件 | 单/多文件（中文/空格路径） | `kind=file`（路径数组）；粘贴写出双 flavor | 路径已不存在时被过滤，全部无效报 `PASTEBOARD_WRITE_FAILED`（D-06 接受） | 目标变化（D-01、D-06） |
| S-06 | 应用启动时剪贴板已有内容 | 启动瞬间 | 该内容被记录为一条历史 | watcher 启动前先执行一次 tick；changeCount==0 起始窗口的首变更可能漏报（D-10 接受） | 保持现状（D-10） |
| S-07 | 暂停/恢复监控 | 用户切换监控开关 | 暂停期间不写库；恢复后立即补记当前剪贴板 | 恢复时补跑一次 tick | 保持现状 |
| S-08 | 从 SuperClip 粘贴 | 任一历史条目 | 不产生新记录（self_write_hash 命中） | 保持"写入成功后标记"的现有顺序；hash 重复插入由 DB upsert 兜底（`lib.rs:1953` 对已存在 hash 仅更新 last_seen_at） | 保持现状（D-01） |
| S-09 | 命中排除规则 | 1Password / 含"验证码"文本 / image 规则 | 不记录 | 规则缓存与判断逻辑不动（`snapshot_is_excluded`） | 保持现状 |
| S-10 | 恢复模式 | DB 打开失败 | 只读运行；监控 tick 早退 | 不动 | 保持现状 |
| S-11 | 无 Accessibility 权限 | 系统未授权 | 粘贴降级 `copy_only` | direct paste / AX 检查仍走 osascript，不改 | 保持现状 |

## ③ 现状与证据

### 当前行为（`src-tauri/src/lib.rs`）

- 监控：`start_clipboard_monitor`（`lib.rs:6097`）循环 = 立即 tick + sleep 900ms（`MONITOR_POLL_MS`，`lib.rs:34`；同一常量也被系统外观 watcher 复用，`lib.rs:3431`，替换时必须保留）。
- 读取：`read_clipboard_snapshot`（`lib.rs:1794`）顺序 = frontmost app（osascript）→ 文件（osascript `NSFilenamesPboardType`，缺失回退 JXA `public.file-url`）→ `pbpaste -Prefer txt` → HTML（osascript）→ `pbpaste -Prefer rtf` → arboard 图片。典型文本复制路径 spawn 5–6 个子进程/tick。
- 写入：`write_payload_to_clipboard`（`lib.rs:2357`）= `pbcopy`（文本）| arboard（图片）| AppleScript 写 NSPasteboard（HTML/RTF）| AppleScript 双 flavor 写文件（`lib.rs:1594`）。
- 图片存储：raw RGBA8 + 宽高（`normalize_image_snapshot`，`lib.rs:1377`）；8MB 上限；>360px 存 rgba8 缩略图（`build_image_preview_extra_json`，`lib.rs:1333`）。
- 文件存储：路径数组（`normalize_file_snapshot`，`lib.rs:1297`），`text_plain` = 路径按行拼接。
- tick 语义：去重 / 自写抑制 / 排除规则 / 恢复模式早退（`process_clipboard_monitor_tick`，`lib.rs:6005`）；监控开关（`monitor_toggle`，`lib.rs:5369`）。
- DB 路径：`~/Library/Application Support/SuperClip/superclip.sqlite3`（`default_database_path`，`lib.rs:639`）。

### 关键证据

| 证据 | 结论 |
| --- | --- |
| 上游 `clipboard-rs 0.3.5` 与 `cankao/clipboard` vendored fork 对比（忽略空白） | `common.rs` 零语义差异；macOS 仅 2 处语义差：fork 将 `general_pasteboard()` 改为可失败路径（返回 Err）、fork 删除 `new_with_interval`（固定 500ms）。上游 API 更全，选上游（D-03） |
| `src-tauri/Cargo.lock` | 已有 `image 0.25.10`、`objc2 0.6.4`、`objc2-app-kit 0.3.2`；`clipboard-rs 0.3.5` 要求 `image ^0.25.5`、`objc2 ^0.6.3`，可统一；`rustc 1.93` ≥ 1.67 |
| 命名 NSPasteboard 实验（osascript 探针，2026-10-11） | `writeObjects(NSURL)` 自带 `NSFilenamesPboardType` + `public.file-url` + `Apple URL pasteboard type`，且与 `setPropertyList` 任意顺序均保留 → `clipboard-rs set_files` 与现状双 flavor 写等价，无需自定义 objc2 写入 |
| 本机 arboard 3.6.1 源码 | macOS 读图片仅 `dataForType(NSPasteboardTypeTIFF)` → image crate 解码 → `into_rgba8()`；写图片走 NSImage `writeObjects` |
| 上游 `clipboard-rs` macOS 后端 | `get_image` 先 PNG、后 `NSImage.TIFFRepresentation`（需 image `tiff` feature）；`set_image` 写 PNG；`set_files` 过滤不存在路径、全无效报错；watcher 默认 500ms 轮询 `changeCount` |
| 测试现状 | `file_urls_roundtrip_via_named_pasteboard`（`lib.rs:6753`）依赖命名 pasteboard 与将删除的函数；`large_image_snapshot_keeps_preview_payload_when_full_blob_is_truncated`（`lib.rs:6627`）使用 `arboard::ImageData` |

### 关键推断（由验证项承接）

- 图片写回格式由 NSImage（arboard）变为 PNG data（clipboard-rs）→ K-01，V-04 验证。
- 图片解码路径 PNG-first + `image` crate TIFF 解码 → 像素/alpha 可能有差异 → K-02，V-04 验证。

## ④ 已确认决策（D-*）

| ID | 问题 | 决定 | 依据 | 受影响项 | 状态 | 验证 |
| --- | --- | --- | --- | --- | --- | --- |
| D-01 | 替换范围 | 仅剪贴板 I/O + 变更检测（选项 B） | 稳态子进程开销集中在轮询 tick；替换面可封闭在剪贴板层 | S-01..S-08、P-01..P-04 | 已确认 | V-04、V-05 |
| D-02 | 验收基准 | 1:1 行为对齐 + 稳态零子进程 + 测试全绿；无已知故障 | 本地开发期，无故障复现清单 | R-03、R-04 | 已确认 | V-01..V-06 |
| D-03 | 技术路线 | crates.io 上游 `clipboard-rs 0.3.5`（MIT）；不 vendor fork | fork 语义差异仅 2 处，其中容错对非沙箱应用价值有限；上游 API 更全 | P-01..P-04 | 已确认 | V-01 |
| D-04 | 数据兼容 | 不需要；重构后直接清理本地数据 | 项目未投入使用，处于本地开发阶段 | P-06 | 已确认 | V-09 |
| D-05 | 非目标 | DB/迁移/FTS/排除规则/UI/主题/快捷键/权限链路不动 | 控制变更面 | 范围外清单 | 已确认 | V-01、V-07 |
| D-06 | 文件被删后的写回 | 接受库行为：过滤不存在路径；全无效报 `PASTEBOARD_WRITE_FAILED` | 更合理；前端不消费该错误码，仅走现有失败提示 | S-05、P-03 | 已确认 | V-04 |
| D-07 | 检测间隔 | 500ms（库默认） | 每次轮询仅一次 `changeCount` 调用，开销可忽略；捕获延迟减半 | S-06..S-08、P-04 | 已确认 | V-06 |
| D-08 | 代码组织 | 新 I/O 代码放 `lib.rs` 内新增区段，不新建模块文件 | 契合单文件后端结构，diff 集中 | P-01..P-04 | 已确认 | V-01 |
| D-09 | 计划组织 | 单文件计划 | 单一连贯重构，无多阶段交付边界 | 本文档 | 已确认 | 写后复查 |
| D-10 | changeCount==0 起始窗口 | 接受首个变更可能漏报（登录后剪贴板从未被写入的极短窗口），不做兜底 | 上游 watcher `last==0` 分支；窗口极窄；启动首读已覆盖已有内容 | S-06、K-04 | 已确认 | V-06 观察 |

**被拒绝的实质备选**：① vendor `cankao/clipboard` 的 fork 源码（多一份自维护成本，收益仅为粘贴板容错）；② Node sidecar 使用 npm 包（运行时无 Node、体积与 IPC 成本不成比例）；③ 自定义 objc2 全文写入（探针证明 `set_files` 已等价，不需要）；④ 保持 900ms 轮询（被 D-07 取代）。

## ⑤ 实现设计对齐

| 维度 | 状态 | 判断依据 | 处理 |
| --- | --- | --- | --- |
| 核心主链路 | 适用 | 监控触发方式、读写实现改变 | 本文档 ⑥ 展开，P-02..P-04 |
| 数据存储与表设计 | 不适用 | schema/迁移不改；存储格式不变（raw RGBA / 路径数组）；D-04 授权清库 | 跳过；不做迁移设计 |
| 接口设计 | 不适用 | 无 IPC/事件/返回结构变化；错误码字符串保持 | 跳过；不新增命令与事件 |
| 实现逻辑与非功能 | 适用 | 线程模型、依赖与 feature、错误映射、回滚 | 本文档 ⑥ 与 ⑨ 展开 |
| 安全与权限 | 不适用（保持现状） | clipboard-rs 进程内读写不新增 TCC/entitlement；Accessibility 检查与 direct paste 保持 osascript；非沙箱应用访问剪贴板无需额外授权 | 跳过；P-03 只替换实现，权限语义不变 |
| 发布兼容 | 不适用（无契约变化） | 无 IPC/事件/数据格式变化；依赖版本可统一（image 0.25.10 / objc2 0.6.4 已在树内）；部署目标与签名配置不变 | 跳过；V-02、V-03 回归确认 |

## ⑥ 推荐设计

### 读取链（事件驱动 + 进程内读取）

```
Watcher 线程（clipboard-rs, changeCount 轮询 500ms）
  │ on_clipboard_change
  ▼
process_clipboard_monitor_tick(app)          ← lib.rs:6005，逻辑不变
  │ read_clipboard_snapshot()                ← 进程内，替换 5–6 个子进程
  │   1 file   get_files() → 路径数组
  │   2 html   get_html() + get_text()（plain 注入）
  │   3 rtf    get_rich_text()
  │   4 text   get_text()
  │   5 image  get_image() → to_rgba8() → raw RGBA + w/h
  ▼
去重 / 自写抑制 / 排除规则 → SQLite upsert → emit history-updated
```

### 写入链（进程内写入，命令与事件契约不变）

```
clipboard_paste / clipboard_copy（签名、错误码、事件不变）
  │ write_payload_to_clipboard(payload, as_plain_text)   ← lib.rs:2357
  │   text  → set_text
  │   html  → set([Text(plain), Html(html)])      ← 单 NSPasteboardItem 原子写
  │   rtf   → set([Rtf(rtf), Text(plain)])
  │   image → RgbaImage::from_raw(w,h,bytes) → DynamicImage::ImageRgba8
  │           → RustImageData::from_dynamic_image → set_image（PNG）
  │   files → set_files(paths)                    ← AppKit 自动带出双 flavor
  │ mark_self_write_hash（保持现状：写入成功后标记）
  ▼
osascript Cmd+V（trigger_direct_paste，不变）
```

### 状态迁移与不变量

- 启动：watcher 启动前先执行一次 tick（等价现状"首轮即读"）。
- 暂停：handler 内 tick 早退（事件仍被消费）；恢复：`monitor_toggle` 置位后 spawn 一次 tick（等价现状"下一轮轮询"）。
- 不变量：捕获优先级 file → html → rtf → text → image；`content_hash` 计算输入不变（文件=JSON(路径数组)、图片=`WxH`+raw bytes、HTML/RTF=normalized plain + 原文）；`self_write_hash` 单次消费；恢复模式只读。

### 失败路径

- 读取失败/空剪贴板：clipboard-rs 各 `get_*` 失败按该格式缺失处理（与现状 arboard 图片分支一致，整体返回 `Ok(None)`）；`Result<...>` 外层 Err 保留为防御性分支，不新增错误码。
- 写入失败：统一映射 `PASTEBOARD_WRITE_FAILED`；空负载仍 `PAYLOAD_UNSUPPORTED`。
- watcher 生命周期：进程退出即结束，不新增 shutdown 逻辑。
- watcher 初始化/启动失败：写 `recent_errors`（`MONITOR_WATCHER_UNAVAILABLE`）并退化为进程内 900ms 轮询（复用 `MONITOR_POLL_MS`），保证监控不静默停摆。

### 兼容 / 迁移 / 回滚

- 迁移：无。D-04 授权直接删除本地 DB（`~/Library/Application Support/SuperClip/superclip.sqlite3` 及 `-wal` / `-shm`）。
- 回滚：开发期不加 feature flag；`git revert` 即可；数据层无变更，回滚无迁移成本。

## ⑦ 实施账本（P-*）

编译顺序约束：每一项结束时 `cargo check` 必须通过；辅助函数只在其最后一个调用点消失的同一项内删除。

| ID | 来源 | 目的与变更内容 | 实现逻辑 | 关联文件/符号 | 依赖 | 完成判据 | 验证方式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | D-01、D-03、D-08 | 引入依赖与骨架：`+clipboard-rs = "0.3.5"`、`+image = { version = "0.25.5", default-features = false, features = ["tiff"] }`；建立原生 I/O 区段与 handler 类型（arboard 暂留，移除见 P-03） | `Cargo.toml` 增加依赖（image 的 tiff feature 与 clipboard-rs 的 png/jpeg feature 合并，供 TIFF 回退解码）；`lib.rs` 把 `use arboard::{Clipboard, ImageData}` 改为 `use arboard::{Clipboard as ArboardClipboard, ImageData}`（避免与 `clipboard_rs::Clipboard` trait 同名 E0252），同步把 `lib.rs:2373` 的 `Clipboard::new()` 改为 `ArboardClipboard::new()`；加 `use clipboard_rs::{Clipboard, ClipboardContext, ClipboardContent, ClipboardHandler, ClipboardWatcher, ClipboardWatcherContext, RustImageData}`、`use clipboard_rs::common::RustImage`（`from_dynamic_image` 是 trait 方法，crate 根未重导出）、`use image::{DynamicImage, RgbaImage}`；新增 `ClipboardMonitorHandler { app: AppHandle }` 定义与区段注释。边界：不新增/不改任何 IPC 命令与事件；本项保持可编译（arboard 引用仍在使用） | `src-tauri/Cargo.toml`、`lib.rs:1`、`lib.rs:2373` | — | `cargo check` 通过；clipboard-rs 单一版本 | `cd src-tauri && cargo check` 通过；`cargo tree -i clipboard-rs` 单版本 |
| P-02 | D-01、S-01..S-05、K-02 | 读取链路替换：`read_clipboard_snapshot` 改进程内读取（顺序不变）；`normalize_image_snapshot` 参数改为 `(width: usize, height: usize, bytes: Vec<u8>, source_app)`；同步适配 `large_image_snapshot_keeps_preview_payload_when_full_blob_is_truncated` 测试（同项内完成，否则编译失败）；删除仅被读路径引用的 `run_pbpaste`、`read_html_from_nspasteboard` | `ClipboardContext::new()`（每 tick 创建）→ `has/get_*` 按 file→html→rtf→text→image；`get_image()?.to_rgba8()` → `into_raw()` 与尺寸；`get_files()` 返回路径数组直接喂 `normalize_file_snapshot`；空结果返回 `Ok(None)`；各 `get_*` 失败按该格式缺失处理（等价现状图片分支），外层 `Err` 为防御性分支、不新增错误码。文件读辅助（`read_file_urls_*` 等）暂留，其最后引用（测试）在 P-05 移除后一并删除。边界：TIFF-only 来源依赖 image tiff feature；分类截断/预览逻辑不动；文件读改由 clipboard-rs 经 NSURL 读取（public.file-url），不再单独优先读 NSFilenamesPboardType（K-06 登记；探针 D 显示 plist-only 写入会自动带出 file-url） | `lib.rs:1794`、`lib.rs:1377`、`lib.rs:6627`（测试签名） | P-01 | 五类内容捕获正确；受影响的单测通过 | V-01、V-04 |
| P-03 | D-01、D-06、S-01..S-05、S-08、K-01 | 写入链路替换：text/html/rtf/image/file 全走 clipboard-rs；删除仅被写入路径引用的 `write_text_with_pbcopy`、`write_html_to_nspasteboard`、`write_rtf_to_nspasteboard`；移除 `use arboard::...` 与 Cargo.toml 的 arboard 依赖（读路径与图片测试已在 P-02 改完，此时 arboard 无剩余引用）；`write_file_urls_into_pasteboard` 暂留到 P-05（测试仍引用）；`mark_self_write_hash` 保持现有调用顺序（写入成功后标记） | `set_text`；`set(vec![Text(plain), Html(html)])`；`set(vec![Rtf(rtf), Text(plain)])`；图片经 `RgbaImage::from_raw` → `DynamicImage::ImageRgba8` → `RustImageData::from_dynamic_image` → `set_image`；文件 `set_files(paths)`；`plain_text_write_target` 早退路径保留；失败映射 `PASTEBOARD_WRITE_FAILED`；调用侧（`clipboard_copy` `lib.rs:5415`、`clipboard_paste` `lib.rs:5464`）顺序不变（先写入、成功后标记；写入失败不残留 self_write_hash）。同项内移除 arboard import 与依赖。边界：无效文件路径过滤（D-06）；`as_plain_text` 分支行为不变 | `lib.rs:2357`、`lib.rs:2320`、`lib.rs:1652`、`lib.rs:1672`、`lib.rs:1`、`src-tauri/Cargo.toml`、`lib.rs:5415`、`lib.rs:5464` | P-01 | 五类粘贴成功；自写不产生新记录；无残留 arboard 引用 | V-01、V-04、V-06；`rg "arboard" src-tauri/src src-tauri/Cargo.toml` 无命中 |
| P-04 | D-01、D-07、S-06..S-08、K-04 | 变更检测替换：watcher(500ms) + handler；启动先 tick；恢复补 tick；删除 `GENERAL_PASTEBOARD_EXPR`（P-02/P-03 已移除其全部调用点） | 监控线程：先 `process_clipboard_monitor_tick(&app)`，然后 `ClipboardWatcherContext::new_with_interval(Duration::from_millis(500))` + `add_handler(ClipboardMonitorHandler{app})` + `start_watch()`（阻塞）；`impl ClipboardHandler::on_clipboard_change` 调 tick；`monitor_toggle` 置 true 后 spawn 短线程补一次 tick；`new_with_interval`/`start_watch` 失败或 watcher 线程退出时：写 `recent_errors`（`MONITOR_WATCHER_UNAVAILABLE`）并退化为进程内 900ms 轮询（复用 `MONITOR_POLL_MS`，无子进程）。保留 `run_osascript`（frontmost/AX/直贴）。边界：暂停与恢复模式早退不变；`MONITOR_POLL_MS` 保留（外观 watcher `lib.rs:3431` 仍用），仅监控线程停用；changeCount==0 首变更漏报记录为 K-04，不做兜底 | `lib.rs:6097`、`lib.rs:5369`、`lib.rs:1484` | P-02 | 复制后 ≤500ms 入库；暂停/恢复正确；空闲稳态零子进程；watcher 失败有降级路径 | V-01、V-05、V-06；代码审阅失败分支，V-09 检查正常路径不出现 `MONITOR_WATCHER_UNAVAILABLE` |
| P-05 | D-02、K-03 | 测试与清理：改写文件往返测试；删除最后一批旧辅助函数（测试是其最后引用）；清理死代码与未用 import | `file_urls_roundtrip_via_named_pasteboard`（`lib.rs:6753`）改写为基于 clipboard-rs `set_files`/`get_files` 的受控集成测试并加 `#[ignore]` + `SUPERCLIP_CLIPBOARD_IT=1` 门禁（`#[ignore]` 不豁免编译，改写须同项完成）；随后删除 `read_file_urls_from_pasteboard`、`read_filenames_from_pasteboard`、`read_file_urls_via_public_file_url`、`file_url_to_path`、`percent_decode_path`、`write_file_urls_into_pasteboard`、`applescript_string_literal`、`run_osascript_stdin`（测试改写后无剩余引用）；`cargo fmt`；`cargo clippy`（可选、非门禁） | `lib.rs:6753`、`lib.rs:1445`、`lib.rs:1455`、`lib.rs:1491`、`lib.rs:1504`、`lib.rs:1542`、`lib.rs:1559`、`lib.rs:1571`、`lib.rs:1594` | P-02、P-03、P-04 | 测试与构建全绿 | V-01、V-02、V-03、V-08 |
| P-06 | D-04、R-05 | 清空本地数据并端到端验收 | 停止应用 → 删除 `superclip.sqlite3` / `-wal` / `-shm` → 启动 → 执行人工清单 → 检查诊断导出 `recent_errors` 无新增异常码 | `lib.rs:639`（DB 路径） | P-01..P-05 | 人工清单全过；诊断无新增异常码 | V-04..V-07、V-09 |

## ⑧ 共享验证（V-*）与闭环覆盖矩阵

| ID | 验证入口 | 命令 / 步骤与预期结果 |
| --- | --- | --- |
| V-01 | 后端测试 | `cd src-tauri && cargo test` → 全绿（`#[ignore]` 项除外） |
| V-02 | 前端构建 | `npm run build` → tsc + vite 成功 |
| V-03 | 前端测试 | `npm run test:frontend` → 全绿 |
| V-04 | 五类捕获与粘贴（人工） | 依次复制：纯文本、浏览器富文本、TextEdit RTF、图片（含透明 PNG）、Finder 文件（含中文名）→ 历史出现对应 kind；从历史粘贴到 Notes/Word/Preview/Finder → 内容/格式正确；删除文件后再粘贴该条 → 走既有失败提示（D-06 接受的行为变化：旧版静默写入，新版报 `PASTEBOARD_WRITE_FAILED`，UI 无新行为） |
| V-05 | 空闲稳态零子进程 | 空闲 30s 后 `ps aux \| grep -E "osascript\|pbpaste\|pbcopy" \| grep -v grep` → 无匹配 |
| V-06 | 生命周期与竞态（人工） | 启动前先复制内容 → 启动后历史含该条（S-06）；暂停后复制 → 不记录，恢复 → 立即补记（S-07）；从 SuperClip 连续粘贴 20 次 → 无新增记录、历史顺序稳定（S-08、K-05 soak） |
| V-07 | 排除规则 | 现有单测 `cargo test exclusion_rules_persist_and_filter_snapshots` 通过；人工：复制 1Password 内容 / 含"验证码"文本 → 不记录（S-09） |
| V-08 | 受控文件往返集成 | `SUPERCLIP_CLIPBOARD_IT=1 cargo test -- --ignored` → 通过（该测试会写系统剪贴板，仅在显式门禁下运行） |
| V-09 | 空库端到端 | 按 P-06 清库后启动：历史为空、监控正常出入库；诊断导出 `runtime_state_get` / `diagnostics_export` 的 `recent_errors` 无新增异常码 |

| 场景 | 设计决定/边界 | 计划项 | 验证 | 状态 |
| --- | --- | --- | --- | --- |
| S-01、S-02、S-03 | D-01 | P-02、P-03 | V-01、V-04 | 已覆盖 |
| S-04 | D-01、K-01、K-02 | P-02、P-03 | V-04 | 已覆盖 |
| S-05 | D-01、D-06、K-03、K-06 | P-02、P-03、P-05 | V-04、V-08 | 已覆盖 |
| S-06 | 保持现状、D-07、D-10 | P-04 | V-06 | 已覆盖 |
| S-07 | 保持现状、D-07 | P-04 | V-06 | 已覆盖 |
| S-08 | 保持现状、D-01 | P-03、P-04 | V-06 | 已覆盖 |
| S-09 | 保持现状 | 无代码变更 | V-01、V-07 | 已覆盖（不适用变更） |
| S-10 | 保持现状 | 无代码变更 | V-01 | 已覆盖（不适用变更） |
| S-11 | 保持现状 | 无代码变更 | V-01、V-04 | 已覆盖（不适用变更） |
| R-01 | D-01 | P-01..P-04 | V-01、V-04 | 已覆盖 |
| R-02 | D-01、D-07 | P-04 | V-05 | 已覆盖 |
| R-03 | D-02 | P-02..P-04 | V-01、V-04..V-07 | 已覆盖 |
| R-04 | D-02 | P-05 | V-01..V-03 | 已覆盖 |
| R-05 | D-04 | P-06 | V-09 | 已覆盖 |

**闭环检查结论**：正向——范围内 11 个场景与 5 条验收标准均有设计去向、计划项与验证入口；失败/恢复/竞态路径（S-06..S-08、K-05）与读取端 flavor 差异（K-06）有承接。反向——6 个 P 项全部来源于已确认的 R/S/D/K，无范围外新增项。**证据缺口（E-*）**：无未关闭项；依赖兼容性由 Cargo.lock 核实，文件写双 flavor 由命名板实验证实。

## ⑨ 风险（K-*）与后续事项

| ID | 风险 | 影响面 | 缓解 / 回退 | 验证 | 状态 |
| --- | --- | --- | --- | --- | --- |
| K-01 | 图片写回由 NSImage 写对象变为 PNG data，个别目标应用不认 PNG | S-04 粘贴 | 仅当 V-04 不通过时评估：追加 TIFF flavor（`ClipboardContent::Other` 自定义字节）或薄 objc2 写路径；采纳前需回第 5 步对齐，不纳入本次实施 | V-04 | 已确认；由 V-04 判定，不通过启用回退 |
| K-02 | PNG-first 解码与 `image` crate TIFF 解码可能带来像素/alpha 差异 | S-04 显示与回贴 | 目视对照透明图往返；如异常，评估 TIFF 优先读取封装（需回第 5 步对齐，不纳入本次实施） | V-04 | 已确认；由 V-04 判定，不通过启用回退 |
| K-03 | 命名剪贴板文件往返测试无法自动化（clipboard-rs 仅绑定 general pasteboard） | 测试覆盖 | `#[ignore]` + 环境变量门禁的受控集成测试；人工清单覆盖 | V-08、V-04 | 已确认；由 V-08 承接 |
| K-04 | changeCount==0 时首个变更可能漏报（登录后极短窗口） | S-06 捕获 | 接受；真实出现时再用本地轮询兜底（后续事项） | V-06 观察 | 已确认（D-10 接受，不处理）；观察入口 V-06 |
| K-05 | NSPasteboard 非主线程访问面扩大（原仅 arboard 图片路径） | 稳定性 | 监控线程串行使用；连续复制/粘贴 soak | V-06 | 已确认；由 V-06 soak 判定 |
| K-06 | 读取端 flavor 覆盖变化：clipboard-rs 经 NSURL 读取文件（public.file-url），不再单独优先读 NSFilenamesPboardType | S-05 文件捕获 | 探针 D 显示 plist-only 写入会自动带出 public.file-url，风险低；若出现仅发布 NSFilenamesPboardType 的旧应用漏捕，保留 osascript 兜底或补 plist 解析（后续事项） | V-04（Finder + 第三方应用复制文件） | 已确认；由 V-04 判定 |

**范围外后续事项**：① `frontmost_app_bundle_id` 每次变更仍 spawn 1 次 osascript（如需再降可迁 objc2 `NSWorkspace`，本次不做）；② watcher shutdown 生命周期管理（进程退出即结束）；③ 若未来引入 App Sandbox，需重新评估 fork 的粘贴板容错。

## ⑩ 资料与引用

- [REF-01] crates.io `clipboard-rs 0.3.5`（MIT；Cargo.toml、`src/lib.rs`、`src/platform/macos.rs`，经 `cargo info` 获取于 2026-10-11）。支撑：D-03、P-02..P-04（API 面、image feature、watcher 500ms 默认、`set_files` 过滤行为、`set` 单 item 写语义）。
- [REF-02] `cankao/clipboard` = `@mariozechner/clipboard 0.3.9`（GitHub `earendil-works/clipboard` 本地检出；含 `src/clipboard_rs` vendored fork 与 napi 导出）。支撑：npm 层不可用于 Tauri 的结论、fork 与上游差异对比（D-03）。
- [REF-03] 命名 NSPasteboard 实验探针（osascript，2026-10-11，探针 A–D，未污染通用剪贴板）。支撑：`writeObjects(NSURL)` 自带双 flavor，`set_files` 与现状等价（P-03）。
- [REF-04] 本机 arboard 3.6.1 源码（`~/.cargo/registry/src/.../arboard-3.6.1/src/platform/osx.rs`）。支撑：现状图片读为 TIFF-only、写走 NSImage（K-01/K-02 的对比基线）。
- [REF-05] 本仓库：`src-tauri/src/lib.rs`（行号引用见 ③）、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`（依赖兼容性核实）。

## ⑪ 实施记录（2026-10-11）

| 项 | 状态 | 证据 |
| --- | --- | --- |
| P-01 | 已完成 | `Cargo.toml` +clipboard-rs 0.3.5 / +image 0.25.5(tiff)；lib.rs 导入（含 `Clipboard as ArboardClipboard` 别名）与 `ClipboardMonitorHandler` 骨架；`cargo check` 通过；`cargo tree -i clipboard-rs` 单版本 |
| P-02 | 已完成 | `read_clipboard_snapshot` 进程内读取（file→html→rtf→text→image）；`normalize_image_snapshot` 新签名 + 图片测试同项适配；删除 `run_pbpaste`、`read_html_from_nspasteboard` |
| P-03 | 已完成 | `write_payload_to_clipboard` 全走 clipboard-rs（`set_text` / `set([Text,Html])` / `set([Rtf,Text])` / `set_image` / `set_files`）；删除 pbcopy/HTML/RTF 写入辅助；移除 arboard import 与依赖；`rg arboard src-tauri/src src-tauri/Cargo.toml` 无命中 |
| P-04 | 已完成 | watcher(500ms) + handler + 启动首读 + 恢复补 tick + 失败降级轮询；删除 `GENERAL_PASTEBOARD_EXPR`；实机空闲稳态零 osascript/pbpaste/pbcopy |
| P-05 | 已完成 | 文件往返测试改写为 clipboard-rs 版并加 `#[ignore]` + 环境门禁；删除最后 8 个旧辅助函数；`cargo test --lib`：27 passed / 1 ignored |
| P-06 | 待执行 | 清库需先退出应用（DB 被运行中的应用持有）；人工清单（V-04 粘贴侧、V-06、V-07、V-09）待人工验收 |

**执行偏差与补充**：
- `cargo fmt` 未全局执行：仓库原本非 rustfmt-clean（`cargo fmt -- --check` 有 773 行既有差异），避免无关 churn；新增代码保持 rustfmt 风格。
- `cargo clippy` 未执行：当前工具链未安装 cargo-clippy（可选、非门禁）。
- 追加 `vitest.config.ts` 排除 `cankao/**`：参考克隆内的 ava 测试被 vitest 收集导致测试采集失败；排除后 17/17 文件、205/205 用例通过。剩余 2 个 unhandled rejection 来自 `MainApp.test.tsx` 的 Tauri mock（前端未改动，修正前后一致存在，属既有问题）。

**实机验证（新代码运行中）**：text / html / file / 仅 PNG flavor 的 image 四类捕获均正确入库（PNG-only 场景为旧 arboard 读 TIFF-only 会漏读的改进项）；连续 9s 三次采样无 osascript/pbpaste/pbcopy 子进程；进程无崩溃重启（V-05 通过）。

**后续（2026-10-14）**：完整性复查发现的缺口（截断表示 hash 退化、写库失败无重试、watcher 降级不可达/无退出路径、陈旧 self_write_hash、PDF 误判 image、截断信息 UI 不可见、图片写回静默失败路径、前端测试退出码）已集中修复，账本见 `.docs/20261014-plan/20261014-clipboard-rs-fix-ledger.md`；`cargo test --lib` 49 passed / 2 ignored，`npm run test:frontend` EXIT=0。P-06 清库端到端与 V-01~V-09、V-15 人工项仍待执行。

