import { useEffect, useRef } from "react";
import { Search, Pin, FileImage, FileText, LinkIcon } from "lucide-react";
import type { ClipboardItem } from "../types";

/* ================================================================
   Variant A — "Frost" (磨砂玻璃)
   
   全磨砂玻璃背景，半透明层次，极简列表行，药丸状搜索条。
   氛围：macOS 原生磨砂质感，空灵、通透。
   ================================================================ */

interface Props {
  items: ClipboardItem[];
  selectedId: string;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
}

function KindIcon({ kind, color }: { kind: string; color: string }) {
  const size = 14;
  switch (kind) {
    case "image": return <FileImage size={size} style={{ color }} />;
    case "file":  return <FileText size={size} style={{ color }} />;
    case "html":  return <LinkIcon size={size} style={{ color }} />;
    default:      return <FileText size={size} style={{ color }} />;
  }
}

function timeAgo(label: string) {
  return label;
}

export function VariantA_Frost({ items, selectedId, query, onQueryChange, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="mock-popup"
      style={{
        background: "rgba(22, 26, 32, 0.72)",
        backdropFilter: "blur(40px) saturate(1.6)",
        WebkitBackdropFilter: "blur(40px) saturate(1.6)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.04)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* --- Search Pill --- */}
      <div style={{ padding: "14px 14px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 100,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(12px)",
            transition: "all 0.2s ease",
          }}
        >
          <Search size={14} color="rgba(255,255,255,0.35)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.currentTarget.value)}
            placeholder="搜索剪贴板..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "rgba(255,255,255,0.85)",
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: "0.01em",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "rgba(255,255,255,0.25)",
              padding: "2px 8px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            ⌘⇧V
          </span>
        </div>
      </div>

      {/* --- List --- */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
        {items.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
            {query ? "没有匹配项" : "暂无记录"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {items.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: isSelected
                      ? "rgba(10, 132, 255, 0.2)"
                      : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "all 0.12s ease",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 3,
                        height: 20,
                        borderRadius: "0 3px 3px 0",
                        background: "rgba(10, 132, 255, 0.8)",
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isSelected
                        ? "rgba(10, 132, 255, 0.15)"
                        : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isSelected ? "rgba(10, 132, 255, 0.2)" : "rgba(255,255,255,0.04)"}`,
                      flexShrink: 0,
                    }}
                  >
                    <KindIcon kind={item.kind} color={isSelected ? "rgba(10, 132, 255, 0.8)" : "rgba(255,255,255,0.35)"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isSelected ? 600 : 450,
                          color: isSelected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.7)",
                          lineHeight: 1.3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title}
                      </span>
                      {item.isPinned && (
                        <Pin size={10} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.25)",
                      flexShrink: 0,
                      fontWeight: 400,
                    }}
                  >
                    {timeAgo(item.timeLabel)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* --- Status row --- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#34d399",
              boxShadow: "0 0 6px rgba(52, 211, 153, 0.4)",
            }}
          />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>监听中</span>
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
          {items.length} 条记录
        </span>
      </div>
    </div>
  );
}