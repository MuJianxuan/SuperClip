import { useMemo, useState } from "react";
import {
  Search, Grid3X3, List, Type, Image, File, Star, Pin,
  Copy, Trash2, CheckSquare, Square, Settings2, X, Inbox,
} from "lucide-react";

/* ================================================================
   Variant E2 — Main (主管理台 · 重设计)

   设计目标：偶尔使用的轻管理台 —— 打开看清全局，快速过滤，按需批量。
   结构：单行工具条 + 过滤条 + 日期分组列表/网格 + 滑入批量栏。

   相对旧版 E 的改动：
   - 三行控件合一（工具条 + 过滤条两层）
   - 日期分组（今天 / 昨天 / 更早）
   - 悬停浮现行操作（复制/置顶/删除）
   - pill 过滤 chips 带计数
   - 置顶琥珀色星标，与强调蓝区分
   - 批量栏滑入动画 + 全选入口
   - 空状态 / 搜索清空 / 状态横幅插槽
   ================================================================ */

type TabId = "all" | "text" | "image" | "file" | "pinned";

interface MainItem {
  id: string;
  kind: "text" | "image" | "file" | "html";
  title: string;
  preview: string;
  app: string;
  group: "today" | "yesterday" | "earlier";
  pinned: boolean;
}

const MOCK_MAIN_ITEMS: MainItem[] = [
  { id: "m1", kind: "text", title: "macOS 剪贴板管理工具设计稿", preview: "设计稿 v3 — 包含 Popup、Main、Settings 等表面", app: "Figma", group: "today", pinned: true },
  { id: "m2", kind: "text", title: "欢迎使用 SuperClip — 快速上手指南", preview: "按下 Cmd+Shift+V 唤出剪贴板历史", app: "Notes", group: "today", pinned: false },
  { id: "m3", kind: "image", title: "截屏 2026-08-02 14.30.22.png", preview: "1600×1200 屏幕截图", app: "系统截屏", group: "today", pinned: false },
  { id: "m4", kind: "text", title: "useEffect 清理函数的最佳实践", preview: "在 React 18+ 中，清理函数在 StrictMode 下会被调用两次", app: "Arc", group: "today", pinned: false },
  { id: "m5", kind: "html", title: "Tailwind CSS v4 新特性一览", preview: "CSS-first 配置方式，无需 tailwind.config.js", app: "Safari", group: "yesterday", pinned: false },
  { id: "m6", kind: "file", title: "project-brief-v2.pdf", preview: "第四版产品需求文档", app: "Finder", group: "yesterday", pinned: false },
  { id: "m7", kind: "text", title: "Rust 所有权与生命周期速查表", preview: "每个值在任意时刻有且只有一个所有者", app: "VS Code", group: "yesterday", pinned: false },
  { id: "m8", kind: "image", title: "截屏 2026-08-01 09.12.05.png", preview: "800×600 屏幕截图", app: "系统截屏", group: "yesterday", pinned: false },
  { id: "m9", kind: "text", title: "Tauri 2.0 跨平台构建指南", preview: "支持 macOS、Windows 和 Linux", app: "Arc", group: "earlier", pinned: false },
  { id: "m10", kind: "text", title: "周报 — 2026 年第 31 周", preview: "本周完成：Popup 交互优化", app: "Warp", group: "earlier", pinned: false },
  { id: "m11", kind: "image", title: "截屏 2026-07-30 18.45.10.png", preview: "1920×1080 屏幕截图", app: "系统截屏", group: "earlier", pinned: false },
  { id: "m12", kind: "text", title: "Design Tokens 命名规范", preview: "颜色、间距、圆角、字体阶层的 token 命名约定", app: "Figma", group: "earlier", pinned: false },
];

const GROUP_LABELS: Record<string, string> = {
  today: "今天",
  yesterday: "昨天",
  earlier: "更早",
};

const KIND_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  text: { label: "文本", color: "#38bdf8", icon: <Type size={12} /> },
  image: { label: "图片", color: "#fb7185", icon: <Image size={12} /> },
  file: { label: "文件", color: "#60a5fa", icon: <File size={12} /> },
  html: { label: "HTML", color: "#a78bfa", icon: <Type size={12} /> },
};

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "text", label: "文本" },
  { id: "image", label: "图片" },
  { id: "file", label: "文件" },
  { id: "pinned", label: "已置顶" },
];

