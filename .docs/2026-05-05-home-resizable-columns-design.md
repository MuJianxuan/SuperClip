# 主页左右栏拖动比例设计

## 背景
当前主页双栏布局在 `src/App.tsx` 中使用固定 `grid-cols-[minmax(...,2fr)_minmax(0,5fr)]`。`output/superclip-uiux.md` 也定义了菜单栏 popover 左右两栏固定分区。用户希望左侧历史列表与右侧详情区域之间的比例可以拖动，并且下次打开 SuperClip 时恢复上次调整结果。

## 目标
- 在主页历史列表与详情区域之间增加可拖动分隔条。
- 用户调整后的左栏宽度需要被记住，下次打开 SuperClip 时恢复。
- 保持当前视觉系统：Lucide、Tailwind、语义 token、高级灰白风格。
- 不破坏现有紧凑窗口、fallback window、session 恢复、搜索、选中项、滚动恢复逻辑。

## 非目标
- 不引入新的 split-pane 第三方库。
- 不新增设置页配置项。
- 不做多套窗口模式独立偏好。
- 不在本次实现键盘方向键 resize；保留 `role="separator"` 等 accessibility 基础，键盘增强可作为后续改进。

## 方案
采用现有 `session_ui_state` 作为持久化通道，新增 `layout_sidebar_width_px` 字段。

前端在 `App` 中维护 `layoutSidebarWidthPx`：
- 默认值约为 `260px`，接近当前 `2fr / 5fr` 的视觉比例。
- 从 `sessionUiStateGet()` 返回值恢复。
- 拖动中只更新 React state，保证交互即时。
- 拖动结束后调用 `sessionUiStateUpdate()` 持久化。
- 原有 query、selectedItemId、scrollAnchor、lastDisplayId、lastWindowMode 继续通过同一 update 通道同步。

Rust 后端扩展：
- `SessionUiStateResponse` 增加 `layout_sidebar_width_px: Option<u32>`。
- `SessionUiStateUpdateRequest` 增加 `layout_sidebar_width_px: Option<u32>`。
- 内存态初始化为 `None`，兼容旧会话状态。
- `session_ui_state_get/update` 读写该字段。

前端 fallback mock 同步扩展该字段，保证浏览器预览与测试环境行为一致。

## 布局与约束
双栏 grid 从固定 fr 改为受控列宽：

```text
左栏: clamp 后的 layoutSidebarWidthPx
分隔条: 8px 左右的交互区域，视觉线保持轻量
右栏: minmax(420px, 1fr)
```

宽度约束：
- 左栏最小 `220px`。
- 左栏最大 `420px`。
- 右栏最小 `420px`。
- 当窗口宽度不足以同时满足最大值时，前端根据容器宽度动态 clamp 左栏宽度，优先保护右栏可用性。

标准窗口与大窗口共用同一份宽度偏好。窄窗口和 fallback window 不额外保存独立比例，只在渲染时按可用宽度套用安全边界。

## 交互
- 鼠标和触控按下分隔条后开始拖动。
- 拖动时页面进入 resize 状态，分隔条高亮，cursor 使用 `col-resize`。
- 释放 pointer 或取消 pointer 后结束拖动并持久化。
- 分隔条使用：
  - `role="separator"`
  - `aria-orientation="vertical"`
  - `aria-valuemin="220"`
  - `aria-valuemax="420"`
  - `aria-valuenow={当前左栏宽度}`
  - `aria-label="调整历史列表宽度"`

## 状态与错误处理
- 如果 `sessionUiStateGet()` 没有返回宽度，使用默认值。
- 如果返回宽度超出边界，前端 clamp 后使用。
- 如果拖动结束后的 `sessionUiStateUpdate()` 失败，不阻断用户继续使用；沿用当前内存宽度，下一次启动可能回到旧值。
- 不在拖动过程中发送高频后端调用。

## 测试计划
前端测试：
- 初始 session state 带 `layoutSidebarWidthPx` 时，主页 grid 使用恢复后的宽度。
- 拖动分隔条后，左栏宽度更新并在结束拖动时调用 `session_ui_state_update`，payload 包含 `layoutSidebarWidthPx`。
- 过小或过大的 session 宽度会被 clamp 到安全范围。
- 窗口宽度不足时，右栏最小宽度优先得到保护。

Rust 测试：
- `session_ui_state_update` 能保存 `layout_sidebar_width_px`。
- `session_ui_state_get` 能返回保存后的字段。
- 字段为 `None` 时仍保持旧行为。

## 自检
- 无 `TODO` / `TBD` 占位。
- 设计与现有 `session_ui_state` 恢复模型一致。
- 范围聚焦主页双栏拖动与恢复，没有引入设置页或第三方库。
- 宽度边界、持久化时机、失败行为都有明确约定。
