# SuperClip 窗口尺寸与菜单栏唤起位置重设计

## 背景与证据

当前实现中，`src-tauri/src/lib.rs` 定义了：

- `small_window`: `860x640`
- `large_window`: `980x680`
- `fallback_window`: 安全区不足时按当前显示器 work area 收缩

`src-tauri/tauri.conf.json` 的默认窗口也是 `860x640`。菜单栏点击路径进入 `show_main_window()` 后，先执行 small mode 的 `apply_window_placement()`，随后又调用 `tauri_plugin_positioner::WindowExt::move_window_constrained(Position::TrayCenter)`。

`tauri-plugin-positioner` 的 `TrayCenter` 会用 tray icon 的 rect 计算窗口位置，因此窗口会贴近 macOS 顶部菜单栏图标，而不是在显示器工作区居中。这与本次目标冲突。

## 已确认目标

- 点击 mac 顶部菜单栏图标显示主窗口时，窗口应在当前显示器 work area 居中，并避开菜单栏与 Dock。
- 应用默认窗口需要比现有 `860x640` 更大。
- 采用推荐尺寸：
  - 默认标准窗口：`960x680`
  - 大窗口：`1120x760`
- 不新增设置项，不引入用户可配置默认尺寸。
- 不改变 clipboard action、session restore、fallback window 的语义。

## 设计方案

采用方案 B：统一窗口唤起策略，保留现有 safe area clamp，但去掉 tray-relative positioning。

### 窗口模式

- `small_window` 保持 runtime mode 名称不变，避免扩大前后端类型和 session state 迁移范围；其语义调整为默认标准窗口。
- `large_window` 保持名称不变，但尺寸提升，确保小/大模式有清晰差异。
- `fallback_window` 保持现有行为：显示器安全区不足时收缩到可用范围，并记录 fallback reason。

### 定位策略

- 菜单栏左键点击：根据 tray click event 的 physical position 找到对应显示器，再在该显示器 work area 居中。
- 其他打开路径：沿用 current monitor / primary monitor fallback，但不再执行 `Position::TrayCenter`。
- 所有路径都经过 `clamp_window_position()`，避免窗口压到菜单栏、Dock 或屏幕边缘。

### 尺寸策略

- `WINDOW_SMALL_WIDTH`: `960`
- `WINDOW_SMALL_HEIGHT`: `680`
- `WINDOW_LARGE_WIDTH`: `1120`
- `WINDOW_LARGE_HEIGHT`: `760`
- Tauri 默认 window width/height 同步为 `960x680`。
- 现有 `minWidth` / `minHeight` 暂不提高，避免破坏小屏 fallback 与手动缩放。

## 验收标准

- 菜单栏左键点击主图标后，窗口出现在点击所在显示器的 work area 居中位置。
- 默认窗口明显大于原 `860x640`，为 `960x680`。
- large mode 为 `1120x760`，与默认标准窗口有可感知差异。
- 安全区不足时仍进入 `fallback_window`，并继续记录 fallback diagnostic。
- `cargo test` 与 `npm run build` 通过。

