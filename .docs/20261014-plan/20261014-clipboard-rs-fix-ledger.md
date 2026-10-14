# clipboard-rs 替换完整性修复 · 改动账本

- 日期：2026-10-14
- 状态：已确认（用户 2026-10-14「按推荐处理」），实施中
- 来源：`.docs/20261011-plan/20261011-clipboard-rs-migration-plan.md`、`.docs/20261012-plan/20261012-clipboard-type-coverage-plan.md` 的完整性复查结论（A-01~A-11）
- 分析基线：HEAD `0614bfe`

## ① 共识与目标

复查发现的问题全部修复，目标是一次交付可验证的收口：

| ID | 可验收结果 |
| --- | --- |
| G-01 | 截断表示（>2MB 文本/HTML/RTF、>8MB 图片）不因 hash 退化而互相去重 |
| G-02 | 监控写库/读板失败后能自动重试，不再丢条目 |
| G-03 | watcher 非正常退出时有可观测告警与降级路径；主动退出不误报、不残留线程 |
| G-04 | 自写抑制有「写回→回读→hash 相等」的受控验证；陈旧 self_write_hash 不再吞真实复制 |
| G-05 | PDF 等被 `NSImage` 渲染的类型不再误判为 `image` |
| G-06 | 截断信息在 UI 可见（列表/浮窗/预览） |
| G-07 | 图片写回不再依赖基座 `ClipboardContent::Image` 的静默失败路径 |
| G-08 | NSFilenamesPboardType 读侧风险有实测证据闭环 |
| G-09 | `npm run test:frontend` 退出码为 0（消除既有 unhandled rejection） |

**范围外**：DB schema 迁移（复用 `extra_json`）、人工验收 V-04~V-15 与清库 P-06（需 GUI 操作，另行执行）、`frontmost_app_bundle_id` 的 osascript 移除（沿用原计划范围外清单）。

## ② 问题 → 处置对照（A-*）

| ID | 问题 | 处置 | 承接项 |
| --- | --- | --- | --- |
| A-01 | 截断 text/image 的 hash 判别力丢失（旧版用全文/全字节） | 截断表示记录全文 SHA-256 digest，hash 改用 digest | P-01 |
| A-02 | DB 写失败/读板失败后不再重试（事件驱动后无下一轮） | 失败时单飞调度一次 900ms 重试 tick | P-02 |
| A-03 | watcher 降级分支不可达、`MONITOR_WATCHER_UNAVAILABLE` 语义错位 | `catch_unwind` + 主动停止标志；退出时 drop shutdown；降级可观测 | P-03 |
| A-04 | 自写抑制缺一致性验证 | self_write_hash 见到其他 hash 即清除；新增门禁集成测试 | P-04 |
| A-05 | `get_files` 不覆盖 `NSFilenamesPboardType`（读侧未验证） | 探针已闭环：AppKit 无法写入 plist-only 板；`readObjectsForClasses([NSURL])` 可读 | 无代码改动（D-05，证据见 ③） |
| A-06 | PDF 被 `NSImage` 渲染后误判 `image` | `decide_primary_kind` 对含 `com.adobe.pdf` flavor 的输入豁免 image | P-05 |
| A-07 | 截断/丢弃信息 UI 不可见 | `ClipboardItemSummary` 增 `isTruncated`；列表/浮窗/预览渲染标记 | P-06 |
| A-08 | 基座 `set_image` 只写 PNG，`to_png` 失败静默 `Ok`（剪贴板已清空） | 自编码 PNG/TIFF，全走 `ClipboardContent::Other`，失败在写入前返回 | P-07 |
| A-09 | 基座 `set(Vec)` 中 Files 与其他表示混写互相清空 | 应用已规避（文件优先早退）+ 回归断言 | P-08 |
| A-10 | 无 shutdown 生命周期；陈旧 self_write_hash；重复复制不刷新 last_seen_at | shutdown 见 P-03；陈旧标记见 P-04；重复复制保持现状（D-08） | P-03、P-04 |
| A-11 | 前端 fallback 数据不含 link/other | 补 fallback 条目与 flavors | P-09 |

