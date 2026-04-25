# SuperClip 三文档综合审查报告

> 审查日期：2026-04-25
> 审查对象：`output/superclip-prd.md` / `output/superclip-architecture.md` / `output/superclip-uiux.md`
> 审查目标：做多维度质量审查、质量评分、功能完整性分析，并判断是否适合进入下一阶段。

## 1. 执行摘要

### 总体判断
当前三份文档已经形成了比较清晰的 **P0 产品骨架**，尤其是以下主闭环已经打通：

- 复制内容被监听并入库
- 用户通过菜单栏或全局快捷键唤起面板
- 用户可以搜索、选中、预览历史项
- 用户可以执行“直接粘贴”或“仅复制”
- 无 Accessibility 权限时有明确降级路径

但从 **“文档质量”** 到 **“实现就绪度”** 之间还有一层明显断档：
目前文档更像是“方向正确、骨架完整”的方案包，而不是“可以无歧义进入 Spec / 编码”的工程包。

### 结论评分
| 指标 | 分数 | 结论 |
|---|---:|---|
| 文档质量总分 | **83 / 100** | 质量较好，方向明确 |
| P0 功能完整性 | **79 / 100** | 核心闭环基本完整，外围能力定义不足 |
| 实施就绪度 | **69 / 100** | 不建议直接进入编码，建议先补关键契约 |
| 跨文档一致性 | **85 / 100** | 主线一致，少量关键断点 |

### Gate 建议
- **可以继续停留在 docs / docs_confirm 门内做修订。**
- **不建议现在直接进入 Spec / tasks / 编码。**
- 先补齐 API 契约、Tauri capability/permission 矩阵、直接粘贴技术边界、隐私/敏感内容策略、主题 token 完整性。

---

## 2. 审查维度与评分方法

本次按 6 个维度综合打分：

| 维度 | 权重 | 说明 |
|---|---:|---|
| 产品目标与范围控制 | 15 | 是否聚焦、是否能控制范围膨胀 |
| 功能定义完整性 | 20 | P0 功能是否能形成闭环，是否存在大面积模糊区 |
| 架构可实现性 | 20 | 技术路线是否成立，是否有明显落地阻碍 |
| UI/UX 可执行性 | 15 | 页面骨架、交互、状态、视觉约束是否足够落地 |
| 跨文档一致性 | 15 | PRD / Architecture / UIUX 是否互相继承、无明显冲突 |
| 非功能质量 | 15 | 性能、隐私、安全、恢复、测试、运维是否有基本定义 |

---

## 3. 分文档评分

### 3.1 PRD 评分：**86 / 100**

#### 优点
1. **定位清楚**：本地、macOS arm、菜单栏、稳定优先、不开云，边界很干净。
2. **非目标明确**：主动砍掉云同步、协作、AI、跨平台首发，范围控制良好。
3. **核心交互闭环完整**：唤起、搜索、选中、执行动作、失败回退，主路径明确。
4. **权限降级写得较成熟**：未授权可浏览/搜索，只禁直接粘贴，符合真实产品预期。
5. **存储边界有意识**：大小上限、历史条数、去重、清理策略都已给出。

#### 问题
1. **验收标准偏业务化，缺工程量化指标**：没有明确启动时延、搜索时延、内存占用、CPU 占用、数据库膨胀阈值。
2. **设置项只有栏目，没有字段级定义**：热键冲突、保留数量范围、主题选项、排除规则格式都未定义。
3. **隐私/敏感数据策略不足**：没有定义密码管理器内容、一次性验证码、敏感 App 的处理策略。
4. **“直接粘贴”只定义了结果，没有定义用户可预期边界**：哪些 App 可能失败、失败后如何提示、是否支持富文本/文件直粘都未说清。
5. **主题是 P0 设置项，但没有对应主题能力定义闭环**。

#### 结论
PRD 已经足以做产品方向评审，但还不够支撑无歧义拆 Spec。

---

### 3.2 Architecture 评分：**81 / 100**

