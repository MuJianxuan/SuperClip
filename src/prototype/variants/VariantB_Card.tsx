import { useEffect, useRef, useState, useCallback } from "react";
import { Search, FileImage, FileText, LinkIcon, Clock, Star, X } from "lucide-react";
import type { ClipboardItem } from "../../components/history-row";

/* ================================================================
   Variant B2 — Popup (磨砂玻璃 · 重设计)

   设计目标：快捷历史面板 —— 打开即见，一屏 7-10 条，悬停预览。
   符合 CONTEXT 规格：无功能底栏、无类型过滤。

   相对旧版 B 的改动：
   - 单行紧凑搜索（去独立标题行，加清空 × 与快捷键徽标）
   - 行两行化：标题 + 预览截断，右侧时间；去类型徽标
   - 行高 ≈46px，一屏 8-9 条（密度达标）
   - 选中态左侧类型色条 + 图标染色（与 Main 同一语言）
   - 置顶琥珀星标
   - 底部信息栏单行化（无按钮）
   ================================================================ */

interface Props {
  items: ClipboardItem[];
  selectedId: string;
  selectedItem: ClipboardItem | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
}

function KindIcon({ kind }: { kind: string }) {
  const size = 13;
  switch (kind) {
    case "image": return <FileImage size={size} />;
    case "file":  return <FileText size={size} />;
    case "html":  return <LinkIcon size={size} />;
    default:      return <FileText size={size} />;
  }
}

const kindColors: Record<string, string> = {
  text: "#38bdf8",
  html: "#a78bfa",
  rtf: "#22d3ee",
  image: "#fb7185",
  file: "#60a5fa",
};

/* ---------- Frosted Glass Popup ---------- */

export function VariantB_Card({ items, selectedId, query, onQueryChange, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<ClipboardItem | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [previewPos, setPreviewPos] = useState<{ top: number; left: number } | null>(null);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);
  const previewTimerRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  const handleCardMouseEnter = useCallback(
    (item: ClipboardItem, cardEl: HTMLElement) => {
      setHoveredId(item.id);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      const cardRect = cardEl.getBoundingClientRect();
      const popupRect = popupRef.current?.getBoundingClientRect();

      // Preview to the right of popup, aligned with card
      const popupRight = popupRect ? popupRect.right : 0;
      const previewWidth = item.kind === "image" ? 240 : 280;
      const gap = 8;

      let left = popupRight + gap;
      let top = cardRect.top;

      // If preview would go off-screen right, show to the left of popup
      if (left + previewWidth > window.innerWidth - 16) {
        left = (popupRect?.left ?? 0) - gap - previewWidth;
      }

      // Clamp top so preview doesn't go off-screen
      top = Math.max(8, Math.min(top, window.innerHeight - 300));

      setPreviewPos({ top, left });

      // Delay showing preview
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = window.setTimeout(() => {
        setHoveredItem(item);
      }, 200);
    },
    [],
  );

  const handleCardMouseLeave = useCallback(() => {
    setHoveredId(null);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // Give user time to move to the preview
    previewTimerRef.current = window.setTimeout(() => {
      if (!isPreviewHovered) {
        setHoveredItem(null);
        setPreviewPos(null);
      }
    }, 150);
  }, [isPreviewHovered]);

  const handlePreviewEnter = useCallback(() => {
    setIsPreviewHovered(true);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
  }, []);

  const handlePreviewLeave = useCallback(() => {
    setIsPreviewHovered(false);
    setHoveredItem(null);
    setPreviewPos(null);
  }, []);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-start" }}>
      {/* --- Popup --- */}
      <div
        ref={popupRef}
        className="mock-popup"
        style={{
          width: 320,
          background: "rgba(18, 23, 30, 0.78)",
          backdropFilter: "blur(36px) saturate(1.6)",
          WebkitBackdropFilter: "blur(36px) saturate(1.6)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.04)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {/* --- Single-row Search --- */}
        <div style={{ padding: "10px 10px 8px", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.04)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
              transition: "border-color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(56,189,248,0.3)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)")}
          >
            <Search size={13} color="rgba(255,255,255,0.25)" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.currentTarget.value)}
              placeholder="搜索..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "rgba(255,255,255,0.8)",
                fontSize: 12.5,
                fontWeight: 400,
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "none",
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.3)",
                  flexShrink: 0,
                }}
              >
                <X size={9} />
              </button>
            )}
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "2px 5px",
                borderRadius: 5,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.2)",
                fontFamily: "monospace",
                flexShrink: 0,
              }}
            >
              ⌘⇧V
            </span>
          </div>
        </div>

        {/* --- History List --- */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 4px" }}>
          {items.length === 0 ? (
            <div style={{ padding: "36px 20px", textAlign: "center" }}>
              <FileText size={26} style={{ margin: "0 auto 8px", opacity: 0.15, display: "block" }} />
              <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 12.5, margin: 0 }}>
                {query ? "没有匹配的内容" : "剪贴板暂无记录"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {items.map((item, idx) => {
                const isSelected = item.id === selectedId;
                const isHovered = item.id === hoveredId;
                const accent = kindColors[item.kind] ?? "rgba(255,255,255,0.3)";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    onMouseEnter={(e) => handleCardMouseEnter(item, e.currentTarget)}
                    onMouseLeave={handleCardMouseLeave}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "7px 9px",
                      borderRadius: 9,
                      border: "none",
                      background: isSelected
                        ? "rgba(56, 189, 248, 0.07)"
                        : isHovered
                          ? "rgba(255,255,255,0.03)"
                          : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      position: "relative",
                      transition: "background 0.12s ease",
                      animation: idx < 5 ? `rowSlideIn ${0.1 + idx * 0.025}s ease-out both` : "none",
                    }}
                  >
                    {/* selection accent */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 3,
                        height: isSelected ? 18 : 0,
                        borderRadius: 2,
                        background: accent,
                        opacity: isSelected ? 0.85 : 0,
                        transition: "all 0.15s ease",
                      }}
                    />

                    {/* kind icon */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isSelected
                          ? `${accent}14`
                          : "rgba(255,255,255,0.04)",
                        color: isSelected ? accent : "rgba(255,255,255,0.28)",
                        flexShrink: 0,
                        transition: "all 0.12s ease",
                      }}
                    >
                      <KindIcon kind={item.kind} />
                    </div>

                    {/* title + preview */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected ? 550 : 450,
                            color: isSelected
                              ? "rgba(255,255,255,0.95)"
                              : "rgba(255,255,255,0.7)",
                            lineHeight: 1.25,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.title}
                        </span>
                        {item.isPinned && (
                          <Star size={9} fill="rgba(251,191,36,0.8)" color="rgba(251,191,36,0.8)" style={{ flexShrink: 0 }} />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.28)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {item.preview}
                      </span>
                    </div>

                    {/* right side: time */}
                    <span
                      style={{
                        fontSize: 10,
                        color: isSelected ? "rgba(56,189,248,0.5)" : "rgba(255,255,255,0.15)",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {item.timeLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* --- Footer status (informational only, no actions) --- */}
        <div
          style={{
            padding: "7px 12px 9px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.03)",
          }}
        >
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.2)" }}>
            共 {items.length} 条
          </span>
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.12)",
              padding: "2px 8px",
              borderRadius: 100,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            悬停预览
          </span>
        </div>
      </div>

      {/* --- Floating Preview --- */}
      {hoveredItem && previewPos && (
        <FloatingPreview
          item={hoveredItem}
          top={previewPos.top}
          left={previewPos.left}
          onMouseEnter={handlePreviewEnter}
          onMouseLeave={handlePreviewLeave}
        />
      )}
    </div>
  );
}