## ③ 现状证据

- HEAD `0614bfe`；`arboard` 已从 `Cargo.toml`/`Cargo.lock` 移除；剪贴板 I/O 无 `pbpaste/pbcopy/osascript`。
- 截断路径：`truncate_payload_text`（`lib.rs:1249`）、图片截断分支（`lib.rs:1664-1686`）、`snapshot_content_hash`（`lib.rs:1515-1587`）；旧版对照：`9bcb6ff^` 的 text hash 用全文（旧 `1214`）、image hash 用完整 RGBA（旧 `1388`）。
- 失败路径：`process_clipboard_monitor_tick` Err 分支（`lib.rs:6606-6614`）；watcher 启动（`lib.rs:6630-6656`）；`RunEvent` 无 Exit 分支。
- **A-05 探针（2026-10-14，JXA + 命名 NSPasteboard，未触碰通用剪贴板）**：
  - 仅调用 `setPropertyListForType(['/tmp/...a.txt'], NSFilenamesPboardType)` 写入命名板：系统自动补出 `public.file-url`、`Apple URL pasteboard type`、`dyn.*`，且 `readObjectsForClasses([NSURL])` 返回 1 条正确路径；
  - `writeObjects([NSURL × 2])`：板上同时含 `public.file-url` 与 `NSFilenamesPboardType`；
  - 结论：AppKit 写不出「只有 NSFilenamesPboardType、没有 public.file-url」的板，读侧唯一来源 `get_files()` 不会漏捕；A-05 关闭，不改代码。
- 前端未捕获 rejection：`MainApp.test.tsx` 启用 `__TAURI_INTERNALS__ = {}` 后，残留 effect 的真实 `listen` 调 `transformCallback` 失败（`MainApp.tsx:354`）。

## ④ 决策（D-*）

| ID | 决策 | 理由 |
| --- | --- | --- |
| D-01 | 截断 digest 存 `payload.extra_json.truncatedDigests.<field>`，不新增 DB 列 | 无 schema 迁移；`extra_json` 随 `payload_json` 进回收站，恢复重算 hash 可复现 |
| D-02 | 失败重试 = 单飞 900ms 一次性 tick（复用 `MONITOR_POLL_MS`） | 等价旧版「下一轮轮询」语义；不引入队列与新错误码 |
| D-03 | watcher 生命周期：退出时主动 drop shutdown；`catch_unwind` 兜 panic；仅非主动停止才告警并降级 | 让计划 P-04 的降级路径真实可达，且正常退出不误报 |
| D-04 | `self_write_hash` 在观察到不同 hash 时清除 | 避免陈旧标记吞掉后续真实复制；单次消费语义不变 |
| D-05 | A-05 以探针证据关闭，不加 plist 解析兜底 | AppKit 层面不可复现 plist-only 板；新增兜底是死代码 |
| D-06 | `com.adobe.pdf` flavor 存在（非空数据）时不判 `image`，落 `other`；此时不存 NSImage 渲染位图，写回只写 PDF 原表示 | 覆盖计划 E-01 条件判据；避免凭空造位图表示（探针证实 NSImage 可渲染 PDF） |
| D-07 | 图片写回自编码 `public.png` + `public.tiff`，全部走 `Other` | 消除基座 `to_png` 静默失败导致「剪贴板被清空但返回成功」；编码失败在 `set` 之前返回 `PASTEBOARD_WRITE_FAILED` |
| D-08 | 重复复制同一内容不刷新 `last_seen_at` | 旧版既有行为；避免列表排序与时间语义变化。本次不改，仅记录 |
| D-09 | flavor 二进制不参与 FTS 索引（仅 flavor 名经 meta 可搜） | 沿用 coverage plan D-03；数据体量大且无检索价值 |
| D-10 | `Files` 与其他表示混写的基座非原子缺陷不改基座 | 应用侧文件优先已规避；注释与既有断言防未来混写 |
| D-11 | 截断（>1MB）的 PDF flavor 保持 `image` 判定，不做豁免 | 截断后无法原样写回；若归为 `other` 会导致写回→回读 kind 不一致、自写抑制失效（详见 ⑨） |
| D-12 | 截断 digest 的哈希编码不做防伪造加固 | 无安全边界；构造碰撞需特定长文本，最坏影响为两内容互相去重（详见 ⑨） |