#### 优点
1. **技术选型统一**：Tauri 2 + Rust + React + SQLite，叙述简洁。
2. **职责切分合理**：监听、归一化、持久化、粘贴编排、设置、恢复都已拆层。
3. **数据模型方向正确**：主表 + payload 表 + settings + FTS，符合本地历史工具形态。
4. **关键决策比较到位**：明确指出 `arboard` 不能覆盖 file / rich text 全量需求，这是正确预警。
5. **错误与降级思路存在**：不是只写 happy path。

#### 问题
1. **缺少 API / IPC 契约**：没有定义 Tauri commands、events、payload schema、window labels。
2. **缺少 Tauri 2 capability / permission 设计**：全局快捷键、positioner、tray、shell/open system settings 等权限矩阵未定义。
3. **直接粘贴实现边界不清**：是模拟 `Cmd+V`、还是 AX 定位后插入、还是两者组合，没有策略图。
4. **搜索技术细节不够**：文档写了中文搜索 `FTS + 归一化 + contains 回退`，但没有 tokenizer / 索引同步策略 / 性能预算。
5. **恢复与迁移只写了原则，缺操作级方案**：例如迁移失败后进入何种只读模式、如何回滚、如何提示用户。
6. **缺少性能预算**：轮询频率、索引刷新节奏、后台任务并发策略未定义。
7. **缺少安全边界**：本地数据库是否明文、是否要对图片临时文件做生命周期控制、是否允许前端直接访问原始 payload 未定义。

#### 结论
架构方向成立，但仍停留在“方案说明书”层，不是“实现蓝图”。

---

### 3.3 UIUX 评分：**79 / 100**

#### 优点
1. **风格冻结明确**：Lucide、Inter、shadcn/ui、Tailwind、语义 token 都锁住了。
2. **主界面骨架清晰**：左历史、右摘要 + 功能列表，结构足够明确。
3. **状态设计比较完整**：正常、暂停、无结果、权限缺失、恢复中等都有落点。
4. **交互规则与 PRD 高度一致**：键盘行为继承得很好。
5. **视觉禁令有效**：成功避免 AI 模板化、emoji 图标、紫粉渐变。

#### 问题
1. **主题能力未闭环**：PRD 有“主题”设置，但 UIUX 只定义了浅色系 token，没有 dark mode / auto / 跟随系统策略。
2. **设置窗口缺字段级设计**：每个分组里有哪些控件、默认值、校验态、冲突态未定义。
3. **缺少无障碍设计要求**：focus ring、键盘焦点顺序、屏幕阅读器标签、对比度、reduced motion 未定义。
4. **缺少长内容/异常内容预览规则**：超长文本、超大图片、文件夹、多文件复制、HTML 危险内容如何预览没有写。
5. **缺少微交互与状态文案规范**：toast 文案、banner 文案、错误文案、确认弹窗未定义。
6. **缺少极端场景版式规则**：小屏、外接显示器、刘海屏、安全区、窗口贴边行为未定义。

#### 结论
UIUX 文档已经能锁定设计方向，但还不足以直接指导高保真实现。

---

## 4. 跨文档一致性审查

## 4.1 一致性好的部分

1. **本地优先 / 无云同步** 三文档完全一致。
2. **入口模型一致**：菜单栏 + 全局快捷键。
3. **动作模型一致**：直接粘贴 / 仅复制双路径。
4. **降级策略一致**：无 Accessibility 权限时仍可浏览与搜索。
5. **菜单栏双栏结构一致**：左历史、右摘要 + 功能列表。
6. **搜索与排序逻辑一致**：置顶优先、最近性、匹配优先级。
7. **技术栈与 UI 生态一致**：Lucide + shadcn/ui + Tailwind + Tauri 2。
8. **恢复/迁移意识一致**：不是只做单次 happy path。

## 4.2 关键断点

1. **PRD 有主题设置，UIUX 没有完整主题方案。**
2. **PRD/Architecture 说有排除规则，但没有规则模型。**
3. **Architecture 说前后端职责清晰，但没有 command/event 契约，实际仍不可开发。**
4. **Research 倾向“像 Maccy 一样轻与快”，但 Architecture/UIUX 没有给出资源预算，无法约束 Tauri WebView 带来的体感风险。**
5. **Research 已经确认 Tauri 2 需要插件/权限能力，但 Architecture 没写 capability 文件与权限边界。**

