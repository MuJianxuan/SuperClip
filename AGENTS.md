# SuperClip 项目指南

📦 项目概述

SuperClip 是一个基于 Tauri 2.x 框架构建的 macOS 剪贴板管理工具，技术栈：

┌────────┬───────────────────────────┐
│  层级  │           技术            │
├────────┼───────────────────────────┤
│ 后端   │ Rust 2021 (lib.rs 单文件 ~5800 行) │
├────────┼───────────────────────────┤
│ 前端   │ React 19 + TypeScript 5.8 │
├────────┼───────────────────────────┤
│ 构建   │ Vite 7 + Tailwind CSS 4   │
├────────┼───────────────────────────┤
│ 数据库 │ SQLite (rusqlite, bundled)│
├────────┼───────────────────────────┤
│ 剪贴板 │ arboard 3.6 + pbcopy/osascript │
└────────┴───────────────────────────┘

---
✅ 核心功能

1. 剪贴板监控与记录 - 900ms 轮询捕获 text/html/rtf/image/file，SHA-256 去重
2. 全文搜索 (FTS5) - 搜索标题、摘要、应用来源，含高亮与匹配类型
3. 排除规则 - 按 bundle_id、content_kind、keyword 过滤敏感内容
4. 直接粘贴 - Accessibility API (osascript) 模拟 Cmd+V，无权限降级仅复制
5. 多主题 - light/dark/system 自动切换（同步 macOS NSAppearance）
6. 全局快捷键 - 默认 Cmd+Shift+V 唤起 Popup，可录制/校验冲突
7. 开机自启 - macOS autolaunch 集成
8. 多显示器适配 - 自动检测安全区域和刘海屏（WindowPlacementCoordinator）

---
🏗️ 架构

## 多窗口结构（4 个 NSPanel/Window）

| label | 入口 HTML | React 根 | 尺寸 | 唤起方式 |
|-------|-----------|----------|------|----------|
| main | index.html | `src/windows/main/MainApp.tsx` | 760×540 | Dock / QuickPanel |
| popup | popup.html | `src/popup/PopupApp.tsx` | 320×480 | Tray 左键 / 快捷键 |
| quick_panel | panel.html | `src/panel/QuickPanelApp.tsx` | 232×380 | Tray 右键 |
| preview | preview.html | `src/preview/PreviewApp.tsx` | ~320 宽 | Popup 行 hover 200ms |

popup/quick_panel/preview 使用 `tauri_panel!`（NSPanel）+ `NSVisualEffectMaterial::Menu` 磨砂。

## 前后端分层

- `src/lib/superclip.ts` 是唯一 IPC 桥：封装全部 Tauri invoke，`invokeOrFallback()` 检测 `__TAURI_INTERNALS__`，浏览器环境降级为内存 fallback（`fallbackItems`/`fallbackRules` 等），`__resetSuperClipFallbackForTests()` 供测试重置。
- 后端 `src-tauri/src/lib.rs` 单文件：AppState 持有 `db`（写连接）+ `db_read`（只读 WAL 连接）+ 各内存缓存（settings / exclusion_rules_cache / monitor_state / runtime_state）。
- `src-tauri/src/main.rs` 仅入口，`setup` 中初始化托盘、全局快捷键、各面板、监控线程。

## 前端状态

无全局状态库，React hooks + props 传递：
- `useClipboardData` — 搜索/列表，150ms debounce，监听 `history-updated` 自动刷新
- `useHoverPreview` — popup hover 预览
- `useClipboardDetail` — 按需加载单条完整 payload

---
🔄 功能链路

## 1. 捕获 → 存储链路

```
arboard 轮询(900ms, 独立线程)
  → read_clipboard_snapshot (text_html/rtf/image/file_urls)
  → content_hash (SHA-256)
  → 去重: last_seen_hash 重复跳过; self_write_hash(自身粘贴写入)跳过
  → snapshot_is_excluded(排除规则缓存) 命中则丢弃
  → upsert_clipboard_snapshot:
       hash 已存在 → 仅更新 last_seen_at
       新条目     → 事务插入 clipboard_items + clipboard_payloads;
                    清理超出 history_limit 的旧记录(保留置顶)
  → emit "history-updated" (reason: monitor_insert)
```

## 2. 搜索链路

```
clipboard_search(前端 useClipboardData 150ms debounce)
  → search_clipboard_items:
       空查询 → 直接列表(支持 kind_filter / pinned_only 组合)
       非空   → FTS5 MATCH(按 rank 排序) → 无结果/语法失败 → like_search_items 兜底
  → annotate_search_results: matchType(exact/prefix/contains/recent)
                             + matchedFields + highlightRanges
  → emit "search-results-updated"
```

## 3. 粘贴链路

```
clipboard_paste
  → 读 item + payload + content_hash
  → write_payload_to_clipboard 按类型写回系统剪贴板:
       image → arboard set_image; html → nspasteboard; rtf → nspasteboard; text → pbcopy
  → mark_self_write_hash (防止监控器把自身写入当新条目)
  → 有 Accessibility 信任且非 file → trigger_direct_paste(osascript Cmd+V)
       否则 → 降级仅复制 (copy_only)
  → mark_item_used (use_count/last_used_at)
  → build_paste_result: mode = direct_paste / copy_only, degraded 标记富文本退化
  → emit "item-updated" → hide popup
```

