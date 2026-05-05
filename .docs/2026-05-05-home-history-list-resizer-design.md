# 首页历史列表与拖拽条视觉调整设计

## 背景

首页主工作区使用三列 grid：左侧历史记录列表、中央 resizer、右侧详情预览。当前历史记录行已经压缩为只展示标题，并使用 CSS `truncate` 根据可用宽度自动省略；左侧栏宽度由 `--sidebar-width` 驱动，拖拽 resizer 后会改变标题容器宽度。

用户反馈集中在三个点：

- 历史记录选中态不应呈现大面积长条卡片。
- 标题显示字数应随左侧栏宽度变化，显示不完整时用 `...`。
- 中央竖条与右侧预览框间距偏大，且需要更像可拖动控件。

## 设计决策

采用轻量视觉调整，不改变数据流、拖拽持久化协议或历史列表结构。

### 历史记录选中态

- 取消选中态的整行背景、border 和 shadow。
- 使用左侧短强调条表达 selected 状态，保持高度约 20px。
- 保留 icon 的轻微边框强调与标题字重变化。
- hover 状态继续使用浅底，方便鼠标扫列表。

### 标题截断

- `min-w-0`、`flex-1`、`truncate` 仍作为最终 CSS 保险。
- 根据左侧栏实时宽度计算 `titleMaxUnits`，并按 visual unit 截断标题。ASCII 计 1 unit，CJK / 全角字符计 2 units。
- 拖拽过程中同步 live sidebar width，让标题在拖动时就重新渲染，而不是只在松手后更新。
- 截断时保留原始 `title` attribute 和 `aria-label`，方便完整标题可访问与 hover 查看。

### Resizer 与右侧间距

- 收紧左栏右侧 padding 与右侧详情左侧 padding，让 resizer 和预览框关系更紧密。
- 保持 resizer 的 8px 可点击热区，不降低可操作性。
- 中心线改为短胶囊视觉，hover / active 时加宽并使用 accent 颜色，明确表达可拖动。

## 验证范围

- 更新 `HistoryRow` 的 compact row 和 selected row 测试。
- 保持现有 resizable column 宽度恢复、拖拽、clamp 测试通过。
- 运行 `npm run test:frontend`。
