# SuperClip Super Dev 工作流契约

## 文件用途
本文件是 Super Dev 在本仓库的显式 bootstrap contract。后续进入或恢复 Super Dev 流程时，应先读取本文件、`.super-dev/SESSION_BRIEF.md`、`.super-dev/pipeline-state.json`、`output/*` 与当前 active change，再决定阶段动作。

## 状态来源
- 本文件由 2026-04-26 的仓库状态补齐生成。
- 依据文件：
  - `AGENTS.md`
  - `.agents/skills/super-dev/SKILL.md`
  - `.super-dev/changes/2026-04-25-superclip-p0-local-clipboard-core/proposal.md`
  - `.super-dev/changes/2026-04-25-superclip-p0-local-clipboard-core/tasks.md`
  - `output/superclip-research.md`
  - `output/superclip-prd.md`
  - `output/superclip-architecture.md`
  - `output/superclip-uiux.md`
  - `.docs/quality/*`

## 流程链
Super Dev System Flow Contract:

```text
research -> docs -> docs_confirm -> spec -> frontend -> preview_confirm -> backend -> quality -> delivery
```

约束：
- `DOC_CONFIRM_GATE` 必须存在。
- `PREVIEW_CONFIRM_GATE` 必须存在。
- 三份核心文档确认前不得创建 `.super-dev/changes/*`。
- 预览确认前不得把前端阶段视为完成。
- UI 实现必须遵守 `output/superclip-uiux.md` 冻结的图标库、字体系统、design token system、组件生态和页面骨架。
- 架构或 API 契约变化必须先更新 `output/superclip-architecture.md`，再调整 spec/tasks/实现。
- 质量或安全返工必须先修复问题，重跑 quality gate，刷新交付证据。

## 当前 active change
- Change ID: `2026-04-25-superclip-p0-local-clipboard-core`
- Proposal: `.super-dev/changes/2026-04-25-superclip-p0-local-clipboard-core/proposal.md`
- Tasks: `.super-dev/changes/2026-04-25-superclip-p0-local-clipboard-core/tasks.md`
- 当前阶段: `quality`
- 下一关口: `delivery`

## 已完成阶段
- `research`: 已产出 `output/superclip-research.md`。
- `docs`: 已产出 `output/superclip-prd.md`、`output/superclip-architecture.md`、`output/superclip-uiux.md`。
- `docs_confirm`: 已进入 spec，说明三份核心文档已被视为确认通过。
- `spec`: 已产出 proposal/tasks。
- `frontend`: M1 UI 壳体可交互已完成。
- `preview_confirm`: 已通过。
- `backend`: SQLite/FTS、clipboard monitor、direct paste orchestrator、diagnostics 和恢复模式路径已完成 P0 实现。

## 当前实现状态
- 前端构建已通过：`npm run build`。
- Rust/Tauri 静态检查已通过：`cargo check`。
- 前端壳体、状态交互、设置页、权限提示、诊断导出入口、键盘操作路径已有实现。
- Rust 当前已形成真实本地剪贴板数据闭环：监听、归一化、SQLite/FTS、搜索、复制、粘贴编排和 diagnostics export 均已接入宿主路径。

## 未完成任务
验证与证据：
- 真实宿主录屏已按用户确认改为可选增强证据，不再作为 P0 quality 或 delivery 阻塞项。
- anchor 丢失 / `fallback_window`、Dock reopen、目标应用 rich text/image 反馈、登录启动首屏可用截图、结构化日志、diagnostics 样例或手工验收记录替代。
- 下一步只需执行 delivery readiness review，确认现有证据包足以支撑 P0 质量门。

## 恢复策略
恢复流程时按以下顺序执行：

1. 读取 `.super-dev/SESSION_BRIEF.md`。
2. 读取 `.super-dev/pipeline-state.json`。
3. 读取本文件。
4. 读取 active change 的 `proposal.md` 与 `tasks.md`。
5. 读取 `output/superclip-prd.md`、`output/superclip-architecture.md`、`output/superclip-uiux.md`。
6. 以 `current_phase` 为准继续，不要重启 research/docs。

## 推荐下一步
继续 `quality` 阶段 proof-pack：录屏已按用户确认改为可选增强证据。下一步执行 delivery readiness review，确认现有截图、结构化日志、diagnostics 样例和手工验收记录后进入 `delivery`。
