# SuperClip 研究纪要

## 结论
- 目标风格应对标 Maccy：轻、快、键盘优先、全部本地。
- 可吸收 Clipy 的菜单栏入口、Snippet/多类型支持。
- 可吸收 PasteBar 的本地存储、保护思路与备份意识，但不做云同步/协作/企业化。
- Tauri 2 的 tray、global shortcut、positioner、SQLite、Accessibility 足以支撑这个产品形态。
- `arboard` 只清晰覆盖 text / image；文件与富文本需要 macOS 原生 pasteboard 适配层。
- 直接粘贴需要 Accessibility 授权引导；用户已接受首启授权方案。

## 竞品要点
### Maccy
- 关键词：lightweight、keyboard-first、local、secure、native。
- 适合作为“快速搜索 + 极简列表 + 低资源占用”的参考。

### Clipy
- 关键词：menu bar、snippets、images、custom hotkeys。
- 适合作为“菜单栏入口 + 多类型历史 + 快捷键”的参考。

### PasteBar
- 关键词：unlimited history、local storage、protected collections、backup & restore。
- 适合作为“本地管理能力”和“更复杂组织思路”的参考，但不纳入本次 MVP。

## 官方能力结论
- Tauri 2 支持 tray icon、menu event、left-click 行为控制与 tray-relative window positioning。
- `@tauri-apps/plugin-global-shortcut` 适合全局唤起快速面板。
- Tauri 官方 SQL 文档与 plugin-sql 都支持 SQLite 迁移；本项目更偏向 Rust 侧自管 SQLite。
- Apple Accessibility API 提供 `AXIsProcessTrusted()` / `AXIsProcessTrustedWithOptions()`，适合作为直接粘贴权限判定依据。

## 风险与约束
- 需要避免“自己复制自己”造成的历史循环。
- 图片/文件/富文本会放大存储与预览复杂度，必须做统一规范化。
- 菜单栏富内容不适合纯原生菜单，应该用自定义 WebView popover 承载。
- 搜索必须足够快，建议提前设计 FTS 索引。

## 参考
- https://maccy.app/
- https://github.com/Clipy/Clipy
- https://github.com/PasteBar/PasteBarApp
- https://docs.rs/arboard/latest/arboard/struct.Clipboard.html
- https://docs.rs/arboard
- https://docs.rs/enigo/
- https://developer.apple.com/documentation/applicationservices/1460720-axisprocesstrusted
- https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions
- https://developer.apple.com/documentation/accessibility/accessibility-api
- https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/learn/system-tray.mdx
- https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/plugin/positioner.mdx
- https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/start/frontend/vite.mdx
- https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/plugin/sql.mdx
