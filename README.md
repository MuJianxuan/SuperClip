
1. Main Window（主窗口，label: main）— 这是设置/管理界面
2. Popup Window（弹出窗口，label: popup）— 点击菜单栏 Tray Icon 后弹出的剪贴板历史列表
后续交互术语：
- Popup = 左键弹出的历史面板
- Tray Menu = 右键弹出的操作菜单

两种视图模式：list（列表视图）和 grid（网格视图）。

在 macOS / Tauri 的术语体系中：

- 菜单栏上的图标叫 Tray Icon（系统托盘图标，macOS 原生术语是 Status Item / Menu Bar Extra）
- 点击后弹出的那个剪贴板历史面板，在你项目里叫 Popup Window
- 另一个是 Main Window（设置窗口）

在项目中的术语：

1. Popup Window — 点击 Tray Icon 后弹出的剪贴板历史列表（主面板）
2. Preview Popover — 鼠标悬停某条记录时，在 Popup 右侧弹出的内容预览浮层

所以后续交互中：
- Popup = 历史列表主面板
- Popover = 右侧预览浮层

## 开发：端口偏移

默认开发端口为 `1420`。当多个本地 Tauri 应用同时开发时，可通过端口偏移避免冲突：

```bash
# 方式一：环境变量（推荐）
PORT_OFFSET=100 npm run tauri dev   # 端口 = 1420 + 100 = 1520

# 方式二：命令行 flag（优先级更高）
npm run tauri dev -- --port-offset 100

# 纯前端（仅 Vite，不启动 Tauri）同样支持
PORT_OFFSET=100 npm run dev         # Vite 监听 1520
```

偏移会同时作用于 Vite dev server 和 Tauri 的 `build.devUrl`，
因此 Rust 后端能正确加载偏移后的前端页面。