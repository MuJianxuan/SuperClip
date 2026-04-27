# SuperClip P0 场景验收勾验表

## 目的
- 把 `output/superclip-prd.md` 中的 P0 场景验收矩阵映射到当前仓库内已经存在的证据产物。
- 明确哪些场景已经具备脚本 / 文档 / diagnostics 基础，哪些还缺录屏或真实宿主复测。
- 为后续 Phase 6 的手工 smoke 与交付证据打一个统一底稿。

## 当前状态定义
- `已具备基础`：代码路径、错误码、文档口径已到位，缺少最终录屏或截图。
- `部分具备`：已有脚本或清单，但仍依赖后续宿主能力或真实环境复测。
- `阻塞`：当前仓库尚未接入对应后端能力，无法形成可信证据。

## 场景勾验
| 场景 | 当前状态 | 已有证据 / 产物 | 仍需补充 |
|---|---|---|---|
| 菜单栏唤起 | 已接入代码，待真实宿主录屏 | tray icon、tray 菜单、全局快捷键和搜索框默认聚焦已实现；真实 Tauri 截图见 `.docs/quality/screenshots/host-tauri-superclip-20260426-1201.png` | 菜单栏点击过程录屏 |
| 副屏快捷键唤起 | 部分具备 | 多显示器 / safe area / fallback window 已接入宿主 placement | 副屏录屏 + 快捷键触发证据 |
| Dock reopen 去重 | 已具备基础 | 宿主 `RunEvent::Reopen` 已接入；单窗口复用逻辑已实现 | Dock reopen 录屏 + instance 日志截图 |
| Dock 图标弱化 / 隐藏 | 已具备基础 | PRD 已要求 Dock 仅作次级唤起入口；宿主侧已接单窗口语义，但仍需验证 Dock 图标是否保持弱化 / 隐藏 | Dock 显示策略截图 + 菜单栏优先入口验证 |
| 登录启动首屏 | 已具备基础 | `launchAtLogin` 真正接宿主；`showOnStartup` 设置链路已打通 | 重启 / 登录后录屏 + `presentation_reason` 证据 |
| 无 Accessibility 权限 | 已具备截图证据 | 顶部 banner、打开系统设置、copy-only 降级、diagnostics 错误码已到位；orchestrator 单测覆盖 `NO_ACCESSIBILITY`；真实 Tauri 截图显示 `Accessibility 未授权` | 未授权 direct paste 操作录屏 |
| 富文本退化粘贴 | 已具备基础 | `RICH_TEXT_DEGRADED`、warning toast、compatibility checklist 已到位 | 目标应用录屏 + diagnostics 样例 |
| 图片 direct paste 回退 | 已具备证据 | `PAYLOAD_UNSUPPORTED`、copy-only 回退、compatibility checklist 已到位；orchestrator 单测覆盖目标拒绝 payload | 目标应用录屏 + 1 秒内反馈证据 |
| 删除后撤销 | 已具备基础 | 删除 / undo toast / `UNDO_EXPIRED` 路径已实现 | 删除后撤销录屏 |
| 诊断导出取消 | 部分具备 | diagnostics 导出路径、重试 toast、文件路径复制已实现 | 真实宿主取消保存录屏 |
| 诊断导出定位失败原因 | 已具备证据 | `recent_errors`、`window_fallback_records`、`migration_summary` 已接通；后端 helper 已生成 `.docs/quality/fixtures/diagnostics-export-runtime-sample.json`，并验证脱敏字段 | 截图标注 |
| 恢复模式进入 | 已具备证据 | recovery-mode UI、写路径拒绝、diagnostics 记录已实现；migration failure 注入已输出 `MIGRATION_FAILED` 结构化日志 | 恢复模式 UI 录屏 |
| 恢复模式拒绝写操作 | 已具备基础 | `recovery-mode-blocked/*` 已写入 diagnostics | 进入恢复模式后的录屏 + diagnostics 样例 |

## 已生成的仓库内证据
- 搜索性能基线：
  - `.docs/quality/fixtures/search-benchmark-sample-1000.json`
  - `.docs/quality/search-benchmark-report.json`
  - `.docs/quality/search-benchmark-report.md`
- direct paste 兼容性口径：
  - `.docs/quality/2026-04-25-direct-paste-compatibility-checklist.md`
- diagnostics / 宿主取证底稿：
  - `.docs/quality/fixtures/diagnostics-export-sample.json`
  - `.docs/quality/2026-04-25-host-smoke-checklist.md`
  - `.docs/quality/2026-04-25-structured-log-evidence-template.md`

## 当前主要缺口
- 真实 Tauri 主窗口截图已落仓，录屏仍未落仓。
- `DB_LOCKED`、`migration fail`、diagnostics export 成功样例与写入失败后端注入已完成。
- diagnostics 导出取消仍需要在真实 Tauri 宿主中录屏，浏览器预览无法替代。
- `fallback_window` 在当前 3360 x 2100 主显示器上无法自然触发，仍需小屏 / 副屏 / 极端缩放环境补证据。
- 当前仓库内已有 schema 样例、smoke checklist 和真实宿主截图，但还不是最终 proof-pack。
