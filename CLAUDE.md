# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

SuperClip — macOS 本地剪贴板历史管理工具，基于 Tauri 2.x (Rust 后端 + React 19 前端)。

技术栈：Rust 2021 edition / React 19 + TypeScript 5.8 / Vite 7 / Tailwind CSS 4 / SQLite (rusqlite, bundled) / arboard 3.6

## 常用命令

```bash
# 前端开发（仅 UI，无 Tauri 运行时，使用 fallback 数据）
npm run dev                    # Vite dev server, port 1420

# 完整 Tauri 开发
npm run tauri dev              # 同时启动 Vite + Rust 后端

# 构建
npm run build                  # tsc + vite build (前端产物)
npm run tauri build            # 完整 macOS .app 打包

# 测试
npm run test:frontend          # vitest run (jsdom 环境)
npm run test:rust              # cargo test --manifest-path src-tauri/Cargo.toml
npm run test                   # 前端 + Rust 全量

# 运行单个前端测试文件
npx vitest run src/hooks/useClipboardData.test.ts

# Rust 单测
cargo test --manifest-path src-tauri/Cargo.toml <test_name>

# 搜索质量基准
npm run quality:search-benchmark
```

## 架构

### 多窗口结构

应用有 3 个独立窗口，各自有独立的 HTML 入口和 React 根组件：

| 窗口 | 入口 HTML | React 根 | 用途 |
|------|-----------|----------|------|
| main | index.html | `src/windows/main/MainApp.tsx` | 主界面（列表/网格视图、设置、批量操作） |
| popup | popup.html | `src/popup/PopupApp.tsx` | 全局快捷键唤起的轻量弹窗 |
| preview | preview.html | `src/preview/PreviewApp.tsx` | hover 预览浮窗 |

Vite 通过 `rollupOptions.input` 配置多入口打包。

### 前端 → 后端通信

`src/lib/superclip.ts` 是唯一的 IPC 桥接层，封装了所有 Tauri invoke 调用。关键设计：

- `invokeOrFallback()` — 检测 `__TAURI_INTERNALS__`，在浏览器环境自动降级为内存 fallback 实现
- 所有 Tauri command 名称集中在 `COMMANDS` 对象中
- 前端可以 `npm run dev` 独立运行，无需 Rust 后端

### Rust 后端 (`src-tauri/src/lib.rs`)

单文件架构（~5200 行），核心模块：

- **AppState** — 全局状态，持有 `db`（写连接）+ `db_read`（只读连接，WAL 模式）
- **剪贴板监控** — `start_clipboard_monitor()` 以 900ms 轮询 arboard，通过 SHA-256 去重
- **SQLite + FTS5** — `migrate_database()` 管理 schema，全文搜索用 FTS5 虚拟表
- **窗口放置** — `WindowPlacementCoordinator` 处理多显示器安全区域和刘海屏适配
- **恢复模式** — 数据库打开失败时降级为内存 SQLite，标记 `is_recovery_mode`，阻止写操作
- **粘贴** — 通过 Accessibility API (osascript) 模拟 Cmd+V，file 类型固定走 copy-only

### 前端状态管理

无全局状态库，使用 React hooks + 组件 props 传递：

- `useClipboardData` — 搜索/列表数据获取，150ms debounce，监听 `history-updated` 事件自动刷新
- `useHoverPreview` — popup 窗口的 hover 预览逻辑
- `useClipboardDetail` — 按需加载单条记录的完整 payload

### UI 组件

- `src/components/ui/` — shadcn/ui 风格的基础组件（Button, ScrollArea, Switch, Tooltip 等）
- `src/components/` — 业务组件（HistoryRow, SettingsShell, StatusPill）
- 样式使用 CSS 变量实现主题切换（`--bg`, `--text-primary`, `--surface` 等）

## 关键约定

- Tauri command 注册在 `lib.rs` 的 `invoke_handler` 中，前端对应函数在 `src/lib/superclip.ts`
- 所有 Rust ↔ JS 的数据结构使用 `#[serde(rename_all = "camelCase")]`
- 前端测试使用 vitest + jsdom + @testing-library/react，setup 文件在 `src/test/setup.ts`
- 前端 fallback 数据（`superclip.ts` 中的 `fallbackItems` 等）同时用于浏览器开发和测试
- `__resetSuperClipFallbackForTests()` 用于测试间重置 fallback 状态
- Tauri 事件名：`history-updated`, `app:show-settings`, `migration-state-changed`, `recovery-mode-changed`, `monitor-status-changed`
