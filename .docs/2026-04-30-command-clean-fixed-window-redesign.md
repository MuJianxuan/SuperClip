# SuperClip Command Clean 固定窗口重构设计

## 背景

本次重构基于 `.superpowers/brainstorm/41716-1777301621/content/a-command-clean-wireframe.html` 的 `A · Command Clean` 线框方向，目标是把 SuperClip 从可自由拉伸的桌面窗口，调整为两个固定比例的 macOS 工具窗体验。

当前仓库事实：
- Tauri 配置里主窗口为 `880x640`，`resizable: true`。
- Rust 侧已有 `tray_popover / compact_popover / fallback_window` 的窗口模式与安全区判断。
- React 前端已实现主面板双栏、设置页、权限提示、恢复模式、诊断导出、快捷键录入、排除规则等功能。
- `output/superclip-uiux.md` 冻结约束为 Lucide、Inter + SF fallback、语义 token、shadcn/ui + Radix + Tailwind、主面板 + 设置页 + 权限引导骨架。

## 用户确认的范围

- 绿灯行为采用两个固定尺寸切换，不进入系统自由最大化。
- 默认小尺寸为 `760x560`。
- 点击绿灯切到大尺寸 `980x680`，再点切回 `760x560`。
- 主面板和设置页都按 `Command Clean` 设计高贴近重构。
- 小尺寸仍保留双栏，右侧详情区使用精简版本。
- 窗口不可通过拖拽边缘自由缩放。
- 大尺寸不记忆；每次从菜单栏、全局快捷键或 Dock 打开都默认小尺寸。
- 切换大小时保持当前中心点，超出显示器安全区时再自动收回。

## 设计目标

1. 建立固定比例的桌面工具体验，避免窗口被拉成破坏 UI 的比例。
2. 让 macOS 绿灯成为 SuperClip 的“小 / 大”工作区切换，而不是系统最大化。
3. 高贴近 `Command Clean` 视觉方向：低噪音、浅色、短标签、紧凑信息密度。
4. 保留现有 P0 功能和业务命令，不因为 UI 重构删除行为能力。
5. 小尺寸优先可用，大尺寸提供更舒展的预览与工具区域。

## 窗口行为

### 尺寸模式

定义两个主要窗口尺寸：
- `small`: `760x560`，默认模式。
- `large`: `980x680`，用户点击 macOS 绿灯后进入。

安全区不足时允许进入 fallback 尺寸，但 fallback 只用于防裁切，不作为用户可选尺寸。

### 打开路径

以下路径都必须先应用 `small` 尺寸：
- 菜单栏图标打开。
- 全局快捷键打开。
- Dock 重新打开。
- 启动时自动显示。

`large` 只在当前显示期间有效，不写入设置，不持久化到 session state。

### 绿灯行为

macOS 绿灯 / zoom 事件被解释为 SuperClip 尺寸切换：
- 当前是 `small` 时，切换为 `large`。
- 当前是 `large` 时，切换为 `small`。
- 不进入系统原生 fullscreen 或自由 zoom 比例。

### 位置策略

切换尺寸时以当前窗口中心点为锚点：
- 先计算新尺寸下的目标矩形。
- 如果目标矩形仍在当前 monitor work area 内，则保持中心点。
- 如果超出安全区，则将窗口收回到当前 monitor work area 内。

### Tauri 配置

主窗口以系统可 zoom 的方式创建，但运行时只允许两档目标尺寸：
- `width`: `760`
- `height`: `560`
- `minWidth`: `760`
- `minHeight`: `560`
- `maxWidth`: `980`
- `maxHeight`: `680`
- `resizable`: `true`
- `maximizable`: `true`
- `fullscreen`: `false`

原因：Tauri / wry 在 `resizable: false` 时会禁用 macOS 绿灯 / zoom 按钮。为了保留绿灯可点击，窗口在系统层保持可 zoom，Rust 层在 resize 事件中把任何非目标尺寸吸回 `small` 或 `large`。

## 主面板设计

### 视觉方向

主面板按 `Command Clean` 高贴近落地：
- 背景：off-white surface，不做强装饰渐变。
- 面板：白色或半透明白色，低对比边框。
- 文本：near-black primary text，muted secondary text。
- 强调色：muted green，用于 active state、搜索标记、主按钮。
- 图标：Lucide。
- 字体：Inter + SF Pro fallback。
- 文案：短标签优先，避免大段说明。

### 信息架构

主面板结构：
1. 顶部 header
   - 搜索框。
   - 监听状态。
   - 权限状态。
   - 默认动作状态。
   - 关闭入口。
