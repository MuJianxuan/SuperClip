# SuperClip 后端 Runtime Smoke 记录

## 执行时间
- 日期：2026-04-26
- 阶段：`backend`
- 变更：`2026-04-25-superclip-p0-local-clipboard-core`

## 本轮实现范围
- 新增 SQLite 本地库：`~/Library/Application Support/SuperClip/superclip.sqlite3`
- 新增 schema / migration：`clipboard_items`、`clipboard_payloads`、`clipboard_trash`、`fts_clipboard_items`
- 启用 WAL、`busy_timeout`、FTS5 搜索表和历史上限清理
- 后台 monitor 轮询系统剪贴板，写入真实 SQLite
- 复制 / 粘贴动作写入系统剪贴板，并设置自写入去环 hash
- `clipboard:list/search/get/copy/paste/pin/unpin/delete/restore/clear` 接入 SQLite repository
- diagnostics 的 `db_health_summary` 改为读取真实 SQLite 状态

## 剪贴板适配范围
| 类型 | 当前状态 | 说明 |
|---|---|---|
| `text` | 已接入 | macOS `pbpaste` 读取，`pbcopy` 写入 |
| `rtf` | 已接入基础 | macOS `pbpaste -Prefer rtf` 读取，`pbcopy` 写入；目标退化由 UI/diagnostics 解释 |
| `image` | 已接入基础 | arboard 读取 / 写入 image payload |
| `file` | 已接入基础 | 对已存在的本地路径文本归一化为 file payload，P0 仍固定 copy-only |
| `html` | 已接入 | 通过 AppleScriptObjC 调用 macOS `NSPasteboardTypeHTML` 读取 / 写入 `public.html`，同时保留 plain text 退化字段 |

## 运行时 smoke
- 启动命令：`npm run tauri dev -- --no-watch`
- 结果：Tauri 宿主启动到 `target/debug/superclip`，未出现 panic。
- 写入测试剪贴板内容：
  - `SuperClip backend smoke 2026-04-26 SQLite FTS monitor copy-only path`
- SQLite 验证：
  - `clipboard_items` 记录数：`1`
  - 最新记录：`text | SuperClip backend smoke 2026... | System Clipboard`
  - FTS 查询 `backend` 命中：`text | SuperClip backend smoke 2026...`
- dev smoke 完成后已停止 Tauri / Vite 进程，端口 `1420` 已释放。

## HTML / NSPasteboard 复测
- 执行时间：2026-04-26 10:18 +08:00
- 启动命令：`npm run tauri dev -- --no-watch`
- 写入方式：AppleScriptObjC `NSPasteboard`，同时写入 `NSPasteboardTypeHTML` 与 `NSPasteboardTypeString`
- 写入样本：
  - HTML：`<p>SuperClip NSPasteboard HTML smoke <strong>2026-04-26 10:18</strong></p>`
  - Plain：`SuperClip NSPasteboard HTML smoke 2026-04-26 10:18`
- SQLite 验证：
  - 最新匹配记录：`html | SuperClip NSPasteboard HTML ... | has_html=1 | has_plain=1`
  - FTS 查询 `NSPasteboard` 命中 `html` 记录
- 调试结论：
  - 旧路径 `the clipboard as «class HTML»` 对 `public.html` 不稳定，会把样本落为 `text`。
  - 根因确认后已改为 `current application's NSPasteboard's generalPasteboard()` + `NSPasteboardTypeHTML`。

## 自动检查
| 检查项 | 结果 |
|---|---|
| `npm run build` | 通过 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 通过，无 warning |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 通过，3 passed |
| `npm run quality:search-benchmark` | 通过，P50=0.418ms，P95=0.521ms，max=0.938ms |
| `cargo fmt --manifest-path src-tauri/Cargo.toml` | 未执行成功，本机 stable toolchain 缺少 `cargo-fmt` |

## 仍未关闭
- 失败注入：`DB_LOCKED`、migration fail、权限撤销、anchor 丢失、导出失败、目标拒绝 payload 需要进入 `quality` 阶段补证据。
- 留存录屏 / 截图 / 结构化日志 / 真实 diagnostics 导出样例。
- 对照 PRD 场景验收矩阵完成逐项勾验。
