# 08 — 全表面回归与验收

**What to build:** 对照 CONTEXT.md「Confirmed design (2026-08-03)」章节逐项验收五个表面（Popup / Preview / Main / Settings / Quick Control Panel），并做全链路回归：
- 每个表面与对应原型（B2/G2/E2/F2/D2）视觉与交互逐项核对
- 主题切换（浅 / 深 / 跟随系统）、全局快捷键、窗口拖拽、多显示器安全区域不回归
- 测试套件（Rust + 前端）全部更新并通过
- 修复验收中发现的遗留差异

**Blocked by:** 02 — Popup 重构, 03 — Preview 重构, 04 — Main 重构, 05 — Settings 分区化, 06 — Quick Control Panel, 07 — Popup 虚拟滚动

**Status:** done (committed ce573ae + 3bc5bc4)

- [ ] 五表面与原型逐项对照通过，无已知视觉/交互差异
- [ ] 主题三模式切换无破损；快捷键、拖拽、多显示器回归通过
- [ ] `cargo check` + `tsc --noEmit` + 前后端测试套件全绿
- [ ] 验收发现的差异已修复并复验