## ⑤ 实施账本（P-*）

编译顺序约束：每项结束 `cargo check`/`npm run build` 必须通过；测试与实现同项完成。

| ID | 来源 | 变更内容 | 关联位置 | 依赖 | 完成判据 | 验证 |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | A-01、D-01 | `build_clipboard_snapshot` 对截断的 text/html/rtf/image 计算全文 SHA-256，合并进 `extra_json.truncatedDigests`；`snapshot_content_hash` 对存在 digest 的字段改用 `digest` 标记哈希；非截断路径与旧数据（无 digest）行为不变 | `lib.rs`：`build_clipboard_snapshot`、`snapshot_content_hash`、新增 digest 合并辅助 | — | 两条前缀相同的 >2MB 文本 hash 不同；两条同尺寸 >8MB 图片 hash 不同；无 digest 的旧 payload 结果不变；回收站恢复重算 hash 与原值一致 | 单测（新增）+ `cargo test` |
| P-02 | A-02、D-02 | `ClipboardMonitorState` 增 `retry_scheduled`；tick 的读/写 Err 分支调 `schedule_monitor_retry`；辅助函数 `try_mark_monitor_retry` 可单测 | `lib.rs`：`ClipboardMonitorState`、`process_clipboard_monitor_tick`、新辅助 | P-01 无依赖，可并行 | 首次调度成功、重复调度被抑制；重试线程 900ms 后跑 tick 并释放标记 | 单测（`try_mark_monitor_retry`）+ 代码审阅 |
| P-03 | A-03、A-10、D-03 | `AppState` 增 `monitor_shutdown` / `monitor_stopping`；`start_clipboard_monitor` 注册 shutdown、`catch_unwind(start_watch)`、非主动停止才写 `MONITOR_WATCHER_UNAVAILABLE` 并进入 900ms 降级轮询；`RunEvent::Exit` 调 `stop_clipboard_monitor` | `lib.rs`：`AppState`（含 `test_app_state`）、`start_clipboard_monitor`、新 `stop_clipboard_monitor`、`app.run` 闭包 | — | `cargo check` 无警告；正常退出不写错误码；构造的 watcher 停止后降级循环可被 `monitor_stopping` 终止 | 代码审阅 + 实机（V-06）+ 诊断导出 `recent_errors` 检查 |
| P-04 | A-04、D-04 | tick 的 else 分支清除陈旧 `self_write_hash`；新增 `#[ignore]` + `SUPERCLIP_CLIPBOARD_IT=1` 门禁集成测试：text/html/image/index flavor 写回→回读→hash 相等 | `lib.rs`：`process_clipboard_monitor_tick`、tests | P-01、P-07（写路径变更后测试才成立） | 测试编译通过；显式门禁下全类别 roundtrip hash 相等 | V-05（人工执行） |
| P-05 | A-06、D-06 | `decide_primary_kind`：有非空 `com.adobe.pdf` flavor 时 image 分支不成立，落 `other` | `lib.rs`：`decide_primary_kind` | — | 合成 representations：pdf flavor + image → `other`；无 pdf → `image` | 单测（新增） |
| P-06 | A-07 | `ClipboardItemSummary` 增 `is_truncated`（`serde(default)`），`row_to_summary` 读取；前端类型加 `isTruncated`；MainListView / MainGridView / PopupHistoryRow / MainTrashView 渲染「已截断」标记；Preview 全部类型分支显示截断说明；回收站恢复保留 `is_truncated`/`payload_size_bytes` | `lib.rs`、`src/components/history-row.tsx`（仅类型）、`src/windows/main/MainListView.tsx`、`MainGridView.tsx`、`MainTrashView.tsx`、`src/popup/PopupHistoryRow.tsx`、`src/preview/PreviewApp.tsx`、`src/lib/superclip.ts` | — | 列表/网格/浮窗/回收站可见标记；图片分支同显说明；旧回收站 item_json 反序列化不失败 | 前端单测 + `cargo test` |
| P-07 | A-08、D-07 | `image` 依赖加 `png` feature；新增 `encode_png_bytes`；`build_write_contents` 用 `Other("public.png")` + `Other("public.tiff")` 替代 `ClipboardContent::Image`；移除不再使用的 `image::DynamicImage/RgbaImage`、`RustImageData` import | `src-tauri/Cargo.toml`、`lib.rs`：`build_write_contents`、新辅助 | — | 组合矩阵单测更新为 `public.png` + `public.tiff`；编码失败返回 `PASTEBOARD_WRITE_FAILED` 且不触碰剪贴板 | 单测 + `cargo test` |
| P-08 | A-09、D-10 | 文件 payload 写回组合断言（HEAD 已有 `vec![("files", 2)]` 断言，本次补基座约束注释） | `lib.rs`：`build_write_contents` 注释 | P-07 | 注释说明基座 Files 混写缺陷与应用规避 | 既有单测 |
| P-09 | A-11 | fallback 数据补 `link`、`other` 条目与 flavors；`isTruncated` 字段补齐 | `src/lib/superclip.ts` | — | 浏览器 dev 模式可见链接/其他 chip 与表示区 | 前端单测 |
| P-10 | G-09 | `MainApp.test.tsx` 启用 Tauri 运行时处补 `transformCallback`/`invoke` 桩；必要时同步其他测试文件 | `src/windows/main/MainApp.test.tsx`（按需 `useClipboardData.test.ts`/`PopupApp.test.tsx`） | — | `npm run test:frontend` 退出码 0、无 unhandled rejection | V-03 |
| P-11 | G-01~G-09 | 回填两份既有计划的实施记录指针，标注本次修复 | `.docs/20261011-plan/…`、`.docs/20261012-plan/…` | P-01..P-10 | 文档记录与代码一致 | 复查 |

