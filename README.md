
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

## 开发：端口

默认开发端口为 `1420`。**无参数启动会自动找下一个可用端口**，无需手动偏移：

```bash
npm run tauri dev     # 1420 被占时自动落到 1421、1422 ...（最多试 20 个）
npm run dev           # 纯前端（仅 Vite），端口规则同上
```

启动日志会说明实际端口与原因：

```
[tauri] dev server on http://localhost:1421 (端口 1420 已被占用)
```

### 显式指定端口（不漂移）

需要固定端口时用偏移，此时**严格使用**该端口，被占则直接报错，不会自动换：

```bash
PORT_OFFSET=100 npm run tauri dev    # 端口 = 1420 + 100 = 1520
npm run tauri dev -- --port-offset 100   # flag 优先级高于环境变量
```

端口解析流程：`scripts/tauri.mjs` 先定端口，再通过环境变量 `SUPERCLIP_DEV_PORT`
传给 Vite，同时用 `--config` 注入 Tauri 的 `build.devUrl`。因此 Rust 后端加载的
一定是 Vite 实际监听的端口。

### 关于「本仓库遗留的 dev server」

若某端口被**本项目**之前没退干净的 dev server 占用，启动时会给出提示（不会自动 kill）：

```
[tauri] 端口 1421 被本仓库遗留的 dev server 占用（PID 99667, cwd /…/SuperClip）。
        如需复用该端口：kill 99667 后重启；本次已另选端口。
```

识别方式：`lsof` 反查占用进程的 cwd 是否在本仓库内；cwd 不可读时改用 HTTP 探测
页面 `<title>SuperClip</title>`。