### 一致性结论
主线是通的，但缺的恰恰都是 **进入实现前必须落地的关键契约**。

---

## 5. 功能完整性分析

### 5.1 P0 能力分解与完成度

| 能力域 | 完整度 | 结论 | 说明 |
|---|---:|---|---|
| 多类型剪贴板采集 | 85 | 基本完整 | text/image/file/html/rtf 已定义，但边界样本不足 |
| 历史列表与预览 | 84 | 基本完整 | 主界面模型成立，异常内容预览仍需补 |
| 搜索与排序 | 82 | 基本完整 | 规则明确，但中文 tokenizer 与性能策略未落地 |
| 快捷唤起 | 80 | 基本完整 | 入口清楚，但热键冲突处理未定义 |
| 直接粘贴 / 仅复制 | 74 | 部分完整 | 用户行为已定义，底层技术契约不足 |
| 权限引导与降级 | 88 | 完整度较高 | 产品与 UI 都继承到了 |
| 设置中心 | 66 | 部分完整 | 只有栏目，没有字段级 schema |
| 主题与外观 | 58 | 明显不足 | 有设置入口，无完整 token 与策略 |
| 排除规则 / 隐私规则 | 61 | 明显不足 | 有概念，无模型、无优先级、无示例 |
| 存储保留 / 去重 / 清理 | 86 | 完整度较高 | 规则清楚，工程细节待补 |
| 恢复 / 迁移 / 崩溃处理 | 70 | 部分完整 | 有原则，无 SOP |
| 测试 / 验证 / 质量门禁 | 64 | 部分完整 | 仅列测试方向，缺验收矩阵 |
| 安全 / 敏感内容保护 | 55 | 关键缺口 | 没有专门策略 |
| 可观测性 / 诊断 | 48 | 缺失明显 | 日志、错误码、调试面几乎为空 |

### 5.2 加权结论
- **核心用户闭环完整度：高**
- **边缘但重要的产品化能力完整度：中低**
- **P0 功能完整性综合分：79 / 100**

### 5.3 最值得肯定的地方
当前文档不是“功能点堆砌”，而是真正围绕一个核心闭环组织：
**复制 -> 唤起 -> 搜索 -> 选中 -> 执行动作 -> 失败回退**。
这条主线很强，是文档最有价值的部分。

### 5.4 最大缺口
所有“让产品真正能上线稳定跑”的外围能力，定义都还不够：
- 热键冲突
- 主题完整性
- 敏感数据保护
- capability 权限矩阵
- 异常恢复细节
- 性能预算
- 可观测性

---

## 6. 关键风险与阻塞项

以下问题建议在进入 Spec 前解决，否则后续 tasks 与编码会高概率返工。

### 阻塞项 1：缺少 Tauri Command / Event / Window 契约
建议补一张矩阵：
- commands：`get_history` / `search_history` / `perform_paste` / `copy_item` / `toggle_monitor` / `open_accessibility_settings` / `update_settings` ...
- events：`history_updated` / `permission_changed` / `paste_failed` / `reindex_started` / `reindex_finished` ...
- windows：`tray-popover` / `settings` / `permission-guide`

### 阻塞项 2：缺少 Tauri 2 capability / permission 设计
当前官方文档已经明确：插件命令默认受 capability 约束。至少要补：
- `global-shortcut`
- `positioner`
- `shell` / `opener`（打开系统设置时可能需要）
- `core:default`
- 与各窗口 label 对应的 capability 文件

### 阻塞项 3：直接粘贴技术路径不清
至少要决定：
1. 首选路径是否为“恢复目标应用焦点 -> 写入剪贴板 -> 模拟粘贴快捷键”
2. 是否需要 AXUIElement 级 fallback
3. 哪些内容类型支持 direct paste，哪些只允许 copy-only
4. 失败分类与提示文案

### 阻塞项 4：隐私与敏感内容策略不完整
建议补齐：
- 排除 App 规则模型
- 密码管理器内容是否默认不入库
- 一次性验证码 / 短时敏感内容处理
- 临时图片与大 payload 生命周期
- 本地数据库暴露风险说明