## ⑥ 验证（V-*）

| ID | 入口 | 预期 |
| --- | --- | --- |
| V-01 | `cd src-tauri && cargo test` | 全绿（`#[ignore]` 项除外），新增用例通过 |
| V-02 | `npm run build` | tsc + vite 成功 |
| V-03 | `npm run test:frontend` | 退出码 0；无 unhandled rejection |
| V-04 | `cargo check` | 0 warning（unused import 等） |
| V-05 | `SUPERCLIP_CLIPBOARD_IT=1 cargo test --lib -- --ignored`（写系统剪贴板，人工授权后执行） | 文件往返 + 写回回读 hash 全类别相等 |
| V-06 | 实机：正常启停 + 空闲采样 + `diagnostics_export` | 无 `MONITOR_WATCHER_UNAVAILABLE`；退出无残留进程/线程报错 |
| V-07 | 人工验收（原计划 V-04~V-15、P-06 清库） | 逐项通过并回填原计划 |

## ⑦ 风险（K-*）

| ID | 风险 | 缓解 |
| --- | --- | --- |
| K-01 | `catch_unwind` 捕获 panic 后降级，panic 钩子仍打印堆栈 | 记录 `MONITOR_WATCHER_UNAVAILABLE`，诊断可查；不改变正常路径 |
| K-02 | PNG 自编码与基座 `to_png` 的输出可能不同（压缩级别） | 仅影响写回字节，不影响读回像素与 hash；V-05 断言 hash |
| K-03 | 截断 digest 增加一次全文 SHA-256 计算 | 仅截断时触发（>2MB/>8MB），单次 ≤数十 MB，可接受 |
| K-04 | 重试 tick 与 watcher tick 并发 | 复用既有互斥与 `content_hash UNIQUE`；与恢复补 tick 同级并发 |

## ⑧ 实施记录

