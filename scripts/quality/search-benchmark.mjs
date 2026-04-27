import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const qualityDir = path.join(repoRoot, ".docs", "quality");
const fixtureDir = path.join(qualityDir, "fixtures");
const fixturePath = path.join(fixtureDir, "search-benchmark-sample-1000.json");
const reportJsonPath = path.join(qualityDir, "search-benchmark-report.json");
const reportMdPath = path.join(qualityDir, "search-benchmark-report.md");

const APPS = [
  "Linear",
  "Notion",
  "Figma",
  "Warp",
  "iTerm",
  "Safari",
  "Chrome",
  "VS Code",
  "Mail",
  "Slack",
];

const TEXT_SNIPPETS = [
  "deploy checklist for release train",
  "incident rollback runbook",
  "customer escalation summary",
  "clipboard diagnostics export contract",
  "window fallback safe area validation",
  "privacy exclusion rule review",
  "search benchmark baseline evidence",
  "performance regression watchlist",
  "launch at login recovery flow",
  "dock reopen single window contract",
];

const CHINESE_SNIPPETS = [
  "剪贴板回退验证记录",
  "支付回调异常排查说明",
  "恢复模式只读保护审计",
  "菜单栏回退窗口诊断样例",
  "中文搜索回退性能基线",
  "权限缺失降级链路复核",
  "启动时自动显示空搜索态",
  "多显示器安全区回退记录",
  "诊断导出字段映射检查",
  "快捷键冲突复测清单",
];

const HTML_SNIPPETS = [
  "Bold summary with release notes",
  "Rich text editor degraded to plain text",
  "Mail draft formatting fallback",
  "Design review checklist with bullets",
  "Hyperlink archive for launch review",
];

const FILE_SNIPPETS = [
  "Product-Spec-v12.pdf",
  "Release-Checklist.pages",
  "screenshot-incident-bridge.png",
  "database-migration-report.csv",
  "customer-feedback-export.xlsx",
];

const IMAGE_SNIPPETS = [
  "PNG 1440x900 dashboard capture",
  "JPG issue reproduction frame",
  "PNG menu bar fallback screenshot",
  "JPG launch review whiteboard",
  "PNG diagnostics export sample",
];

const QUERIES = [
  { label: "exact_text", query: "deploy checklist for release train", category: "exact" },
  { label: "prefix_text", query: "deploy", category: "prefix" },
  { label: "contains_text", query: "rollback runbook", category: "contains" },
  { label: "exact_chinese", query: "剪贴板回退验证记录", category: "chinese" },
  { label: "prefix_chinese", query: "支付回调", category: "chinese" },
  { label: "contains_chinese", query: "安全区回退", category: "chinese" },
  { label: "diagnostics", query: "diagnostics export", category: "contains" },
  { label: "window_fallback", query: "window fallback", category: "contains" },
  { label: "privacy", query: "privacy exclusion", category: "contains" },
  { label: "launch_login", query: "launch at login", category: "contains" },
  { label: "dock_reopen", query: "dock reopen", category: "contains" },
  { label: "search_baseline", query: "search benchmark baseline", category: "contains" },
  { label: "恢复模式", query: "恢复模式", category: "chinese" },
  { label: "诊断导出", query: "诊断导出", category: "chinese" },
  { label: "多显示器", query: "多显示器", category: "chinese" },
  { label: "快捷键冲突", query: "快捷键冲突", category: "chinese" },
  { label: "mail_rich_text", query: "mail draft formatting", category: "contains" },
  { label: "image_capture", query: "dashboard capture", category: "contains" },
  { label: "file_pdf", query: "Product-Spec-v12.pdf", category: "exact" },
  { label: "browser_upload", query: "customer-feedback-export.xlsx", category: "exact" },
  { label: "no_result", query: "unmatched synthetic probe", category: "negative" },
  { label: "source_app", query: "figma", category: "contains" },
  { label: "meta_kind", query: "image pasteboard", category: "contains" },
  { label: "terminal", query: "warp", category: "contains" },
];

function normalize(value) {
  return value.trim().toLowerCase();
}

function percentile(values, p) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function makeItem(index) {
  const kindCycle = ["text", "html", "rtf", "image", "file"];
  const kind = kindCycle[index % kindCycle.length];
  const cohort = Math.floor(index / kindCycle.length);
  const app = APPS[index % APPS.length];
  const english = TEXT_SNIPPETS[cohort % TEXT_SNIPPETS.length];
  const chinese = CHINESE_SNIPPETS[Math.floor(index / 7) % CHINESE_SNIPPETS.length];
  const html = HTML_SNIPPETS[cohort % HTML_SNIPPETS.length];
  const fileName = FILE_SNIPPETS[cohort % FILE_SNIPPETS.length];
  const image = IMAGE_SNIPPETS[cohort % IMAGE_SNIPPETS.length];

  let title = `${english} #${index + 1}`;
  let preview = `${chinese} | owner:${app} | batch:${Math.floor(index / 25)}`;
  let meta = `kind=${kind}; source=${app}; search baseline cohort=${index % 8}`;

  if (kind === "html" || kind === "rtf") {
    title = `${html} #${index + 1}`;
    preview = `${english} | ${chinese}`;
    meta = `kind=${kind}; source=${app}; rich text fallback`;
  }

  if (kind === "image") {
    title = `${image} #${index + 1}`;
    preview = `${chinese} | image pasteboard validation`;
    meta = `kind=image; source=${app}; image pasteboard`;
  }

  if (kind === "file") {
    title = `${fileName} #${index + 1}`;
    preview = `${english} | ${chinese}`;
    meta = `kind=file; source=${app}; file url payload`;
  }

  return {
    id: `bench-${String(index + 1).padStart(4, "0")}`,
    kind,
    title,
    preview,
    sourceApp: app,
    meta,
    timeLabel: `${(index % 59) + 1}m`,
    isPinned: index % 17 === 0,
  };
}