/* ---------- Floating Preview Component ---------- */

interface FloatingPreviewProps {
  item: ClipboardItem;
  top: number;
  left: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function FloatingPreview({ item, top, left, onMouseEnter, onMouseLeave }: FloatingPreviewProps) {
  const isImage = item.kind === "image";
  const previewWidth = isImage ? 240 : 280;
  const previewMaxHeight = isImage ? 240 : 320;

  // Generate a deterministic placeholder color based on item id
  const placeholderColors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];
  const colorIndex = parseInt(item.id, 36) % placeholderColors.length;
  const placeholderColor = placeholderColors[colorIndex];

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 9998,
        width: previewWidth,
        maxHeight: previewMaxHeight,
        borderRadius: 12,
        background: "rgba(18, 23, 30, 0.88)",
        backdropFilter: "blur(36px) saturate(1.6)",
        WebkitBackdropFilter: "blur(36px) saturate(1.6)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.04)",
        overflow: "hidden",
        animation: "previewFadeIn 0.15s ease-out",
      }}
    >
      {/* Preview header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: kindColors[item.kind] ?? "rgba(255,255,255,0.3)",
              boxShadow: "0 0 6px " + (kindColors[item.kind] ?? "rgba(255,255,255,0.3)") + "40",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {item.kind === "text" ? "文本" : item.kind === "image" ? "图片" : item.kind === "file" ? "文件" : item.kind === "html" ? "HTML" : item.kind}
          </span>
        </div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{item.sourceApp}</span>
      </div>

      {/* Preview body */}
      <div style={{ padding: isImage ? 8 : "10px 12px" }}>
        {isImage ? (
          <div
            style={{
              width: "100%",
              height: 160,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${placeholderColor}15, ${placeholderColor}08)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.15)",
              fontSize: 12,
              border: "1px solid rgba(255,255,255,0.04)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative pattern */}
            <div style={{
              position: "absolute",
              inset: 0,
              opacity: 0.04,
              backgroundImage: `radial-gradient(circle at 20% 30%, ${placeholderColor} 0%, transparent 50%), radial-gradient(circle at 80% 70%, ${placeholderColor} 0%, transparent 50%)`,
            }} />
            <div style={{ textAlign: "center", position: "relative" }}>
              <FileImage size={28} style={{ margin: "0 auto 6px", opacity: 0.3 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", display: "block" }}>
                {item.meta || "图片预览"}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.1)", display: "block", marginTop: 2 }}>
                {item.preview}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ maxHeight: 200, overflow: "auto" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", margin: "0 0 8px", lineHeight: 1.4 }}>
              {item.title}
            </h3>
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.55)",
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {item.preview}
            </p>
          </div>
        )}
      </div>

      {/* Preview footer */}
      <div
        style={{
          padding: "6px 12px",
          borderTop: "1px solid rgba(255,255,255,0.03)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Clock size={10} color="rgba(255,255,255,0.15)" />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
          {item.timeLabel}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.08)" }}>·</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {item.title}
        </span>
      </div>
    </div>
  );
}