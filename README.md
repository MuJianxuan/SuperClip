
1. Main Window（主窗口，label: main）— 这是设置/管理界面
2. Popup Window（弹出窗口，label: popup）— 点击菜单栏 Tray Icon 后弹出的剪贴板历史列表
后续交互术语：
- Popup = 左键弹出的历史面板
- Tray Menu = 右键弹出的操作菜单

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