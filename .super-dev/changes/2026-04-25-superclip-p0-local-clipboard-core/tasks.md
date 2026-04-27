# SuperClip P0 本地剪贴板核心能力任务拆解

## 任务总览
- Change ID: `2026-04-25-superclip-p0-local-clipboard-core`
- 当前阶段: `quality`
- 执行策略: `frontend-first`，但所有 UI 实现必须受后端契约与 design token 约束

## Phase 1 — 工程基线与壳体准备
- [x] 盘点当前仓库真实代码结构、依赖、构建脚本与宿主配置
- [x] 锁定 Tauri / Rust / React / Tailwind / shadcn/ui 的实际版本
- [x] 建立窗口与路由壳体：`tray-popover` / `settings` / `permission-guide`
- [x] 建立共享类型层：clipboard item summary、preview meta、settings schema、error code
- [x] 建立设计 token 与主题语义映射，禁止硬编码漂移

## Phase 2 — 前端主界面骨架
- [x] 实现 `tray-popover` 双栏骨架
- [x] 实现 Header：搜索框、监听状态、权限状态
- [x] 实现左侧历史列表与选中态、高亮态、置顶态、截断态
- [x] 实现右侧详情摘要与固定功能列表
- [x] 实现 footer 快捷键提示与默认动作说明
- [x] 实现标准模式 / 紧凑模式 / 回退窗口的视觉一致性

## Phase 3 — 前端状态与交互
- [x] 接入搜索词、选中项、滚动位置的会话态恢复
- [x] 接入键盘交互：`↑ / ↓ / Enter / Cmd+Enter / Space / Delete / Esc`
- [x] 接入删除后撤销 toast
- [x] 接入 `direct_paste` 成功 / 退化 / 回退 / 权限缺失 四类反馈分层
- [x] 接入恢复模式、迁移中、权限缺失、定位回退等异常态展示

## Phase 4 — Rust 核心服务
- [x] 实现剪贴板监听与自写入去环
- [x] 实现 clipboard normalizer：text / html / rtf / image / file
- [x] 实现 SQLite schema、migrations、FTS、清理策略
- [x] 实现 `clipboard:list/search/get/copy/paste/pin/unpin/delete/restore/clear`
- [x] 实现 settings、rules、shortcut、permission、diagnostics 相关 command
- [x] 实现错误码与事件流，确保与 architecture 文档一致（P0 命令路径已覆盖；`reindex-*` 保留为后续重建索引能力事件）

## Phase 5 — 系统集成与风险关闭
- [x] 实现 Accessibility 检查与系统设置跳转
- [x] 实现登录启动更新与失败回退
- [x] 实现多显示器定位、safe area 判断与 fallback window
- [x] 实现 Dock reopen 单窗口去重
- [x] 实现 / 验证 Dock 图标默认弱化或隐藏，保持菜单栏优先入口（真实宿主截图见 `.docs/quality/screenshots/host-tauri-dock-hidden-20260426-1756.png`，唤起后主窗口仍可显示）
- [x] 实现 macOS 菜单栏 Status Item、tray 菜单与单窗口唤起
- [x] 实现系统级全局快捷键注册、解绑与窗口唤起
- [x] 实现窗口 close -> hide，保持菜单栏常驻语义
- [x] 实现 diagnostics export 固定分段与字段映射
- [x] 实现 recovery mode 只读保护与写路径拦截

## Phase 6 — 验证与证据
- [x] 建立 1000 条样本集与搜索性能验证脚本
- [x] 建立 direct paste 兼容性验证清单（Tier A / B / C / D）
- [x] 补齐 diagnostics schema 样例、宿主 smoke checklist、结构化留痕模板
- [x] 按用户确认取消真实宿主录屏硬性要求；anchor 丢失 / window fallback 可用截图、结构化日志、diagnostics 或手工验收记录替代（其余失败注入已完成，见 `.docs/quality/2026-04-26-quality-failure-injection.md`）
- [x] 按用户确认取消真实宿主录屏留存任务；菜单栏点击、tray 菜单打开设置、Dock reopen、目标应用 rich text/image 反馈、登录启动首屏改用真实 Tauri 截图、结构化日志、diagnostics 样例或手工验收记录留证
- [x] 对照 PRD 场景验收矩阵完成证据口径调整：录屏为可选增强证据，不再作为 P0 质量门阻塞项

## 关键里程碑
### M1 — UI 壳体可交互
- [x] 搜索框可聚焦
- [x] 双栏结构可渲染
- [x] 键盘路径可走通（当前已覆盖 `↑ / ↓ / Enter / Cmd+Enter / Space / Delete / Esc 收起展开态 / 清空搜索 / 关闭面板`；浏览器预览走模拟关闭）

### M2 — 本地数据闭环打通
- 复制内容后可入库、可搜索、可预览、可执行 copy-only

### M3 — direct paste 与回退闭环打通
- text 成功基线成立
- rich text / image 的 degrade / fallback 可被观察与诊断

### M4 — 风险关闭证据齐备
- 宿主集成、恢复模式、诊断导出、失败注入四类风险均有最低证据

## 阻塞条件
- 若发现已确认文档与真实依赖 / 宿主能力矛盾，先回写对应文档再继续
- 若 UI 实现需要更换 token / 组件生态 / 页面骨架，先更新 `output/superclip-uiux.md`
- 若 IPC 或数据模型需要调整，先更新 `output/superclip-architecture.md`

## 完成定义
- 构建、类型检查、测试与手工 smoke 全部通过
- 无 unused code、无未接入真实链路的伪实现
- 文档中定义的错误码、事件、状态、文案与实现一致
- 交付证据足以支撑 P0 风险关闭验收门
