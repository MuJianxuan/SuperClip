# SuperClip P0 Proof Pack 状态

## 当前阶段
- 阶段：`quality`
- 更新时间：2026-04-26 17:26
- 变更：`2026-04-25-superclip-p0-local-clipboard-core`

## 已自动闭环
| 类别 | 状态 | 证据 |
|---|---|---|
| 前端构建 | 通过 | `npm run build` |
| Rust 检查 | 通过 | `cargo check --manifest-path src-tauri/Cargo.toml` |
| Rust 单元测试 | 通过 | `cargo test --manifest-path src-tauri/Cargo.toml`，9 passed |
| Rust 格式检查 | 通过 | 已安装 `rustfmt`；`cargo fmt --manifest-path src-tauri/Cargo.toml --check` |
| 搜索性能 | 通过 | `.docs/quality/search-benchmark-report.md`，P95=0.99ms |
| HTML pasteboard | 通过 | `.docs/quality/2026-04-26-backend-runtime-smoke.md` |
| DB_LOCKED | 通过 | `.docs/quality/2026-04-26-quality-failure-injection.md` |
| migration fail | 通过 | `.docs/quality/2026-04-26-quality-failure-injection.md` |
| diagnostics export | 通过 | `.docs/quality/fixtures/diagnostics-export-runtime-sample.json` |
| direct paste fallback 结果层 | 通过 | `NO_ACCESSIBILITY` / `PAYLOAD_UNSUPPORTED` 单元测试 |
| 菜单栏 Status Item / tray 菜单 / 全局快捷键 | 代码验证通过 | `cargo check`、`cargo test`、`npm run build` |
| 真实 Tauri 宿主主窗口 | 通过 | `.docs/quality/2026-04-26-host-tauri-runtime-smoke.md`、`.docs/quality/screenshots/host-tauri-superclip-20260426-1201.png` |
| settings 持久化 | 通过 | `settings_persist_in_sqlite` 单元测试覆盖 SQLite 读写 |
| 排除规则持久化与过滤 | 通过 | `exclusion_rules_persist_and_filter_snapshots` 单元测试覆盖 SQLite 规则与 keyword 过滤 |
| 搜索高亮契约 | 通过 | `repository_upsert_and_search_round_trip` 已断言 `highlight_ranges`，前端 HistoryRow 消费高亮 |

## 已有截图
- 桌面壳体：`.docs/quality/screenshots/frontend-smoke-20260426-0026.png`
- 移动 fallback：`.docs/quality/screenshots/frontend-smoke-mobile-20260426-0028.png`
- 真实 Tauri 宿主：`.docs/quality/screenshots/host-tauri-superclip-20260426-1201.png`
- 历史宿主截图：`.docs/quality/screenshots/host-tauri-window-20260426-1128.png`、`.docs/quality/screenshots/host-tauri-window-20260426-1138.png`

## 无效 / 不计入证据
- `.docs/quality/screenshots/host-tauri-main-window-20260426-1437.png`：自动采集结果为黑屏，不计入 proof-pack。
- 2026-04-26 14:35 的 `screencapture -v` 录屏尝试返回 `capture error 这项操作无法完成`，当前宿主无法自动产出 `.mov` 证据。

## 仍需真实宿主录屏 / 截图
| 场景 | 当前状态 | 需要补的证据 |
|---|---|---|
| tray anchor / window fallback | 真实 Tauri 主窗口截图已补；当前 3360 x 2100 显示器只能进入 `tray_popover`，无法自然触发 `fallback_window` | 小屏 / 副屏 / 极端缩放环境中的 safe area fallback 录屏 |
| Dock reopen 去重 | 代码已接入 `RunEvent::Reopen` | Dock reopen 单窗口复用录屏 |
| Dock 图标弱化 / 隐藏 | PRD 已明确要求菜单栏优先、Dock 仅作次级入口；当前已接入菜单栏 / tray / 单窗口路径 | Dock 显示策略截图 + 菜单栏优先入口验证 |
| 目标应用 rich text / image 反馈 | orchestrator 结果层已覆盖 | 至少一个真实目标应用录屏 |
| 登录启动首屏 | 设置链路已接宿主 | 重启 / 登录后首屏录屏 |

## 进入 delivery 前的剩余门槛
- 补齐真实宿主录屏，或明确把 `fallback_window`、Dock reopen、Dock 图标弱化 / 隐藏、目标应用反馈、登录启动列为发布前人工验收项。
- 对 `.docs/quality/2026-04-25-prd-acceptance-matrix.md` 中仍标注“需人工录屏”的条目做最终勾验。
- `fallback_window`、Dock reopen、Dock 图标弱化 / 隐藏、目标应用反馈、登录启动录屏关闭后，才进入 `delivery`。

## 2026-04-26 代码返工补充
- 按“先不补录屏证据”的约束，本轮关闭代码断链：
  - SQLite `settings` 表持久化 P0 标量设置。
  - SQLite `exclusion_rules` 表持久化排除规则，并接入 monitor 入库前过滤。
  - 搜索结果新增 `match_type`、`matched_fields`、`highlight_ranges`，前端列表按后端范围高亮。
- 本轮自动验证更新：
  - `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
  - `npm run build` 通过。
  - `cargo test --manifest-path src-tauri/Cargo.toml` 通过，9 passed。
  - `npm run quality:search-benchmark` 通过，P95=0.99ms。
