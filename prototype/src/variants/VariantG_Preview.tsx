import { useState } from "react";
import { FileImage, Clock, ChevronLeft, ChevronRight } from "lucide-react";

/* ================================================================
   Variant G2 — Preview (独立预览浮窗 · 重设计)

   CONTEXT 规格：悬停 Popup 历史行后出现的独立只读浮窗，
   「只读、不抢点击主路径」→ 移除旧版 header 的复制/查看/关闭按钮，
   仅保留信息层（类型色点 + 类型 + 时间 + 来源）。

   相对旧版 G 的改动：
   - 无任何操作按钮（复制/查看/关闭一律移除）——符合只读定位
   - 代码块富渲染：``` 段 → 等宽深底块（区分普通段落）
   - 信息合并：header 承载类型+时间，footer 仅"来自 · App"
   - hover/切换全部由 React state 驱动（移除直接 DOM 操作）
   - 长文本 max-height 内滚动；图片尺寸保持 280×240 级别
   ================================================================ */

const PREVIEW_ITEMS = [
  {
    id: "p1",
    kind: "text",
    title: "useEffect 清理函数的最佳实践",
    content: "在 React 18+ 中，useEffect 的清理函数在 StrictMode 下会被调用两次。这是为了帮助你发现副作用中的问题。\n\n正确的做法是确保清理函数是幂等的，并且能够安全地多次执行。\n\n```tsx\nuseEffect(() => {\n  const subscription = source.subscribe();\n  return () => {\n    subscription.unsubscribe();\n  };\n}, []);\n```\n\n这条规则适用于所有包含订阅、定时器、事件监听的副作用。",
    app: "Arc",
    time: "1 小时前",
  },
  {
    id: "p2",
    kind: "image",
    title: "截屏 2026-08-02 14.30.22.png",
    content: "1600×1200 屏幕截图",
    app: "系统截屏",
    time: "15 分钟前",
  },
  {
    id: "p3",
    kind: "html",
    title: "Tailwind CSS v4 新特性一览",
    content: "Tailwind CSS v4 引入了全新的 CSS-first 配置方式，无需 tailwind.config.js。\n\n主要新特性：\n- CSS-first 配置 — 直接在 CSS 中使用 @theme 指令\n- 改进的性能 — 构建速度提升 40%\n- 零配置起步 — 无需 PostCSS 配置\n- 更好的 TypeScript 支持 — 完整的类型定义\n\n这是 Tailwind 团队过去一年中最重要的版本更新。",
    app: "Safari",
    time: "2 小时前",
  },
];

const kindColors: Record<string, string> = {
  text: "#38bdf8",
  html: "#a78bfa",
  image: "#fb7185",
  file: "#60a5fa",
};

const kindLabels: Record<string, string> = {
  text: "文本",
  html: "HTML",
  image: "图片",
  file: "文件",
};

const placeholderColors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

