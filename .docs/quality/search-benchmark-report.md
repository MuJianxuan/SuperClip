# SuperClip 搜索性能验证报告

- 生成时间: 2026-05-06T12:57:42.925Z
- 数据集文件: `.docs/quality/fixtures/search-benchmark-sample-1000.json`
- 样本总数: 1000
- 类型分布: text=200, html=200, rtf=200, image=200, file=200
- 说明: 当前脚本基于仓库现有 in-memory contains 搜索路径建立 P0 基线，用于先行校验 1k 样本口径与查询分布；SQLite/FTS 接入后应复用同一查询集重新跑一轮。

## 总体指标

- 查询数: 24
- P50: 0.477 ms
- P95: 0.972 ms
- Max: 1.688 ms
- Architecture 目标: P95 <= 120 ms
- 当前结论: 通过当前基线门

## 查询明细

| 标签 | 类别 | 查询词 | 命中数 | P50(ms) | P95(ms) | Max(ms) | 前 5 条样本 ID |
|---|---|---|---:|---:|---:|---:|---|
| exact_text | exact | `deploy checklist for release train` | 80 | 0.512 | 0.86 | 0.975 | bench-0001, bench-0002, bench-0003, bench-0005, bench-0051 |
| prefix_text | prefix | `deploy` | 80 | 0.491 | 0.659 | 0.792 | bench-0001, bench-0002, bench-0003, bench-0005, bench-0051 |
| contains_text | contains | `rollback runbook` | 80 | 0.526 | 1.085 | 1.36 | bench-0006, bench-0007, bench-0008, bench-0010, bench-0056 |
| exact_chinese | chinese | `剪贴板回退验证记录` | 105 | 0.462 | 0.512 | 0.536 | bench-0001, bench-0002, bench-0003, bench-0004, bench-0005 |
| prefix_chinese | chinese | `支付回调` | 105 | 0.556 | 0.657 | 0.709 | bench-0008, bench-0009, bench-0010, bench-0011, bench-0012 |
| contains_chinese | chinese | `安全区回退` | 98 | 0.453 | 0.61 | 0.75 | bench-0050, bench-0051, bench-0052, bench-0053, bench-0054 |
| diagnostics | contains | `diagnostics export` | 120 | 0.482 | 0.664 | 1.426 | bench-0016, bench-0017, bench-0018, bench-0020, bench-0024 |
| window_fallback | contains | `window fallback` | 80 | 0.446 | 0.855 | 1.688 | bench-0021, bench-0022, bench-0023, bench-0025, bench-0071 |
| privacy | contains | `privacy exclusion` | 80 | 0.481 | 0.774 | 0.804 | bench-0026, bench-0027, bench-0028, bench-0030, bench-0076 |
| launch_login | contains | `launch at login` | 80 | 0.476 | 0.686 | 0.832 | bench-0041, bench-0042, bench-0043, bench-0045, bench-0091 |
| dock_reopen | contains | `dock reopen` | 80 | 0.457 | 0.529 | 0.555 | bench-0046, bench-0047, bench-0048, bench-0050, bench-0096 |
| search_baseline | contains | `search benchmark baseline` | 80 | 0.483 | 0.772 | 0.774 | bench-0031, bench-0032, bench-0033, bench-0035, bench-0081 |
| 恢复模式 | chinese | `恢复模式` | 104 | 0.477 | 0.911 | 0.996 | bench-0015, bench-0016, bench-0017, bench-0018, bench-0019 |
| 诊断导出 | chinese | `诊断导出` | 98 | 0.47 | 0.55 | 0.553 | bench-0057, bench-0058, bench-0059, bench-0060, bench-0061 |
| 多显示器 | chinese | `多显示器` | 98 | 0.426 | 0.507 | 0.615 | bench-0050, bench-0051, bench-0052, bench-0053, bench-0054 |
| 快捷键冲突 | chinese | `快捷键冲突` | 98 | 0.476 | 0.913 | 0.999 | bench-0064, bench-0065, bench-0066, bench-0067, bench-0068 |
| mail_rich_text | contains | `mail draft formatting` | 80 | 0.488 | 0.818 | 1.239 | bench-0012, bench-0013, bench-0037, bench-0038, bench-0062 |
| image_capture | contains | `dashboard capture` | 40 | 0.478 | 0.972 | 1.126 | bench-0004, bench-0029, bench-0054, bench-0079, bench-0104 |
| file_pdf | exact | `Product-Spec-v12.pdf` | 40 | 0.466 | 0.613 | 0.712 | bench-0005, bench-0030, bench-0055, bench-0080, bench-0105 |
| browser_upload | exact | `customer-feedback-export.xlsx` | 40 | 0.523 | 0.64 | 0.771 | bench-0025, bench-0050, bench-0075, bench-0100, bench-0125 |
| no_result | negative | `unmatched synthetic probe` | 0 | 0.452 | 0.636 | 0.783 | - |
| source_app | contains | `figma` | 100 | 0.482 | 0.786 | 0.998 | bench-0003, bench-0013, bench-0023, bench-0033, bench-0043 |
| meta_kind | contains | `image pasteboard` | 200 | 0.515 | 0.703 | 0.752 | bench-0004, bench-0009, bench-0014, bench-0019, bench-0024 |
| terminal | contains | `warp` | 100 | 0.432 | 0.482 | 0.513 | bench-0004, bench-0014, bench-0024, bench-0034, bench-0044 |

