# 主页功能测试设计

## 背景

本轮目标是为 SuperClip 主页补齐前端自动化测试能力，确保主页核心功能可被稳定验证，并在测试过程中修复发现的问题。

当前仓库事实：
- 主页主实现位于 `src/App.tsx`。
- Tauri IPC 与浏览器 fallback/mock 层位于 `src/lib/superclip.ts`。
- 当前已有 Rust 单元测试，但没有前端测试框架与前端测试脚本。
- `npm run build` 与 `cargo test --manifest-path src-tauri/Cargo.toml` 在实施前基线通过。

## 已确认范围

采用推荐范围：主面板完整覆盖，设置页只做入口和关键联动冒烟。

设置页不在本轮做全量测试，不覆盖所有快捷键录入、规则编辑、启动项、外观与隐私配置细节。

## 测试栈

- Vitest
- jsdom
- React Testing Library
- Testing Library user-event
- Testing Library jest-dom

## 覆盖目标

主页覆盖：
- 初始渲染、搜索过滤、搜索无结果。
- 历史项选择、键盘上下切换。
- 默认动作、复制动作、direct paste 成功 / 退化 / 回退反馈。
- 置顶 / 取消置顶。
- 删除、30 秒撤销、清空历史二次确认。
- 监听暂停 / 恢复。
- 权限缺失 banner 与权限入口。
- 恢复模式只读提示与写操作禁用。
- 迁移中阻塞态。
- fallback window 提示。
- 诊断导出成功、失败与重试。
- `Esc` 关闭与恢复面板。

设置页冒烟覆盖：
- 从主页打开设置。
- 关闭设置。
- 设置页中的诊断与权限入口能触发主页反馈链路。

## 实现原则

- 优先从 `App` 层通过用户行为测试，不只测试内部函数。
- 少量补充 `aria-label` 或 `data-testid`，只用于稳定定位交互元素。
- 为 `src/lib/superclip.ts` 增加测试专用 reset/config helper，避免 fallback 状态在测试之间互相污染；生产路径不调用。
- 测试发现真实实现问题时，先修实现，再让测试通过。

## 验证门

- `npm run test:run`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
