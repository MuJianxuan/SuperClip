# SuperClip 前端 Runtime Smoke 记录

## 执行时间
- 日期：2026-04-26
- 阶段：`frontend`
- 目标关口：`preview_confirm`

## 执行范围
- 本轮只验证前端优先壳体与浏览器 fallback runtime。
- 不把本轮结果视为真实 Rust 剪贴板后端闭环完成。
- 不进入 `backend` 阶段；`preview_confirm` 仍需用户明确确认。

## 服务检查
- 启动前探测 `http://127.0.0.1:5173`：未监听。
- 启动命令：`npm run dev -- --host 127.0.0.1`
- 实际预览地址：`http://127.0.0.1:1420/`
- HTTP smoke：`GET /` 与 `HEAD /` 均返回 200。

## 自动检查结果
| 检查项 | 结果 | 证据 |
|---|---|---|
| `npm run build` | 通过 | Vite production build completed |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 通过 | Rust dev profile check completed |
| `npm run quality:search-benchmark` | 通过 | P50=0.548ms, P95=3.602ms, max=24.68ms |
| hydrated DOM | 通过 | DOM 中包含 SuperClip 主壳体、历史列表、详情面板、功能列表 |
| browser console | 通过 | 仅出现 Vite connected 与 React DevTools 提示，未见应用运行时错误 |
| emoji 自检 | 通过 | `src`、`src-tauri`、`output`、`.super-dev`、`.docs` 未命中禁止范围字符 |

## 截图证据
- 桌面宽度：`.docs/quality/screenshots/frontend-smoke-20260426-0026.png`
- 移动宽度：`.docs/quality/screenshots/frontend-smoke-mobile-20260426-0028.png`

## 视觉检查结论
- 桌面宽度下，双栏 popover、搜索框、状态 pill、历史列表、详情卡片、功能列表和 footer 快捷键提示均可见。
- 移动宽度下，页面触发 `safe_area_fallback`，显示居中窗口回退提示；该行为符合 `output/superclip-uiux.md` 的回退策略。
- 功能图标来自 Lucide SVG；未使用 emoji 作为图标或占位。

## 当前限制
- 本轮预览仍基于前端 fallback/mock 数据与已有 Tauri bridge 形态。
- SQLite、FTS、剪贴板监听、真实 paste orchestrator 尚未完成。
- 真实 Tauri 宿主中的菜单栏唤起、副屏快捷键、diagnostics 保存对话框、Accessibility 撤销等仍需后续 smoke。

## 下一步
- 等待用户对当前 UI / 交互方向做 `preview_confirm`。
- 用户确认后，进入 `backend` 阶段，实现真实本地剪贴板数据闭环。
