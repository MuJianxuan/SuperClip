# SuperClip P0 本地剪贴板核心能力提案

## 变更标识
- Change ID: `2026-04-25-superclip-p0-local-clipboard-core`
- 阶段: `spec`
- 来源文档:
  - `output/superclip-prd.md`
  - `output/superclip-architecture.md`
  - `output/superclip-uiux.md`

## 背景
SuperClip 的三份核心文档已确认通过。当前需要把已冻结的产品、架构与 UI/UX 方案，收敛为可执行的变更提案与任务分解，作为后续前端优先实现的唯一治理入口。

本提案服务的核心问题是：
- 用户需要一个 **本地、快、稳、键盘优先** 的剪贴板历史工具，而不是重量级内容管理器。
- P0 不追求“所有应用都 direct paste 成功”，而追求 **主链路稳定 + 失败可回退 + 异常可诊断 + 恢复可自洽**。
- 实现阶段必须严格遵守已确认的边界：不做云同步、不做 AI、不承诺 file direct paste、不把 P1 密度类设置暴露到首版 UI。

## 提案目标
1. 落地一个可运行的 P0 主链路：监听 -> 入库 -> 搜索 -> 选中 -> `direct_paste` / `copy_only`。
2. 落地一个受控的宿主壳体：菜单栏 popover、设置窗口、权限引导、回退窗口为同一交互体系。
3. 落地一个可排障的本地系统：错误码、诊断导出、恢复模式、失败注入路径全部有文档对应实现出口。
4. 把实现风险控制在文档已定义的关闭标准内，不在开发阶段偷偷扩 scope。

## P0 范围
### In Scope
- 菜单栏常驻与全局快捷键唤起
- 剪贴板监听、去重、归一化、SQLite 持久化、FTS 搜索
- 历史列表、搜索高亮、置顶、删除、删除后撤销、清空历史
- `text / html / rtf / image / file` 五类内容的预览与动作边界
- `direct_paste` / `copy_only` 双动作模型与自动回退
- Accessibility 权限检查、权限引导、权限缺失降级
- 登录启动、启动时自动显示、多显示器定位与回退窗口
- 设置页、排除规则、诊断导出、恢复模式

### Out of Scope
- 云同步、远程服务、多人协作
- AI 总结 / AI 搜索 / OCR
- 文件 direct paste 承诺
- 批量置顶
- P1 密度类设置 UI 暴露

## 方案摘要
### 1. 宿主与分层
- 使用 `Tauri 2 + Rust + React + Vite + SQLite`。
- Rust 负责监听、归一化、持久化、粘贴编排、权限与系统集成。
- 前端负责 popover / settings / permission-guide 三类视图与状态反馈。

### 2. P0 主链路
- `Clipboard Monitor` 捕获变更后进入 `Clipboard Normalizer`。
- 归一化结果进入 `Repository + FTS`。
- 用户从 `tray-popover` 搜索、选中并执行动作。
- `Paste Orchestrator` 根据类型、权限、目标兼容性选择：
  - direct paste
  - degrade（如 rich text -> plain text）
  - fallback copy-only

### 3. 风险控制
- `text` 是 direct paste 强承诺基线。
- `html / rtf / image` 采用 best-effort，但必须有可理解的 degrade / fallback。
- `file` 固定为 `copy_only`。
- 任一系统集成失败都必须回退到仍可搜索 / 浏览 / 复制的壳体。

### 4. 可观测性
- 所有关键路径写结构化日志。
- `paste-failed`、`window-fallback-used`、`startup-integration-failed`、`migration-state-changed` 等事件都必须进入诊断导出映射。
- 恢复模式下所有写操作统一返回稳定错误码。

## 交付出口
本变更完成时，至少要满足：
1. 文档中的 P0 风险关闭验收门全部可验证。
2. PRD 场景验收矩阵中的关键场景具备最低证据。
3. 前端实现与 `output/superclip-uiux.md` 冻结规范一致。
4. 后端实现与 `output/superclip-architecture.md` 的 IPC / 数据模型 / 错误码契约一致。

## 风险与守护栏
- 不允许为了追求少量应用的 direct paste 特例而污染 P0 架构。
- 不允许在 UI 中偷偷暴露未冻结的 P1 设置项。
- 不允许只做 happy path 而忽略权限缺失、窗口回退、恢复模式与诊断导出。
- 不允许进入编码后再回头重写基础契约；如发现架构变化，先回改 `output/*-architecture.md`。

## 下一步
- 依据 `tasks.md` 进入前端优先实施，但每个阶段都要回看已确认的三份核心文档。
