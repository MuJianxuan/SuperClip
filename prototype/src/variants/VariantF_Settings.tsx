import { useState } from "react";
import {
  Monitor, Moon, Sun, Sliders, Keyboard, Shield,
  Plus, Trash2, ArrowLeft, Copy, Database,
} from "lucide-react";

/* ================================================================
   Variant F2 — Settings (设置 · 作为 Main 分区重设计)

   CONTEXT 规格：Settings 属于 Main 内的现代分区/分栏表面，
   不再是独立设置窗/弹窗/全屏盖层（均已否决）。
   因此 F2 复用 E2 (Main) 的窗口框架（760×540@18px、40px blur、
   identity toolbar），左侧分区导航 + 右侧内容区。

   相对旧版 F 的改动：
   - 窗口框架与 E2 统一（同宽高/圆角/磨砂参数）
   - 顶部 toolbar：identity + "设置" + 返回列表按钮
   - 所有 hover 由 React state 驱动（移除直接 DOM 操作）
   - Toggle 从 lucide 图标改为真实 macOS 式开关（轨道+圆钮+弹性）
   - 设置项改为浅底卡片分组（与 E2 列表行的语言一致）
   - 分区切换 fadeSlideIn 动画；危险操作 hover 红化
   ================================================================ */

type Section = "general" | "shortcut" | "rules" | "advanced";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "通用", icon: <Sliders size={13} /> },
  { id: "shortcut", label: "快捷键", icon: <Keyboard size={13} /> },
  { id: "rules", label: "排除规则", icon: <Shield size={13} /> },
  { id: "advanced", label: "高级", icon: <Monitor size={13} /> },
];

/* E2 (Main) 同款窗口框架 */
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

export function VariantF_Settings() {
  const [activeSection, setActiveSection] = useState<Section>("general");
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">("system");
  const [historyLimit, setHistoryLimit] = useState(1000);
  const [launchAtLogin, setLaunchAtLogin] = useState(true);
  const [showOnStartup, setShowOnStartup] = useState(false);

  return (
    <div style={WINDOW_STYLE}>
      {/* ================= Top Toolbar (与 E2 同款) ================= */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Window identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
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
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
              设置
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {/* 返回列表（回到 Main 的剪贴板分区） */}
          <BackButton>
            <ArrowLeft size={13} />
            <span>返回列表</span>
          </BackButton>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", paddingTop: 10 }}>
        {/* ================= Sidebar 分区导航 ================= */}
        <div
          style={{
            width: 168,
            borderRight: "1px solid rgba(255,255,255,0.04)",
            padding: "4px 8px 8px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {SECTIONS.map((section) => (
              <SidebarItem
                key={section.id}
                icon={section.icon}
                label={section.label}
                isActive={activeSection === section.id}
                onClick={() => setActiveSection(section.id)}
              />
            ))}
          </div>
        </div>

        {/* ================= Content ================= */}
        <div
          key={activeSection}
          style={{
            flex: 1,
            padding: "14px 20px 20px",
            overflow: "auto",
            animation: "fadeSlideIn 0.18s ease-out",
          }}
        >
          {activeSection === "general" && <GeneralPane themeMode={themeMode} setThemeMode={setThemeMode} historyLimit={historyLimit} setHistoryLimit={setHistoryLimit} launchAtLogin={launchAtLogin} setLaunchAtLogin={setLaunchAtLogin} showOnStartup={showOnStartup} setShowOnStartup={setShowOnStartup} />}
          {activeSection === "shortcut" && <ShortcutPane />}
          {activeSection === "rules" && <RulesPane />}
          {activeSection === "advanced" && <AdvancedPane />}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Panes
   ================================================================ */

function GeneralPane({
  themeMode, setThemeMode,
  historyLimit, setHistoryLimit,
  launchAtLogin, setLaunchAtLogin,
  showOnStartup, setShowOnStartup,
}: {
  themeMode: "system" | "light" | "dark";
  setThemeMode: (v: "system" | "light" | "dark") => void;
  historyLimit: number;
  setHistoryLimit: (v: number) => void;
  launchAtLogin: boolean;
  setLaunchAtLogin: (v: boolean) => void;
  showOnStartup: boolean;
  setShowOnStartup: (v: boolean) => void;
}) {
  const themeIcons: Record<string, React.ReactNode> = {
    system: <Monitor size={13} />,
    light: <Sun size={13} />,
    dark: <Moon size={13} />,
  };
  const themeLabels: Record<string, string> = {
    system: "跟随系统",
    light: "浅色",
    dark: "深色",
  };

  return (
    <div>
      <PaneTitle>通用</PaneTitle>

      {/* 主题 */}
      <SettingsCard title="主题" desc="选择 SuperClip 的显示外观">
        <div style={{ display: "flex", gap: 6 }}>
          {(["system", "light", "dark"] as const).map((mode) => {
            const isActive = themeMode === mode;
            return (
              <SegButton
                key={mode}
                isActive={isActive}
                onClick={() => setThemeMode(mode)}
              >
                {themeIcons[mode]}
                {themeLabels[mode]}
              </SegButton>
            );
          })}
        </div>
      </SettingsCard>

      {/* 历史保留上限 */}
      <SettingsCard title="历史保留上限" desc="超出上限时自动清理最早记录" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <input
            type="range"
            min={100}
            max={5000}
            step={100}
            value={historyLimit}
            onChange={(e) => setHistoryLimit(Number(e.currentTarget.value))}
            className="slider-range"
            style={{
              flex: 1,
              "--slider-fill": `${((historyLimit - 100) / (5000 - 100)) * 100}%`,
            } as React.CSSProperties}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(56,189,248,0.85)",
              minWidth: 44,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {historyLimit}
          </span>
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.15)", minWidth: 32 }}>
            条
          </span>
        </div>
      </SettingsCard>

      {/* 启动行为 */}
      <SettingsCard title="启动行为" desc="" style={{ marginTop: 14 }}>
        <ToggleRow
          label="开机自启"
          desc="登录 macOS 时自动启动 SuperClip"
          checked={launchAtLogin}
          onChange={setLaunchAtLogin}
        />
        <RowDivider />
        <ToggleRow
          label="启动时显示主管理台"
          desc="启动后自动打开 Main 窗口"
          checked={showOnStartup}
          onChange={setShowOnStartup}
        />
      </SettingsCard>
    </div>
  );
}

function ShortcutPane() {
  return (
    <div>
      <PaneTitle>快捷键</PaneTitle>

      <SettingsCard title="全局快捷键" desc="这些快捷键在任意应用中均可使用">
        <ShortcutRow label="唤出 Popup" binding="⌘⇧V" />
        <RowDivider />
        <ShortcutRow label="打开主管理台" binding="⌘⇧M" />
        <RowDivider />
        <ShortcutRow label="粘贴最近条目" binding="⌘⇧⏎" />
      </SettingsCard>

      <SettingsCard title="应用内快捷键" desc="仅在 Main 窗口中可用" style={{ marginTop: 14 }}>
        <ShortcutRow label="切换列表/网格" binding="⌘L" />
        <RowDivider />
        <ShortcutRow label="全选" binding="⌘A" />
        <RowDivider />
        <ShortcutRow label="删除选中" binding="⌘⌫" />
      </SettingsCard>
    </div>
  );
}

function RulesPane() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <PaneTitle style={{ margin: 0 }}>排除规则</PaneTitle>
        <PrimaryBtn>
          <Plus size={12} />
          添加规则
        </PrimaryBtn>
      </div>

      <SettingsCard title="当前规则" desc="符合任一规则的内容将被排除在历史记录之外">
        <RuleRow bundleId="com.apple.keychainaccess" kind="text" keyword="密码" desc="钥匙串应用" />
        <RowDivider />
        <RuleRow bundleId="*" kind="image" keyword="screenshot_temp" desc="临时截图" />
        <RowDivider />
        <RuleRow bundleId="com.1password.1password" kind="*" keyword="*" desc="1Password 所有内容" />
      </SettingsCard>
    </div>
  );
}