### 阻塞项 5：主题能力与 UI token 不闭环
若 P0 真的要有“主题”，就要补：
- light / dark / follow system
- 每套语义 token
- tray popover、settings、banner、toast 的 token 映射
否则建议把“主题”从 P0 降级到 v1.1。

### 阻塞项 6：缺少性能与资源预算
建议至少定义：
- 冷启动时间
- 唤起到可输入时间
- 搜索 1k 条记录的响应时间
- 空闲 CPU / 内存占用
- 图片大对象处理策略

---

## 7. 建议整改顺序

## 7.1 进入 Spec 前必须补齐（Must）
1. **补 Architecture API / Event / Window / Capability 四张契约表**
2. **补“直接粘贴”时序图与失败分类**
3. **补设置 schema：字段、默认值、范围、校验、冲突处理**
4. **补隐私/敏感内容/排除规则策略**
5. **补主题策略，或把主题移出 P0**
6. **补性能预算与验收阈值**

## 7.2 编码前强烈建议补齐（Should）
1. 补数据库 schema 细化：索引、触发器、迁移回滚策略
2. 补长文本/大图片/多文件/HTML 预览规则
3. 补 UI 文案规范：banner / toast / empty state / confirm modal
4. 补测试矩阵：单测、集成、smoke、权限场景、恢复场景
5. 补日志与错误码策略

## 7.3 可以后置（Could）
1. 导入 / 导出策略
2. 备份与恢复增强
3. 更丰富规则引擎
4. Snippet / 收藏夹等高级能力

---

## 8. 外部核验摘要（用于架构可行性校验）

> 以下核验仅用于判断当前文档方向是否成立，不代表实现细节已经在文档中写够。

### 核验结论
1. **Tauri 2 的 tray 能力可支撑菜单栏入口与点击事件控制。**
2. **Tauri Positioner 插件可支撑 tray-relative window positioning，但需要额外 setup、`tray-icon` feature 和 capability 权限配置。**
3. **Tauri Global Shortcut 插件可支撑全局热键，但同样需要 capability 权限声明。**
4. **Apple `AXIsProcessTrusted()` / `AXIsProcessTrustedWithOptions()` 可以作为 Accessibility 授权检测与异步提示依据。**
5. **Maccy 当前公开定位依然强调 lightweight / keyboard-first / private / local，并特别强调对密码管理器清空剪贴板的尊重；这说明你的“轻、本地、键盘优先”方向是对的，但敏感内容策略仍然偏弱。**

### 对文档的启示
- 架构方向 **是成立的**。
- 但实现约束 **没有被完整继承进 Architecture 文档**。
- 因此现在的问题不是“路线错了”，而是“路线对，但工程契约没写完”。

### 核验来源
- Tauri System Tray: https://v2.tauri.app/zh-cn/learn/system-tray/
- Tauri Positioner: https://v2.tauri.app/plugin/positioner/
- Tauri Global Shortcut: https://v2.tauri.app/zh-cn/plugin/global-shortcut/
- Tauri Capability Reference: https://tauri.app/reference/acl/capability/
- Apple `AXIsProcessTrusted()`: https://developer.apple.com/documentation/applicationservices/1460720-axisprocesstrusted
- Apple `AXIsProcessTrustedWithOptions()`: https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions
- Maccy: https://maccy.app/
- PasteBar: https://www.pastebar.app/
- Clipy: https://github.com/Clipy/Clipy

---

## 9. 最终结论

### 可以给出的总体评价
这是一个 **方向对、边界收得住、主闭环很强** 的三文档组合。
如果只看“产品方向文档质量”，它已经达到 **可继续推进** 的水平。

### 但必须明确
它还没有达到“可以放心进入实现”的成熟度。
最大的短板不是想法不清，而是：

- 缺少 command/event/capability 级契约
- 缺少敏感内容与隐私规则
- 缺少主题与设置的字段级定义
- 缺少性能与恢复的量化要求

### 最终建议
**先做一轮 docs 修订，再进入 docs_confirm。**
在此之前，不建议直接创建 Spec / tasks，更不建议直接编码。