file 类型固定走仅复制，不承诺 direct paste。

## 4. 排除规则链路

- 三类规则：`bundle_id` / `content_kind` / `keyword`（表上 UNIQUE(kind,value) 防重复）
- command: rules_list / rules_upsert / rules_delete / rules_clear
- 启动时加载到 `exclusion_rules_cache` 内存缓存；监控 tick 先检查再入库
- 默认规则：`com.1password.1password`(bundle_id)、`验证码`(keyword)、`image`(content_kind, 禁用)

## 5. 设置链路

- settings 表 key-value：`default_action`(direct_paste/copy_only)、`theme_mode`(light/dark/system)、`history_limit`(默认 1000，最高 5000)、`show_on_startup`
- `launch_at_login` 实时查询 autolaunch（不在表内）
- settings_update → 持久化 + 内存缓存 → emit `settings-updated` → Main/QuickPanel 实时同步主题与粘贴模式
- theme_mode 同步 macOS NSAppearance（sync_vibrancy_panels_appearance）

## 6. 回收站链路

```
clipboard_delete → clipboard_trash(存 item_json + payload_json + undo_token + expires_at)
clipboard_restore → 按 undo_token 恢复
clipboard_clear → 清空回收站
```

## 7. 窗口唤起链路

- Tray 左键 / 全局快捷键 → `toggle_popup_window`（定位到托盘图标）
- Tray 右键 → `toggle_quick_panel_window`
- Dock 点击 → `handle_dock_reopen` → `show_main_window`
- `WindowPlacementCoordinator`：多显示器安全区 + 刘海屏 + 窗口位置记忆（`window_placement_refresh`）

## 8. 权限 / 快捷键 / 诊断

- `permission_check_accessibility` / `permission_open_accessibility` → accessibility_trusted 缓存
- shortcut 系列（get/start_recording/cancel/validate/update/restore_default）→ tauri-plugin-global-shortcut，冲突检测 system/app
- `runtime_state_get` + `diagnostics_export`（JSON 诊断导出，含 50 条环形 recent_errors 日志）
- 恢复模式：DB 打开失败降级内存 SQLite，只读；写操作返回 `RECOVERY_MODE_READ_ONLY`

---
🗄️ 数据库 (SQLite + FTS5, WAL, migrations 版本 4)

- `clipboard_items` — id, kind, content_hash(UNIQUE), title, preview_text, source_app, meta, is_pinned, use_count, last_used_at, payload_size_bytes, is_truncated, is_sensitive, origin_bundle_id, preview_strategy, created_at, last_seen_at
- `clipboard_payloads` — item_id(FK CASCADE), text_plain/html/rtf, image_blob, image_width/height, file_urls_json, extra_json
- `clipboard_trash` — trash_id, item_id, undo_token(UNIQUE), item_json, payload_json, deleted_at, expires_at, deleted_by_action
- `settings` — key/value/updated_at
- `exclusion_rules` — id, kind, value, enabled, UNIQUE(kind,value)
- `fts_clipboard_items` — FTS5(item_id, title, preview_text, source_app, meta, normalized_plain_text; tokenize=unicode61)

---
📡 事件总线（emit_superclip_event 包装 version + emitted_at）

- `history-updated` — 监控插入新条目（前端唯一监听，触发刷新）
- `settings-updated` — 设置变更同步
- `item-updated` — 粘贴/置顶/删除/恢复单条变更
- `search-results-updated`、`monitor-status-changed`、`migration-state-changed`、`recovery-mode-changed`、`startup-integration-failed`(开机自启写入失败)

---
⚙️ 关键常量与限额

- 监控轮询 900ms；TEXT_PAYLOAD 上限 2MB；IMAGE_PAYLOAD 上限 8MB；图片预览边 360px
- 历史保留上限默认 1000（可配最高 5000）；单次搜索/列表返回上限 5000
- 错误环形日志 50 条

---
🔧 常用命令

```bash
npm run dev                    # 纯前端 Vite (端口 1420, fallback 数据)
npm run tauri dev              # 完整 Tauri 开发
PORT_OFFSET=100 npm run tauri dev   # 端口偏移避冲突 (1420+100=1520)
npm run build                  # tsc + vite build
npm run tauri build            # 完整 macOS .app 打包
npm run test:frontend          # vitest (jsdom)
npm run test:rust              # cargo test
npm run test                   # 前端 + Rust 全量
npm run quality:search-benchmark  # 搜索质量基准
```

---
📐 关键约定

- Tauri command 注册在 `lib.rs` invoke_handler，前端对应函数在 `superclip.ts` COMMANDS 对象
- Rust ↔ JS 结构一律 `#[serde(rename_all = "camelCase")]`
- 前端测试：vitest + jsdom + @testing-library/react，setup 在 `src/test/setup.ts`
- hover/active 一律由 React state 驱动，禁止直接操作 `e.currentTarget.style`
- 交互设计基准见 `CONTEXT.md`（五个表面重设计 + 统一视觉语言），原型在 `src/prototype/variants/`