function AdvancedPane() {
  return (
    <div>
      <PaneTitle>高级</PaneTitle>

      <SettingsCard title="存储信息" desc="数据库和配置文件位置">
        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.8,
            color: "rgba(255,255,255,0.35)",
            fontFamily: "monospace",
            background: "rgba(255,255,255,0.02)",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.03)",
          }}
        >
          <div>~/Library/Application Support/com.superclip/</div>
          <div style={{ color: "rgba(255,255,255,0.18)" }}>├── superclip.db (SQLite v3)</div>
          <div style={{ color: "rgba(255,255,255,0.18)" }}>├── config.json (Schema v1)</div>
          <div style={{ color: "rgba(255,255,255,0.18)" }}>└── logs/</div>
        </div>
      </SettingsCard>

      <SettingsCard title="诊断" desc="用于排查问题的工具" style={{ marginTop: 14 }}>
        <DangerBtn>
          <Database size={13} />
          导出诊断数据
        </DangerBtn>
      </SettingsCard>
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */

function SidebarItem({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 10px",
        borderRadius: 9,
        border: "none",
        background: isActive
          ? "rgba(56,189,248,0.07)"
          : hovered
            ? "rgba(255,255,255,0.03)"
            : "transparent",
        color: isActive
          ? "rgba(56,189,248,0.85)"
          : hovered
            ? "rgba(255,255,255,0.6)"
            : "rgba(255,255,255,0.3)",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        fontSize: 12,
        fontWeight: isActive ? 550 : 400,
        transition: "all 0.12s ease",
        position: "relative",
      }}
    >
      {/* 选中左侧色条（与 Main 列表选中同一语言） */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 3,
          height: isActive ? 16 : 0,
          borderRadius: 2,
          background: "#38bdf8",
          opacity: isActive ? 0.85 : 0,
          transition: "all 0.15s ease",
        }}
      />
      {icon}
      {label}
    </button>
  );
}

function PaneTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2
      style={{
        fontSize: 14,
        fontWeight: 600,
        color: "rgba(255,255,255,0.85)",
        margin: "0 0 14px",
        letterSpacing: "-0.01em",
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

function SettingsCard({
  title,
  desc,
  children,
  style,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.03)",
        borderRadius: 12,
        padding: "14px 16px",
        ...style,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 550, color: "rgba(255,255,255,0.75)", display: "block" }}>
          {title}
        </span>
        {desc && (
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.22)", display: "block", marginTop: 2 }}>
            {desc}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function RowDivider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.03)", margin: "2px 0" }} />;
}

/* --- macOS 式 Toggle 开关 --- */
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        border: "none",
        background: checked ? "rgba(56,189,248,0.85)" : "rgba(255,255,255,0.1)",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.18s ease",
        boxShadow: checked ? "0 0 10px rgba(56,189,248,0.25)" : "inset 0 1px 2px rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          transition: "left 0.18s cubic-bezier(0.25, 1.2, 0.4, 1)",
        }}
      />
    </button>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }}>
      <div>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.7)", display: "block" }}>
          {label}
        </span>
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.2)", display: "block", marginTop: 1 }}>
          {desc}
        </span>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* --- 分段选择（主题/模式）--- */
function SegButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 9,
        border: `1px solid ${
          isActive ? "rgba(56, 189, 248, 0.22)" : "rgba(255,255,255,0.04)"
        }`,
        background: isActive
          ? "rgba(56, 189, 248, 0.08)"
          : hovered
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.02)",
        color: isActive
          ? "rgba(56, 189, 248, 0.9)"
          : hovered
            ? "rgba(255,255,255,0.6)"
            : "rgba(255,255,255,0.35)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: isActive ? 550 : 400,
        transition: "all 0.12s ease",
      }}
    >
      {children}
    </button>
  );
}

/* --- 快捷键行 --- */
function ShortcutRow({ label, binding }: { label: string; binding: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 11.5,
            color: "rgba(255,255,255,0.4)",
            padding: "3px 10px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.05)",
            fontFamily: "monospace",
            letterSpacing: "0.02em",
          }}
        >
          {binding}
        </span>
        <button
          type="button"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: hovered ? "rgba(56,189,248,0.08)" : "transparent",
            border: "none",
            cursor: "pointer",
            color: hovered ? "rgba(56,189,248,0.8)" : "rgba(56,189,248,0.45)",
            padding: "4px 8px",
            fontSize: 11.5,
            fontWeight: 500,
            borderRadius: 6,
            transition: "all 0.12s ease",
          }}
        >
          更改
        </button>
      </div>
    </div>
  );
}

/* --- 规则行 --- */
function RuleRow({
  bundleId,
  kind,
  keyword,
  desc,
}: {
  bundleId: string;
  kind: string;
  keyword: string;
  desc: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: "rgba(255,255,255,0.6)",
              fontFamily: "monospace",
            }}
          >
            {bundleId}
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.12)" }}>/</span>
          <Tag text={kind === "*" ? "所有类型" : kind} />
          <Tag text={keyword === "*" ? "所有关键词" : keyword} />
        </div>
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.18)" }}>{desc}</span>
      </div>
      <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? "rgba(239, 68, 68, 0.07)" : "transparent",
          border: "none",
          cursor: "pointer",
          color: hovered ? "rgba(239, 68, 68, 0.6)" : "rgba(255,255,255,0.12)",
          padding: 6,
          borderRadius: 6,
          transition: "all 0.12s ease",
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <span
      style={{
        fontSize: 9.5,
        padding: "1px 6px",
        borderRadius: 4,
        background: "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.25)",
      }}
    >
      {text}
    </span>
  );
}

/* --- 按钮 --- */
function BackButton({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 9,
        border: `1px solid ${
          hovered ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.04)"
        }`,
        background: hovered ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.03)",
        color: hovered ? "rgba(56,189,248,0.8)" : "rgba(255,255,255,0.45)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 500,
        transition: "all 0.12s ease",
      }}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 12px",
        borderRadius: 8,
        border: `1px solid ${
          hovered ? "rgba(56, 189, 248, 0.35)" : "rgba(56, 189, 248, 0.15)"
        }`,
        background: hovered ? "rgba(56, 189, 248, 0.12)" : "rgba(56, 189, 248, 0.06)",
        color: hovered ? "rgba(56, 189, 248, 0.9)" : "rgba(56, 189, 248, 0.7)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 500,
        transition: "all 0.12s ease",
      }}
    >
      {children}
    </button>
  );
}

function DangerBtn({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        borderRadius: 8,
        border: `1px solid ${
          hovered ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.12)"
        }`,
        background: hovered ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.04)",
        color: hovered ? "rgba(239, 68, 68, 0.85)" : "rgba(239, 68, 68, 0.6)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 500,
        transition: "all 0.12s ease",
      }}
    >
      {children}
    </button>
  );
}