# SuperClip 真实 Tauri 宿主 Smoke 记录

## 执行时间
- 日期：2026-04-26
- 阶段：`quality`
- 变更：`2026-04-25-superclip-p0-local-clipboard-core`

## 执行目标
- 在真实 macOS + Tauri 宿主中启动 SuperClip，而不是只依赖浏览器 fallback。
- 留存主窗口截图，验证 P0 shell、搜索焦点、监听状态、权限降级提示和真实历史数据渲染。
- 复核 `anchor lost / window fallback` 证据能否在当前显示器环境中自然触发。

## 执行步骤
1. 启动前检查进程列表：未发现正在运行的 SuperClip / Tauri / Vite dev 进程。
2. 启动宿主：
   - `npm run tauri dev -- --no-watch`
3. Tauri dev 输出：
   - Vite dev server 启动于 `http://localhost:1420/`
   - Rust dev binary 启动于 `target/debug/superclip`
4. 通过 System Events 将 `superclip` 进程置前。
5. 截取当前完整屏幕：
   - `.docs/quality/screenshots/host-tauri-superclip-20260426-1201.png`
6. 结束本轮 smoke 后关闭本次启动的 Tauri dev 会话。

## 结果
| 验证项 | 结果 | 证据 |
|---|---|---|
| 真实 Tauri 宿主启动 | 通过 | `target/debug/superclip` 已启动并显示主窗口 |
| 主窗口壳体渲染 | 通过 | 截图显示 SuperClip P0 Shell、双栏布局、历史列表与详情区 |
| 搜索框默认聚焦 | 通过 | 截图中搜索输入框光标已聚焦 |
| 剪贴板监听状态 | 通过 | 截图显示 `正在监听` |
| Accessibility 降级提示 | 通过 | 截图显示 `Accessibility 未授权` 与 copy-only 降级提示 |
| 真实历史数据渲染 | 通过 | 截图显示来自系统剪贴板的 `git@github.com:...` 文本记录 |
| anchor lost / window fallback 自然触发 | 未触发 | 当前主显示器为 3360 x 2100，工作区足以进入 `tray_popover`，不会自然触发 `safe_area_fallback` |
| 主屏视频录制 | 未完成 | `screencapture -v -V 8` 与 `screencapture -v -V5` 均返回 `capture error 这项操作无法完成` |

## 证据文件
- 真实 Tauri 宿主截图：`.docs/quality/screenshots/host-tauri-superclip-20260426-1201.png`
- 浏览器 fallback 截图：`.docs/quality/screenshots/frontend-smoke-mobile-20260426-0028.png`
- 后端 runtime smoke：`.docs/quality/2026-04-26-backend-runtime-smoke.md`
- 失败注入记录：`.docs/quality/2026-04-26-quality-failure-injection.md`
- diagnostics runtime 样例：`.docs/quality/fixtures/diagnostics-export-runtime-sample.json`

## 无效采集记录
- `.docs/quality/screenshots/host-tauri-main-window-20260426-1437.png` 是 2026-04-26 14:37 录屏失败后补抓的截图，但文件内容为黑屏，不作为有效 proof-pack 证据使用。
- 黑屏截图保留在仓库中仅用于说明本次自动采集失败；后续如需清理该文件，应先得到用户删除许可。

## 未关闭项
- 真实 `fallback_window` 仍需在小屏、低分辨率副屏、显示器缩放极端配置，或可控宿主环境中复测。
- Dock reopen 去重、目标应用 rich text / image 反馈、登录启动首屏仍缺录屏。
- 当前 Codex 宿主中 `screencapture` 可截图但视频录制失败，录屏应改为人工使用系统截图工具或 QuickTime 补录，再把 `.mov` 放入 `.docs/quality/screenshots/`。
- 当前 `window_placement_refresh` 使用真实 monitor work area 决策；在 3360 x 2100 主显示器上只能验证 `tray_popover` 正常路径，不能构造真实 safe area 不足。