export function VariantG_Preview() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const item = PREVIEW_ITEMS[currentIndex];
  const isImage = item.kind === "image";
  const accent = kindColors[item.kind] ?? "#64748b";
  const placeholderColor = placeholderColors[currentIndex % placeholderColors.length];

  const prevItem = () => setCurrentIndex((i) => (i - 1 + PREVIEW_ITEMS.length) % PREVIEW_ITEMS.length);
  const nextItem = () => setCurrentIndex((i) => (i + 1) % PREVIEW_ITEMS.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      {/* ============ Preview 浮窗（只读） ============ */}
      <div
        key={item.id}
        style={{
          width: 320,
          borderRadius: 14,
          background: "rgba(18, 23, 30, 0.88)",
          backdropFilter: "blur(36px) saturate(1.6)",
          WebkitBackdropFilter: "blur(36px) saturate(1.6)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.04)",
          overflow: "hidden",
          animation: "previewFadeIn 0.22s ease-out",
        }}
      >
        {/* --- Header: 信息层（无操作按钮） --- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: accent,
                boxShadow: `0 0 6px ${accent}40`,
              }}
            />
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {kindLabels[item.kind] ?? item.kind}
            </span>
          </div>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", fontVariantNumeric: "tabular-nums" }}>
            {item.time}
          </span>
        </div>

        {/* 内容区 */}
        <div style={{ padding: isImage ? 12 : "14px 16px 12px" }}>
          {isImage ? (
            <div
              style={{
                width: "100%",
                height: 190,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${placeholderColor}14, ${placeholderColor}06)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.04)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{
                position: "absolute",
                inset: 0,
                opacity: 0.05,
                backgroundImage: `radial-gradient(circle at 30% 40%, ${placeholderColor} 0%, transparent 50%), radial-gradient(circle at 70% 60%, ${placeholderColor} 0%, transparent 50%)`,
              }} />
              <div style={{ textAlign: "center", position: "relative" }}>
                <FileImage size={30} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", display: "block" }}>
                  {item.content}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.1)", display: "block", marginTop: 4 }}>
                  {item.title}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              {/* 标题 */}
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.8)",
                  margin: "0 0 10px",
                  lineHeight: 1.4,
                }}
              >
                {item.title}
              </h3>
              {/* 富文本：区分段落与代码块 */}
              {renderRichContent(item.content)}
            </div>
          )}
        </div>

        {/* 底部：来源信息 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 14px",
            borderTop: "1px solid rgba(255,255,255,0.03)",
          }}
        >
          <Clock size={10} color="rgba(255,255,255,0.12)" />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>来自 {item.app}</span>
        </div>
      </div>

      {/* ============ 导航（原型演示控件） ============ */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <NavButton onClick={prevItem} label="上一个">
          <ChevronLeft size={14} />
        </NavButton>

        <div style={{ display: "flex", gap: 6 }}>
          {PREVIEW_ITEMS.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              style={{
                width: idx === currentIndex ? 18 : 5,
                height: 5,
                borderRadius: idx === currentIndex ? 3 : "50%",
                background: idx === currentIndex ? "rgba(56,189,248,0.7)" : "rgba(255,255,255,0.12)",
                transition: "all 0.2s ease",
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        <NavButton onClick={nextItem} label="下一个">
          <ChevronRight size={14} />
        </NavButton>
      </div>

      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.1)", marginTop: 2 }}>
        Preview 只读浮窗 · Popup 悬停时自动出现
      </span>
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */

/** 段落与代码块（ ``` 包裹段）区分渲染 */
function renderRichContent(content: string) {
  const segments = content.split("```");

  return segments.map((seg, idx) => {
    if (idx % 2 === 1) {
      // 代码块：去除首行语言标注（如 tsx），等宽深底
      const lines = seg.split("\n");
      const firstLine = lines[0].trim();
      const isLangLine = /^[a-z]+$/.test(firstLine) && lines.length > 1;
      const codeLines = isLangLine ? lines.slice(1) : lines;

      return (
        <pre
          key={idx}
          style={{
            margin: "8px 0",
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(10, 14, 20, 0.6)",
            border: "1px solid rgba(255,255,255,0.04)",
            fontSize: 11,
            lineHeight: 1.6,
            color: "rgba(56,189,248,0.75)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            whiteSpace: "pre",
            overflowX: "auto",
          }}
        >
          {codeLines.join("\n")}
        </pre>
      );
    }

    // 普通段落：按空行拆段
    return seg.split(/\n\n+/).filter((p) => p.trim()).map((para, i) => (
      <p
        key={`${idx}-${i}`}
        style={{
          fontSize: 12,
          lineHeight: 1.7,
          color: "rgba(255,255,255,0.5)",
          margin: "0 0 8px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {para.trim()}
      </p>
    ));
  });
}

function NavButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: `1px solid ${
          hovered ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.06)"
        }`,
        background: hovered ? "rgba(56,189,248,0.07)" : "rgba(255,255,255,0.03)",
        color: hovered ? "rgba(56,189,248,0.7)" : "rgba(255,255,255,0.3)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.12s ease",
      }}
    >
      {children}
    </button>
  );
}