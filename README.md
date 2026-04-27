# SuperClip

SuperClip 是一个面向 macOS 的本地剪贴板历史管理工具。它常驻菜单栏，记录本机剪贴板历史，支持快速搜索、再次复制或直接粘贴，默认不联网、不做云同步。

当前项目状态：P0 本地剪贴板核心链路已完成 delivery 收口，可进入后续验收、打包和发布准备。质量证据见 [交付说明](.docs/quality/2026-04-27-delivery-handoff.md)。

## 核心能力

- 本地剪贴板监听、去重、归一化与 SQLite/FTS 持久化。
- 支持 `text`、`html`、`rtf`、`image`、`file` 五类内容的基础捕获、预览与动作边界。
- 历史列表、搜索、选中、置顶、删除、30 秒撤销、清空历史。
- `direct_paste` / `copy_only` 双动作模型；权限缺失或目标应用拒绝时回退为仅复制。
- Accessibility 权限检查、系统设置跳转、菜单栏 Status Item、全局快捷键、close -> hide、Dock reopen。
- 设置页、排除规则、快捷键配置、登录启动设置、诊断导出、恢复模式只读保护。

## 产品边界

- 首发目标是 macOS，本仓库当前重点验证 macOS arm 环境。
- 数据默认保存在本机，不做云同步、团队协作、AI 总结、AI 搜索或 OCR。
- 文件类内容 P0 默认走 copy-only，不承诺跨 Finder / IDE / 浏览器的一致 direct paste 行为。
- `bundle_id` 排除规则目前仍有实现风险：当前匹配链路更接近泛化来源字段，真实前台 App Bundle ID 采集建议放入 P0.1。

## 技术栈

- 前端：React 19 + TypeScript + Vite 7
- UI：Tailwind CSS 4 + Radix UI + shadcn/ui 风格组件 + Lucide
- 宿主：Tauri 2
- 后端：Rust
- 存储：SQLite + FTS5

## 快速开始

### 环境要求

- macOS
- Node.js / npm
- Rust toolchain
- Tauri 2 所需系统依赖

### 安装依赖

```bash
npm install
```

### Web 预览

```bash
npm run dev
```

Web 预览会使用前端 fallback/mock 路径，适合检查 UI 和基础交互。

### Tauri 宿主运行

启动前建议先确认本机没有正在运行的 SuperClip 实例，避免菜单栏、快捷键或数据库状态相互影响。

```bash
npm run tauri dev
```

真实剪贴板监听、菜单栏、全局快捷键、系统权限检查、SQLite 持久化等能力需要在 Tauri 宿主中验证。

## 常用命令

```bash
npm run build
```

执行 TypeScript 检查并构建 Vite 前端产物。

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

执行 Rust / Tauri 静态检查。

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

执行 Rust 单元测试。

```bash
npm run quality:search-benchmark
```

执行搜索性能 benchmark，并生成质量报告。

## 项目结构

```text
.
├── src/                         # React 前端
│   ├── components/              # 业务组件与 UI 基础组件
│   ├── lib/superclip.ts         # Tauri IPC 类型与调用封装
│   └── App.tsx                  # 主交互壳体
├── src-tauri/                   # Tauri / Rust 宿主
│   ├── src/lib.rs               # 剪贴板、SQLite、IPC、系统集成主实现
│   ├── src/main.rs              # Tauri 入口
│   └── tauri.conf.json          # Tauri 配置
├── output/                      # Super Dev 产出的产品、架构、UIUX 文档
├── .docs/quality/               # 质量门、smoke、benchmark、交付证据
└── .super-dev/                  # Super Dev 工作流状态与变更任务
```

## 架构概览

SuperClip 的核心运行链路如下：

1. Rust 后台服务轮询 macOS pasteboard。
2. Clipboard Normalizer 将原始内容转换为统一 item、payload、preview 和 search text。
3. Repository 层写入 SQLite，并维护 FTS 搜索索引。
4. React 前端通过 Tauri IPC 查询历史、搜索、查看详情、更新设置或触发动作。
5. Paste Orchestrator 负责 copy-only / direct-paste，并在权限或目标应用失败时回退。
6. Diagnostics Service 导出本地诊断包，辅助排障且不包含原始剪贴板 payload。

详细设计见 [架构说明](output/superclip-architecture.md)。

## 关键文档

- [产品需求文档](output/superclip-prd.md)
- [架构说明](output/superclip-architecture.md)
- [UI/UX 方案](output/superclip-uiux.md)
- [研究记录](output/superclip-research.md)
- [P0 proposal](.super-dev/changes/2026-04-25-superclip-p0-local-clipboard-core/proposal.md)
- [P0 tasks](.super-dev/changes/2026-04-25-superclip-p0-local-clipboard-core/tasks.md)
- [交付说明](.docs/quality/2026-04-27-delivery-handoff.md)
- [任务完整性复核](.docs/quality/2026-04-27-task-completeness-review.md)

## 质量状态

最近一次 delivery 记录中的质量门结果：

| 检查 | 结果 |
|---|---|
| `npm run build` | 通过 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 通过，9 passed |
| `npm run quality:search-benchmark` | 通过，P95=1.495ms |

真实宿主录屏已按项目确认改为可选增强证据，不再阻塞 P0 delivery。当前质量证据主要由截图、结构化日志、diagnostics 样例、自动化检查和手工验收记录组成。

## 已知非阻塞风险

1. UI 圆角 token 与 `output/superclip-uiux.md` 存在漂移，后续可选择修源码或回写 UIUX 文档。
2. `bundle_id` 排除规则当前匹配泛化 `source_app` 字段，真实前台 App Bundle ID 采集建议进入 P0.1。
3. fallback window、login 首屏、Dock reopen、目标应用 rich text/image 反馈仍建议在具备宿主条件时补充人工验收记录或可选录屏。

## 隐私说明

SuperClip 的 P0 设计是 local-first：

- 不上传剪贴板内容。
- 不做云同步。
- 不做远端分析。
- 诊断导出禁止包含原始剪贴板文本、图片二进制、完整 HTML / RTF、完整文件路径和文件实体内容。

## 许可证

仓库当前未声明许可证。发布前需要补充 `LICENSE` 并在本节更新对应说明。