function buildDataset(size = 1000) {
  return Array.from({ length: size }, (_, index) => makeItem(index));
}

function filterItems(items, query) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return [...items];
  }

  return items.filter((item) =>
    [item.title, item.preview, item.sourceApp, item.meta].join(" ").toLowerCase().includes(normalizedQuery),
  );
}

function benchmarkQuery(items, query) {
  const durations = [];
  let lastResults = [];

  for (let round = 0; round < 25; round += 1) {
    const startedAt = performance.now();
    lastResults = filterItems(items, query);
    const endedAt = performance.now();

    if (round >= 5) {
      durations.push(endedAt - startedAt);
    }
  }

  return {
    total: lastResults.length,
    p50Ms: Number(percentile(durations, 50).toFixed(3)),
    p95Ms: Number(percentile(durations, 95).toFixed(3)),
    maxMs: Number(Math.max(...durations).toFixed(3)),
    sampleIds: lastResults.slice(0, 5).map((item) => item.id),
  };
}

function summarizeKinds(items) {
  return items.reduce((summary, item) => {
    summary[item.kind] = (summary[item.kind] ?? 0) + 1;
    return summary;
  }, {});
}

function buildMarkdownReport(report) {
  const queryRows = report.queries
    .map(
      (entry) =>
        `| ${entry.label} | ${entry.category} | \`${entry.query}\` | ${entry.total} | ${entry.p50Ms} | ${entry.p95Ms} | ${entry.maxMs} | ${entry.sampleIds.join(", ") || "-"} |`,
    )
    .join("\n");

  return [
    "# SuperClip 搜索性能验证报告",
    "",
    `- 生成时间: ${report.generatedAt}`,
    `- 数据集文件: \`${path.relative(repoRoot, fixturePath)}\``,
    `- 样本总数: ${report.dataset.size}`,
    `- 类型分布: ${Object.entries(report.dataset.kindDistribution)
      .map(([kind, count]) => `${kind}=${count}`)
      .join(", ")}`,
    "- 说明: 当前脚本基于仓库现有 in-memory contains 搜索路径建立 P0 基线，用于先行校验 1k 样本口径与查询分布；SQLite/FTS 接入后应复用同一查询集重新跑一轮。",
    "",
    "## 总体指标",
    "",
    `- 查询数: ${report.summary.queryCount}`,
    `- P50: ${report.summary.p50Ms} ms`,
    `- P95: ${report.summary.p95Ms} ms`,
    `- Max: ${report.summary.maxMs} ms`,
    `- Architecture 目标: P95 <= 120 ms`,
    `- 当前结论: ${report.summary.p95Ms <= 120 ? "通过当前基线门" : "未达当前基线门"}`,
    "",
    "## 查询明细",
    "",
    "| 标签 | 类别 | 查询词 | 命中数 | P50(ms) | P95(ms) | Max(ms) | 前 5 条样本 ID |",
    "|---|---|---|---:|---:|---:|---:|---|",
    queryRows,
    "",
  ].join("\n");
}

async function main() {
  const dataset = buildDataset(1000);
  const queryResults = QUERIES.map((query) => ({
    ...query,
    ...benchmarkQuery(dataset, query.query),
  }));
  const allP50 = queryResults.map((entry) => entry.p50Ms);
  const allP95 = queryResults.map((entry) => entry.p95Ms);
  const allMax = queryResults.map((entry) => entry.maxMs);
  const report = {
    generatedAt: new Date().toISOString(),
    dataset: {
      size: dataset.length,
      kindDistribution: summarizeKinds(dataset),
    },
    summary: {
      queryCount: queryResults.length,
      p50Ms: Number(percentile(allP50, 50).toFixed(3)),
      p95Ms: Number(percentile(allP95, 95).toFixed(3)),
      maxMs: Number(Math.max(...allMax).toFixed(3)),
    },
    queries: queryResults,
  };

  await mkdir(fixtureDir, { recursive: true });
  await writeFile(fixturePath, `${JSON.stringify(dataset, null, 2)}\n`);
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(reportMdPath, `${buildMarkdownReport(report)}\n`);

  console.log(`fixture: ${path.relative(repoRoot, fixturePath)}`);
  console.log(`report: ${path.relative(repoRoot, reportMdPath)}`);
  console.log(`summary: P50=${report.summary.p50Ms}ms P95=${report.summary.p95Ms}ms max=${report.summary.maxMs}ms`);
}

await main();
