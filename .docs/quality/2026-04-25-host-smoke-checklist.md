# SuperClip P0 宿主 Smoke Checklist

## 目的
- 把 Phase 6 仍需在真实 Tauri 宿主中补齐的验收项整理为可执行的单轮 checklist。
- 统一录屏、截图、diagnostics 导出样例和结构化留痕的命名口径，避免后续证据散落。

## 适用范围
- 执行环境限定为真实 macOS + Tauri 宿主。
- 浏览器 fallback 仅可用于 UI 壳体预览，不能替代本清单中的宿主集成证据。

## 执行前准备
- 确认 `npm run build` 和 `cargo check --manifest-path src-tauri/Cargo.toml` 已通过。
- 确认当前构建为单实例运行，避免 Dock reopen 录屏被历史进程污染。
- 录屏和截图文件统一保存到后续证据目录；文件命名建议为 `phase6-<scenario>-<YYYYMMDD-HHmm>.<ext>`。

## 2026-04-26 已补宿主证据
- 真实 Tauri 宿主启动与主窗口截图已完成：`.docs/quality/2026-04-26-host-tauri-runtime-smoke.md`
- 截图文件：`.docs/quality/screenshots/host-tauri-superclip-20260426-1201.png`
- 当前环境主显示器为 3360 x 2100，`window_placement_refresh` 会稳定进入 `tray_popover`，不能自然覆盖 `fallback_window`。

## 场景清单
| 场景 | 当前可执行性 | 手工步骤 | 通过标准 | 最低留存产物 |
|---|---|---|---|---|
| 菜单栏唤起 | 可执行，已补截图 | 点击菜单栏图标，确认搜索框自动聚焦，首条历史高亮 | 面板正常展开，无第二窗口实例 | 已有 1 张搜索框焦点截图，仍需点击过程录屏 |
| 副屏快捷键唤起 | 可执行 | 把目标应用放到副屏，触发全局快捷键 | 面板优先在副屏打开；若空间不足，进入 `compact_popover` 或 `fallback_window` | 1 份副屏录屏 + 1 份 diagnostics 导出 |
| Dock reopen 去重 | 可执行 | 隐藏主窗口后从 Dock 再次打开 | 仅复用同一个主窗口壳体，不创建第二实例 | 1 份录屏 + 1 张窗口数量确认截图 |
| 无 Accessibility 权限 | 可执行 | 撤销 Accessibility 后执行 direct paste | UI 明确降级为 copy-only，并提供系统设置入口 | 1 份录屏 + 1 份 diagnostics 导出 |
| 富文本退化粘贴 | 可执行 | 在不保留富文本的目标应用执行 HTML / RTF 粘贴 | 1 秒内给出“格式未保留”反馈；`recent_errors` 可定位 | 1 份录屏 + 1 份 diagnostics 导出 |
| 图片 direct paste 回退 | 可执行 | 在不接受图片 pasteboard 的目标应用执行图片 direct paste | 自动回退 copy-only，主流程不中断 | 1 份录屏 + 1 份 diagnostics 导出 |
| 删除后撤销 | 可执行 | 删除一条历史，30 秒内点击撤销 | 条目成功恢复，排序正常 | 1 份录屏 |
| 删除后撤销超时 | 可执行 | 删除后等待恢复窗口过期，再点击撤销 | UI 提示撤销已过期；`recent_errors` 包含 `UNDO_EXPIRED` | 1 张过期提示截图 + 1 份 diagnostics 导出 |
| diagnostics 导出取消 | 可执行 | 触发导出后取消保存对话框 | 不视为系统错误，不弹高打扰失败态 | 1 份录屏 |
| diagnostics 导出失败 | 已执行（后端 helper） | 把导出目录替换为普通文件，执行后端导出 helper | 返回 `DIAGNOSTICS_EXPORT_FAILED`，命令路径会写入 `recent_errors` | `.docs/quality/2026-04-26-quality-failure-injection.md` |
| 恢复模式拒绝写操作 | 部分可执行 | 进入恢复模式后尝试设置更新、删除、清空 | 所有写路径被拒绝，浏览/搜索/复制仍可用 | 1 份录屏 + 1 份 diagnostics 导出 |
| migration fail | 已执行 | 临时 HOME 下构造不兼容 `_superclip_migrations` schema，再启动真实二进制 | 输出 `MIGRATION_FAILED` 并进入 recovery 路径 | `.docs/quality/2026-04-26-quality-failure-injection.md` |
| DB_LOCKED 超阈值 | 已执行 | 外部 SQLite 会话持有 `BEGIN IMMEDIATE` 写锁，期间写入新剪贴板内容 | 出现 `DB_LOCKED` 结构化日志，锁释放后重试入库 | `.docs/quality/2026-04-26-quality-failure-injection.md` |

## 证据归档建议
- 录屏：保留原始 `.mov`，避免只留转码版本。
- 截图：至少标注时间戳、目标场景和关键 UI 区域。
- diagnostics：优先留真实导出文件，其次再用仓库内 schema 样例做字段核对。
- 日志：当前阶段以 `recent_errors` 和 `window_fallback_records` 作为最低结构化留痕来源。

## 当前仓库内可直接复用的底稿
- diagnostics schema 样例：`.docs/quality/fixtures/diagnostics-export-sample.json`
- 场景验收矩阵：`.docs/quality/2026-04-25-prd-acceptance-matrix.md`
- 失败注入矩阵：`.docs/quality/2026-04-25-failure-injection-matrix.md`
- direct paste 兼容性清单：`.docs/quality/2026-04-25-direct-paste-compatibility-checklist.md`
