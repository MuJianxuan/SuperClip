# Command Clean 固定窗口重构验证记录

## 验证时间

2026-04-30

## 验证范围

- 主面板 Command Clean 视觉重构。
- 设置页 Command Clean 密度重构。
- Tauri 小 / 大两档窗口模式：`small_window` 与 `large_window`。
- macOS 绿灯 / zoom 触发后的尺寸吸附逻辑。

## 自动化检查

已通过：

- `npm run build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml`

Rust 单元测试结果：9 个测试全部通过。

## 浏览器尺寸截图

已用 headless Chromium 检查固定尺寸布局：

- 小尺寸截图：`/tmp/superclip-command-clean-760x560-v7.png`
- 大尺寸截图：`/tmp/superclip-command-clean-980x680-v2.png`

小尺寸检查结论：
- 搜索框、状态、历史列表、右侧主按钮、工具区和 footer 均在首屏可见。
- 右侧详情压缩为短摘要和紧凑工具区。
- 未发现明显文字重叠。

## 真实宿主验证

已执行 `npm run tauri dev`，真实 Tauri 宿主可以启动。

受当前 macOS 权限限制，自动化宿主检查未完成：

- `screencapture` 全屏截图返回黑屏，无法作为有效视觉证据。
- `osascript` 读取 `superclip` 窗口尺寸失败，系统返回“不允许辅助访问”。

因此本轮真实宿主只确认到“宿主可启动”。绿灯点击后的真实窗口尺寸切换仍需要在本机手工点按验证，或为 `osascript` 授予 Accessibility 后复测。

## 剩余风险

- Tauri / macOS 没有直接暴露 zoom event，本实现通过 `Resized` 事件识别非目标尺寸并吸附到另一档尺寸。已经用容差处理 titlebar / inner-size 差异，但真实绿灯体验仍建议手工确认。
- 为保留绿灯可点击，配置层必须保持 `resizable: true`；“不可自由拖拽”由运行时吸附逻辑保证，而不是系统层完全禁用 resize。
