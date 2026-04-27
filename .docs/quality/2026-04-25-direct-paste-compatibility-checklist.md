# SuperClip P0 Direct Paste 兼容性验证清单

## 目的
- 对齐 `output/superclip-prd.md`、`output/superclip-architecture.md`、`output/superclip-uiux.md` 中已经冻结的 direct paste / degrade / fallback 契约。
- 为 Phase 6 的录屏、截图、diagnostics 导出样例提供统一执行口径。
- 明确 Tier A / B / C / D 的目标类型、预期结果、必须记录的错误码与证据。

## 执行前准备
- 构建产物使用当前可运行宿主版本，确保 `npm run build` 与 `cargo check` 已通过。
- 准备至少 4 类样本：
  - `text`：短文本、长文本、多行文本
  - `html/rtf`：带粗体、链接、列表的富文本
  - `image`：PNG 或 JPG 图片
  - `file`：单文件、多个文件
- 准备 diagnostics 导出目录，确保能在每轮失败后立即导出样例。
- 每次执行时记录：
  - 构建版本
  - macOS 版本
  - 目标应用名
  - 目标输入区类型
  - 结果类型
  - error code
  - 证据路径

## Tier 定义
| Tier | 目标类型 | 典型目标 | 目标 |
|---|---|---|---|
| Tier A | plain text happy path | Terminal、IDE 普通输入框、系统文本框 | 验证 `text` direct paste 成功基线 |
| Tier B | rich text degrade path | 邮件正文、文档编辑器、富文本输入区 | 验证 `html/rtf` 退化为 plain text 时的文案与诊断 |
| Tier C | binary fallback path | 图片输入区、聊天输入框、上传组件 | 验证 `image` 失败时 1 秒内回退 copy-only |
| Tier D | fixed copy-only path | Finder、IDE 文件树、浏览器上传区 | 验证 `file` 不承诺 direct paste，主动作直接走 copy-only |

## 核心检查项
| 编号 | Tier | 样本类型 | 操作 | 预期结果 | 必须记录 |
|---|---|---|---|---|---|
| 1 | A | `text` | 唤起 SuperClip，搜索文本项，`Enter` | direct paste 成功；不要求用户二次操作 | 录屏、目标应用截图 |
| 2 | A | `text` | 未授权 Accessibility 时执行相同步骤 | 回退 copy-only；顶部 banner 与 toast 口径一致 | 录屏、`NO_ACCESSIBILITY`、diagnostics |
| 3 | B | `html/rtf` | 在支持富文本的编辑区执行 | 最佳努力 direct paste；允许保留格式 | 录屏、目标效果截图 |
| 4 | B | `html/rtf` | 在不完整支持富文本的输入区执行 | warning toast 明确“格式未保留” | 录屏、`RICH_TEXT_DEGRADED`、diagnostics |
| 5 | C | `image` | 在接受图片 pasteboard 的目标区执行 | 最佳努力 direct paste；若失败则 1 秒内回退 copy-only | 录屏、耗时、diagnostics |
| 6 | C | `image` | 在不接受图片 pasteboard 的目标区执行 | 明确提示“已复制到剪贴板，可手动粘贴” | 录屏、`PAYLOAD_UNSUPPORTED`、diagnostics |
| 7 | D | `file` | 选择文件项执行主动作 | 直接走 copy-only，不制造 direct paste 预期 | 录屏、主按钮文案截图 |
| 8 | D | `file` | 多文件项重复执行 | 仍为 copy-only，数量摘要清晰 | 录屏、摘要截图 |

## 降级与失败口径
| 场景 | 预期反馈 | 必须出现的错误码或状态 |
|---|---|---|
| 无 Accessibility | 顶部 banner + 可继续 copy-only | `NO_ACCESSIBILITY` |
| rich text 退化 | warning toast，明确“已粘贴，但格式未保留” | `RICH_TEXT_DEGRADED` |
| image fallback | warning toast，明确“已复制到剪贴板，可手动粘贴” | `PAYLOAD_UNSUPPORTED` |
| file 固定仅复制 | 主动作文案直接体现 copy-only | `mode=copy_only` |
| 恢复模式写路径阻断 | 只读说明，不崩溃 | `RECOVERY_MODE_READ_ONLY` |

## Diagnostics 导出核对
每完成一轮异常路径验证后，必须导出一次 diagnostics，并检查：

| 字段 | 必须包含 |
|---|---|
| `recent_errors` | 至少能定位 `paste-failed/*`、`shortcut-conflict-detected/*`、`recovery-mode-blocked/*` 中的相关记录 |
| `window_fallback_records` | 发生窗口回退时包含 `display_id`、`fallback_reason`、`window_mode` |
| `migration_summary` | 若处于恢复模式，`error_code=RECOVERY_MODE_READ_ONLY` |
| `permissions` | `accessibility_trusted` 与执行时状态一致 |

## 证据留存模板
| 日期 | Tier | 目标应用 | 样本类型 | 结果 | error code | diagnostics 文件 | 录屏 / 截图 |
|---|---|---|---|---|---|---|---|
| YYYY-MM-DD | A/B/C/D |  |  | success / degrade / fallback |  |  |  |

## 通过标准
- Tier A 至少 2 个目标应用通过 direct paste happy path。
- Tier B 至少 1 个目标应用出现可解释的 rich text degrade，并能在 diagnostics 中定位。
- Tier C 至少 1 个目标应用出现 image fallback，并满足 1 秒内反馈。
- Tier D 至少 2 个文件目标应用验证 copy-only 固定路径。
- 所有异常路径的文案都满足“发生了什么 + 下一步怎么做”的 UI 规则。