/* 窗口圆角背景 */
const WINDOW_STYLE: React.CSSProperties = {
  width: 760,
  height: 540,
  borderRadius: 18,
  background: "rgba(16, 21, 28, 0.82)",
  backdropFilter: "blur(40px) saturate(1.6)",
  WebkitBackdropFilter: "blur(40px) saturate(1.6)",
  border: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "0 32px 100px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.04)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

export function VariantE_Main() {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  /* --- 过滤 + 计数 --- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_MAIN_ITEMS.filter((item) => {
      if (activeTab === "pinned" && !item.pinned) return false;
      if (activeTab !== "all" && activeTab !== "pinned" && item.kind !== activeTab) return false;
      if (q) {
        const hay = `${item.title} ${item.preview} ${item.app}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeTab, query]);

  const countFor = (tab: TabId) => {
    if (tab === "pinned") return MOCK_MAIN_ITEMS.filter((i) => i.pinned).length;
    if (tab === "all") return MOCK_MAIN_ITEMS.length;
    return MOCK_MAIN_ITEMS.filter((i) => i.kind === tab).length;
  };

  const grouped = useMemo(() => {
    const order = ["today", "yesterday", "earlier"] as const;
    return order
      .map((g) => ({ group: g, items: filtered.filter((i) => i.group === g) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  /* --- 选择 --- */
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const allVisibleSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const toggleSelectAll = () =>
    setSelectedIds(allVisibleSelected ? new Set() : new Set(filtered.map((i) => i.id)));

  return (
    <div style={WINDOW_STYLE}>
      {/* ================= Top Toolbar ================= */}
      <div style={{ padding: "14px 16px 0" }}>
        {/* Row 1: identity + search + window actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Window identity (tray icon glyph) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                background: "linear-gradient(135deg, rgba(56,189,248,0.35), rgba(167,139,250,0.25))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 12px rgba(56,189,248,0.2)",
              }}
            >
              <Copy size={12} color="rgba(255,255,255,0.85)" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>剪贴板</span>
          </div>

          {/* Search (dominant) */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 12px",
              borderRadius: 11,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.04)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              transition: "border-color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(56,189,248,0.25)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)")}
          >
            <Search size={13} color="rgba(255,255,255,0.25)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="搜索剪贴板..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "rgba(255,255,255,0.8)",
                fontSize: 13,
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
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
                }}
              >
                <X size={9} />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: 9, background: "rgba(255,255,255,0.03)", flexShrink: 0 }}>
            <ViewButton active={viewMode === "list"} onClick={() => setViewMode("list")}>
              <List size={13} />
            </ViewButton>
            <ViewButton active={viewMode === "grid"} onClick={() => setViewMode("grid")}>
              <Grid3X3 size={13} />
            </ViewButton>
          </div>

          {/* Settings */}
          <ToolIconBtn title="设置">
            <Settings2 size={13} />
          </ToolIconBtn>
        </div>

        {/* Row 2: filter chips with counts */}
        <div style={{ display: "flex", gap: 5, padding: "10px 0 12px", overflowX: "auto" }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const isPinned = tab.id === "pinned";
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: 100,
                  border: `1px solid ${
                    isActive
                      ? isPinned
                        ? "rgba(251,191,36,0.25)"
                        : "rgba(56,189,248,0.22)"
                      : "rgba(255,255,255,0.04)"
                  }`,
                  background: isActive
                    ? isPinned
                      ? "rgba(251,191,36,0.08)"
                      : "rgba(56,189,248,0.07)"
                    : "rgba(255,255,255,0.02)",
                  color: isActive ? (isPinned ? "rgba(251,191,36,0.9)" : "rgba(56,189,248,0.9)") : "rgba(255,255,255,0.35)",
                  cursor: "pointer",
                  fontSize: 11.5,
                  fontWeight: isActive ? 500 : 400,
                  transition: "all 0.12s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {isPinned && <Star size={10} fill={isActive ? "rgba(251,191,36,0.9)" : "none"} />}
                {tab.label}
                <span
                  style={{
                    fontSize: 9.5,
                    padding: "0 5px",
                    borderRadius: 100,
                    background: isActive ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                    color: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {countFor(tab.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= Status Banner Slot ================= */}
      {false && (
        <div
          style={{
            margin: "0 16px 10px",
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.15)",
            fontSize: 11.5,
            color: "rgba(251,191,36,0.75)",
          }}
        >
          仅复制模式 — 辅助功能权限未授权
        </div>
      )}

      {/* ================= Content ================= */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 10px 8px" }}>
        {filtered.length === 0 ? (
          <EmptyState hasQuery={!!query.trim()} />
        ) : viewMode === "list" ? (
          grouped.map(({ group, items }) => (
            <div key={group} style={{ marginBottom: 4 }}>
              {/* Group header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 8px 6px",
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.18)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {GROUP_LABELS[group]}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.08)" }}>{items.length}</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.03)" }} />
              </div>

              {/* Rows */}
              {items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onToggle={() => toggleSelect(item.id)}
                />
              ))}
            </div>
          ))
        ) : (
          /* ================= Grid ================= */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, padding: "6px 2px" }}>
            {filtered.map((item) => (
              <GridCard
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                onToggle={() => toggleSelect(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ================= Bulk Action Bar (slide-in) ================= */}
      <div
        style={{
          transform: selectedIds.size > 0 ? "translateY(0)" : "translateY(100%)",
          opacity: selectedIds.size > 0 ? 1 : 0,
          pointerEvents: selectedIds.size > 0 ? "auto" : "none",
          transition: "transform 0.18s ease, opacity 0.18s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "8px 16px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(16, 21, 28, 0.92)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            已选 <span style={{ fontWeight: 600, color: "rgba(56,189,248,0.75)" }}>{selectedIds.size}</span> 项
          </span>
          <button
            type="button"
            onClick={toggleSelectAll}
            style={{
              fontSize: 11,
              color: allVisibleSelected ? "rgba(255,255,255,0.25)" : "rgba(56,189,248,0.7)",
              background: "transparent",
              border: "none",
              cursor: allVisibleSelected ? "default" : "pointer",
              padding: "2px 4px",
              borderRadius: 5,
            }}
          >
            {allVisibleSelected ? "已全选" : "全选可见"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <ActionBtn icon={<Copy size={12} />} label="复制" />
          <ActionBtn icon={<Pin size={12} />} label="置顶" />
          <ActionBtn icon={<Trash2 size={12} />} label="删除" danger />
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            style={{
              fontSize: 11.5,
              color: "rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 8,
              padding: "4px 10px",
              cursor: "pointer",
              marginLeft: 2,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= 列表行 ================= */

function Row({
  item,
  selected,
  onToggle,
}: {
  item: MainItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const meta = KIND_META[item.kind];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 10px",
        borderRadius: 10,
        background: selected ? "rgba(56,189,248,0.05)" : hovered ? "rgba(255,255,255,0.025)" : "transparent",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.12s ease",
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
          height: selected ? 20 : 0,
          borderRadius: 2,
          background: meta.color,
          opacity: selected ? 0.85 : 0,
          transition: "all 0.15s ease",
        }}
      />

      {/* checkbox */}
      <div style={{ width: 18, flexShrink: 0, display: "flex", justifyContent: "center" }}>
        {selected ? (
          <CheckSquare size={13} color="rgba(56,189,248,0.7)" />
        ) : (
          <Square
            size={13}
            color={hovered ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}
          />
        )}
      </div>

      {/* kind icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: selected ? `${meta.color}14` : "rgba(255,255,255,0.04)",
          color: selected ? meta.color : "rgba(255,255,255,0.3)",
          flexShrink: 0,
          transition: "all 0.12s ease",
        }}
      >
        {meta.icon}
      </div>

      {/* content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: selected ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.68)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.title}
          </span>
          {item.pinned && (
            <Star size={9} fill="rgba(251,191,36,0.8)" color="rgba(251,191,36,0.8)" style={{ flexShrink: 0 }} />
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.22)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {item.preview}
        </span>
      </div>

      {/* hover actions / meta */}
      {hovered && !selected ? (
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <RowAction title="复制" onClick={() => {}}>
            <Copy size={12} />
          </RowAction>
          <RowAction title={item.pinned ? "取消置顶" : "置顶"} onClick={() => {}}>
            <Pin size={12} />
          </RowAction>
          <RowAction title="删除" danger onClick={() => {}}>
            <Trash2 size={12} />
          </RowAction>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>{item.app}</span>
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.1)" }}>{item.pinned ? "置顶" : item.group === "today" ? "刚刚" : item.group === "yesterday" ? "昨天" : "7 天前"}</span>
        </div>
      )}
    </div>
  );
}

function RowAction({
  title,
  danger,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        border: "none",
        background: "rgba(255,255,255,0.04)",
        color: danger ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.4)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.1s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.08)";
        e.currentTarget.style.color = danger ? "rgba(239,68,68,0.8)" : "rgba(255,255,255,0.7)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        e.currentTarget.style.color = danger ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.4)";
      }}
    >
      {children}
    </button>
  );
}

/* ================= 网格卡片 ================= */

function GridCard({
  item,
  selected,
  onToggle,
}: {
  item: MainItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const meta = KIND_META[item.kind];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
      style={{
        padding: "11px",
        borderRadius: 12,
        background: selected ? "rgba(56,189,248,0.05)" : hovered ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.018)",
        border: `1px solid ${selected ? "rgba(56,189,248,0.15)" : hovered ? `${meta.color}22` : "rgba(255,255,255,0.04)"}`,
        cursor: "pointer",
        transition: "all 0.12s ease",
        position: "relative",
        overflow: "hidden",
        minHeight: 118,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* top color bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${meta.color}, ${meta.color}00)`,
          opacity: hovered || selected ? 0.55 : 0.18,
          transition: "opacity 0.12s ease",
        }}
      />

      {/* header: icon + pin + check */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: selected ? `${meta.color}14` : "rgba(255,255,255,0.04)",
            color: selected ? meta.color : "rgba(255,255,255,0.3)",
          }}
        >
          {meta.icon}
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {item.pinned && <Star size={10} fill="rgba(251,191,36,0.8)" color="rgba(251,191,36,0.8)" />}
          {selected ? (
            <CheckSquare size={12} color="rgba(56,189,248,0.7)" />
          ) : (
            <Square size={12} color="rgba(255,255,255,0.08)" />
          )}
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.68)",
            lineHeight: 1.35,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.title}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: "rgba(255,255,255,0.2)",
            display: "block",
            marginTop: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.preview}
        </span>
      </div>

      {/* footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
          paddingTop: 6,
          borderTop: "1px solid rgba(255,255,255,0.03)",
        }}
      >
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.16)" }}>{item.app}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.1)" }}>
          {item.group === "today" ? "今天" : item.group === "yesterday" ? "昨天" : "更早"}
        </span>
      </div>
    </div>
  );
}

/* ================= 空状态 ================= */

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, padding: "40px 0" }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: "rgba(255,255,255,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.12)",
        }}
      >
        <Inbox size={20} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.3)" }}>
        {hasQuery ? "没有匹配的内容" : "暂无剪贴板记录"}
      </span>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.12)" }}>
        {hasQuery ? "试试其他关键词" : "复制任意内容后会自动出现在这里"}
      </span>
    </div>
  );
}

/* ================= 通用小组件 ================= */

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 6px",
        borderRadius: 7,
        border: "none",
        background: active ? "rgba(255,255,255,0.08)" : "transparent",
        color: active ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.2)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        transition: "all 0.1s ease",
      }}
    >
      {children}
    </button>
  );
}

function ToolIconBtn({ title, children }: { title: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "7px",
        borderRadius: 9,
        border: "1px solid rgba(255,255,255,0.04)",
        background: hovered ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.03)",
        color: hovered ? "rgba(56,189,248,0.6)" : "rgba(255,255,255,0.3)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        transition: "all 0.12s ease",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function ActionBtn({ icon, label, danger }: { icon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 12px",
        borderRadius: 8,
        border: `1px solid ${danger ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.04)"}`,
        background: danger ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)",
        color: danger ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.5)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 500,
        transition: "all 0.1s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)";
        e.currentTarget.style.color = danger ? "rgba(239,68,68,0.9)" : "rgba(255,255,255,0.75)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = danger ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)";
        e.currentTarget.style.color = danger ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.5)";
      }}
    >
      {icon}
      {label}
    </button>
  );
}