| 项 | 状态 | 证据 |
| --- | --- | --- |
| P-01 | 已完成 | `merge_truncated_digests` + `snapshot_content_hash` digest 分支；新增 `truncated_representations_keep_distinct_hashes`、`truncated_digest_survives_payload_json_round_trip` 通过 |
| P-02 | 已完成 | `ClipboardMonitorState.retry_scheduled` + `try_mark_monitor_retry` + `schedule_monitor_retry`；Err 分支接入；`monitor_retry_is_single_flight` 通过 |
| P-03 | 已完成 | `monitor_shutdown`/`monitor_stopping` + `catch_unwind` + `start_clipboard_monitor_fallback` + `stop_clipboard_monitor` + `RunEvent::Exit`；`cargo check` 0 警告；实机退出验证待执行（V-06） |
| P-04 | 已完成 | tick 清除陈旧 `self_write_hash`；`paste_roundtrip_recomputes_same_hash`（`#[ignore]` + 门禁）编译通过，待 V-05 显式执行 |
| P-05 | 已完成 | `decide_primary_kind` PDF 豁免；`pdf_flavor_exempts_nsimage_rendered_image_from_image_kind` 通过；真机 V-09 待人工 |
| P-06 | 已完成 | 后端 `is_truncated` 进 summary；MainListView/MainGridView/MainTrashView/PopupHistoryRow/PreviewApp 标记与说明；回收站恢复保留 `is_truncated`/`payload_size_bytes`；前后端共 7 条断言通过 |
| P-07 | 已完成 | `image` 加 `png` feature；`encode_png_bytes` + `Other("public.png"/"public.tiff")`；写回矩阵单测更新通过 |
| P-08 | 已完成 | 文件分支独占断言与基座约束注释 |
| P-09 | 已完成 | fallback 增 link/other 条目与 flavors；`isTruncated` 示例 |
| P-10 | 已完成 | MainApp 测试补 `transformCallback`/`invoke` 桩 + `safeUnlisten`；`npm run test:frontend` 220 用例通过、EXIT=0 |
| P-11 | 已完成 | 两份既有计划追加后续指针（见文件末尾） |

**验证结果（2026-10-14）**

| 入口 | 结果 |
| --- | --- |
| `cargo check` | 0 warning |
| `cargo test --lib` | 50 passed / 0 failed / 2 ignored |
| `npm run build` | tsc + vite 成功 |
| `npm run test:frontend` | 17 文件 / 224 用例通过，EXIT=0（unhandled rejection 消除） |
| `SUPERCLIP_CLIPBOARD_IT=1 cargo test --lib -- --ignored --test-threads=1` | ✅ 2026-10-14 已执行：2 passed / 0 failed（串行避开两测试互写剪贴板）；剪贴板内容已从备份恢复 |
| 实机 V-06/V-09、P-06 清库、V-04~V-15 | 待人工 |

**A-05 探针证据（2026-10-14）**：命名 NSPasteboard 上仅 `setPropertyListForType(NSFilenamesPboardType)` 写入会自动带出 `public.file-url`/`Apple URL pasteboard type`/`dyn.*`，`readObjectsForClasses([NSURL])` 返回正确路径；反向 `writeObjects([NSURL×2])` 同时带出两种 flavor。结论：`get_files()` 读侧不会漏捕，无需兜底代码。

**未发现回归的既有行为**：重复复制同一内容不刷新 `last_seen_at`（D-08 保持现状）；flavor 二进制不入 FTS（D-09）；基座 Files 混写非原子（D-10，应用侧规避）。

## ⑨ 独立复查轮（2026-10-14 第二轮，5 个只读子代理）

**逐项结论**：P-01/P-02/P-03/P-04/P-06/P-07/P-08/P-09/P-10 的代码路径与账本一致；发现 8 项需处置的新问题，已全部在第二轮修复中处理：

