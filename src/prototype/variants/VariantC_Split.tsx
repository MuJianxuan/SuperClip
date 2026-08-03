import { useEffect, useRef } from "react";
import { Search, Pin, FileImage, FileText, LinkIcon, Copy } from "lucide-react";
import type { ClipboardItem } from "../../components/history-row";

/* ================================================================
   Variant C — "Split" (双栏分屏)
   
   左栏紧凑列表 + 右栏内容预览。
   搜索栏横跨顶部，选中即右侧预览。
   信息密度更高，内容一目了然。
   ================================================================ */

interface Props {
  items: ClipboardItem[];
  selectedId: string;
  selectedItem: ClipboardItem | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
}

function KindIcon({ kind, size = 14 }: { kind: string; size?: number }) {
  switch (kind) {
    case "image": return <FileImage size={size} />;
    case "file":  return <FileText size={size} />;
    case "html":  return <LinkIcon size={size} />;
    default:      return <FileText size={size} />;
  }
}

const kindColors: Record<string, string> = {
  text: "#0ea5e9",
  html: "#8b5cf6",
  rtf: "#06b6d4",
  image: "#f43f5e",
  file: "#3b82f6",
};

export function VariantC_Split({ items, selectedId, selectedItem, query, onQueryChange, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="mock-popup"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.02)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* --- Search bar --- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <Search size={14} color="#94a3b8" />
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
            color: "#0f172a",
            fontSize: 13,
            fontWeight: 400,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "#94a3b8",
            padding: "2px 6px",
            borderRadius: 4,
            background: "#f1f5f9",
          }}
        >
          ⌘K
        </span>
      </div>

      {/* --- Split body --- */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left column — compact list */}
        <div
          style={{
            width: "55%",
            borderRight: "1px solid rgba(0,0,0,0.04)",
            overflowY: "auto",
            background: "#fafafa",
          }}
        >
          {items.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
              {query ? "无匹配" : "暂无记录"}
            </div>
          ) : (
            <div style={{ padding: "4px 0" }}>
              {items.map((item) => {
                const isSelected = item.id === selectedId;
                const accent = kindColors[item.kind] ?? "#64748b";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      border: "none",
                      borderLeft: `3px solid ${isSelected ? accent : "transparent"}`,
                      background: isSelected ? "#ffffff" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      transition: "all 0.1s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "#f1f5f9";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isSelected ? `${accent}12` : "#f1f5f9",
                        color: isSelected ? accent : "#94a3b8",
                        flexShrink: 0,
                      }}
                    >
                      <KindIcon kind={item.kind} size={11} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? "#0f172a" : "#334155",
                          lineHeight: 1.2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "#94a3b8",
                          marginTop: 1,
                          display: "block",
                        }}
                      >
                        {item.timeLabel}
                      </span>
                    </div>
                    {item.isPinned && (
                      <Pin size={9} color="#94a3b8" style={{ flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column — preview */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {selectedItem ? (
            <>
              {/* Preview header */}
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: kindColors[selectedItem.kind] ?? "#64748b",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {selectedItem.kind}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8",
                    }}
                    title="复制"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              {/* Preview content */}
              <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
                {selectedItem.kind === "image" ? (
                  <div
                    style={{
                      width: "100%",
                      height: 140,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <FileImage size={24} style={{ margin: "0 auto 4px", opacity: 0.4 }} />
                      {selectedItem.meta}
                    </div>
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "#334155",
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {selectedItem.preview}
                  </p>
                )}
              </div>

              {/* Preview footer */}
              <div
                style={{
                  padding: "6px 12px",
                  borderTop: "1px solid rgba(0,0,0,0.04)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 10, color: "#94a3b8" }}>
                  来自 {selectedItem.sourceApp}
                </span>
                <span style={{ fontSize: 10, color: "#cbd5e1" }}>·</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>
                  {selectedItem.timeLabel}
                </span>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#cbd5e1",
                fontSize: 12,
              }}
            >
              选择一条记录查看内容
            </div>
          )}
        </div>
      </div>
    </div>
  );
}