2. 双栏 workspace
   - 左侧历史列表。
   - 右侧选中项摘要、主动作、次级动作、工具列表。
3. 底部 footer
   - 键盘操作提示。
   - 本地运行状态短说明。

### 小尺寸 `760x560`

小尺寸是默认体验，不能只是大尺寸的压缩版。

小尺寸布局规则：
- 保留双栏。
- 左侧历史列表占主要宽度。
- 右侧只显示精简详情：标题、来源 / 时间、2 行预览、主按钮、Copy / Pin / Delete。
- 工具列表压缩为紧凑图标 + 短标签区域。
- 搜索框、权限状态、主按钮必须首屏可见。
- 各滚动区域独立滚动，不能让整个窗口失控滚动。

### 大尺寸 `980x680`

大尺寸用于更完整的预览和工具访问：
- 保留双栏。
- 右侧预览卡片更完整。
- 工具列表展示为完整区域。
- 主动作固定在右侧详情中段，视觉权重最高。
- 次级动作在主动作下方一行。

### 状态保留

以下现有状态必须继续保留：
- 空历史。
- 搜索无结果。
- Accessibility 未授权。
- 恢复模式 / 只读模式。
- 本地迁移阻塞。
- fallback 居中窗口提示。
- 删除撤销 toast。
- direct paste 成功 / 降级 / fallback 反馈。

状态文案需要收短，避免破坏低噪音工具感。

## 设置页设计

### 布局

设置页同步按 `Command Clean` 重构：
- 大尺寸下使用左侧窄 rail 导航 + 右侧卡片流。
- 小尺寸下优先保留窄导航；空间不足时切换为顶部横向 tabs。
- 顶部右侧固定放三个动作：诊断、权限、关闭。
- 正文只保留必要短说明，不写大段解释。

### 功能范围

保留现有设置范围：
- 通用。
- 快捷键。
- 粘贴行为。
- 隐私 / 排除规则。
- 外观。
- 启动与更新。
- 关于。

以下交互不得删除：
- 快捷键重新录入、取消、恢复默认、冲突 inline error。
- 排除规则新增、编辑、启用 / 停用、删除、清空。
- 登录启动失败 inline error + Retry。
- 只读模式下禁用写操作。
- 诊断导出。
- Accessibility 权限入口。

### 视觉一致性

设置页使用同一套语义 token，不新增 UI 库，不脱离 `output/superclip-uiux.md` 的冻结约束。

## 前端实现边界

预计修改范围：
- `src/App.tsx`
- `src/App.css`
- `src/components/history-row.tsx`
- `src/components/settings-shell.tsx`
- 必要时调整 `src/components/ui/button.tsx` 的密度 token。
- 必要时调整 `src/lib/superclip.ts` 的 window mode 类型与 fallback preview 逻辑。

前端不新增业务命令，不改变剪贴板、设置、规则、快捷键、诊断等 IPC 语义。

## 后端实现边界

预计修改范围：
- `src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs`

Rust 层职责：
- 定义小 / 大尺寸常量。
- 打开窗口时应用小尺寸。
- 处理 zoom / resize 相关窗口事件，转换为小 / 大切换。
- 保持中心点并做 monitor work area 安全区收回。
- 更新 runtime state，让前端知道当前是 small / large / fallback。

如果 Tauri 的事件模型无法直接拦截原生绿灯，需要使用最接近的 macOS zoom/window event 路径实现；若仍存在系统限制，需在实现阶段记录证据并给出可验证替代方案。

## 验证计划

最低验证：
- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- 相关 Rust 单元测试或新增窗口尺寸计算单测。

宿主验证：
- 启动前先检查服务 / 进程是否已运行。
- 启动 Tauri 宿主后验证默认窗口为 `760x560`。
- 点击绿灯验证切换到 `980x680`。
- 再次点击绿灯验证回到 `760x560`。
- 验证窗口不可拖拽自由缩放。
- 验证主面板小尺寸、大尺寸、设置页没有文字重叠或关键动作被遮挡。
- 截图保存到 `.docs/quality/screenshots/` 或写入对应质量记录。

## 非目标

- 不新增云同步、AI、账号、远程服务。
- 不删除现有 P0 功能。
- 不改变剪贴板存储 schema。
- 不改 Git 分支，不提交，不推送。
- 不删除任何文件或目录。

## 决策记录

- 选择一次完成窗口行为和 UI 重构，而不是拆成两阶段。
- 选择两个固定尺寸，放弃自由拖拽和吸附模式。
- 选择默认不记忆大尺寸，保证每次打开都是小工具窗。
- 选择小尺寸保留双栏，避免主面板退化成单栏列表。