| ID | 发现 | 处置 |
| --- | --- | --- |
| R-01 | 截断图片 hash 分支未含宽高，同字节异尺寸可碰撞（低） | 已修：digest 分支同样写入 `{w}x{h}`；新增宽高互换用例 |
| R-02 | `encode_png_bytes`/`encode_tiff_bytes` 长度校验用 `<`，`>` 时 image crate `assert_eq!` 会 panic（中） | 已修：改 `!=`；新增 `paste_write_rejects_malformed_image_length` |
| R-03 | tick 不检查 `monitor_stopping`，退出期重试线程仍可能写库（中） | 已修：tick 首行早退 |
| R-04 | 重试线程 spawn 失败/锁中毒使 `retry_scheduled` 永久卡死（低） | 已修：spawn 失败复位 + 锁中毒取内部值 |
| R-05 | 退出期 watcher panic 会误写 `MONITOR_WATCHER_UNAVAILABLE`（低） | 已修：fallback 入口先判主动停止 |
| R-06 | 图片截断在 Preview 图片分支无提示；网格/回收站无标记（中/低） | 已修：截断说明上提到内容区（覆盖图片）；网格卡片与回收站行补标记，`TrashEntry` 增 `isTruncated` |
| R-07 | 有完整 PDF 时仍存/写回 NSImage 渲染位图，`payload_size_bytes` 按位图计（中） | 已修：kind=other 且 PDF flavor 完整时不存位图；`payload_size_bytes` 汇总保留 flavor 数据 |
| R-08 | 账本/文档描述不实（HistoryRow、P-08 断言、测试数字）与 AGENTS.md 写回链路过期 | 已修：本节修正；AGENTS.md 写回链路同步为 PNG/TIFF `Other` |

**不采纳的复查建议（含理由）**：

| 建议 | 不采纳理由 |
| --- | --- |
| 把 PDF 豁免改为「任意 `com.adobe.pdf` flavor（含截断）」（复查方 M-1/F-01） | 探针证实 `NSImage` 可渲染 PDF（200×200 页 TIFF 2.25MB）。但 >1MB PDF 的 flavor 已被截断（data 清空），若归为 `other`，写回时 PDF 无法还原、位图又不写回 → 回读 kind 变为 `image`，与存储 hash 不一致，自写抑制失效、每次粘贴产生重复条目。当前「PDF 完整→other / PDF 截断→image」保证写回→回读 hash 闭环，已在代码注释与 `pdf_flavor_exempts...` 测试中固化 |
| 给截断图片 digest 强制防伪造编码（复查方 N-01） | 构造碰撞需要复制「`truncated-digest\0<64位hex>` 且 >2MB」的特定内容；无安全边界，最坏结果是两条内容互相去重。保持现状，登记为接受风险 |
| tick 增加 `monitor_stopping` 以外的优雅 join 退出（复查方 F-1/F-3） | 进程退出即结束，tao 在 `RunEvent::Exit` 回调后立即 `process::exit`；启动/退出竞态窗口的永久阻塞已被接受（D-03 同族） |

**复查轮验证（最终）**：`cargo check` 0 warning；`cargo test --lib` 50 passed / 0 failed / 2 ignored（含新增 `encoded_image_flavors_decode_back_to_same_pixels`）；`npm run build` 成功；`npm run test:frontend` 224 passed / EXIT=0；门禁集成 `SUPERCLIP_CLIPBOARD_IT=1 … --test-threads=1` 2 passed（text/html/image/other 写回→回读 hash 相等 + 多文件往返）。门禁运行中 CoreGraphics 的 `CGImageDestinationFinalize failed for output type 'public.tiff'` 警告来自测试写入的伪 PDF 数据触发 `NSImage` 渲染失败，非自编码 TIFF；已由 `encoded_image_flavors_decode_back_to_same_pixels` 独立验证 PNG/TIFF 编解码像素无损。

**探针证据（2026-10-14）**：命名 NSPasteboard 写 `com.adobe.pdf` 后调用 `NSImage.initWithPasteboard` → 可读，尺寸 200×200，`TIFFRepresentation` 2,250,314 字节；板上同时带出 `Apple PDF pasteboard type`（已被别名族跳过）。证实 E-01 的「PDF 被 NSImage 渲染」真实存在。
