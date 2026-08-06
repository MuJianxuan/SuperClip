import * as React from "react";
import {
  ArrowLeft,
  Copy,
  Database,
  Keyboard,
  Monitor,
  Moon,
  PencilLine,
  Plus,
  Shield,
  Sliders,
  Sun,
  Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Switch } from "./ui/switch";
import { cn } from "../lib/utils";
import type {
  ExclusionRule,
  ExclusionRuleKind,
  SettingsResponse,
  SettingsUpdatePayload,
  RulesUpsertPayload,
  ShortcutStateResponse,
  ShortcutValidationResponse,
} from "../lib/superclip";

type SettingsSectionKey = "general" | "shortcuts" | "privacy" | "about";

export interface SettingsShellProps {
  settings: SettingsResponse;
  shortcut: ShortcutStateResponse;
  rules: ExclusionRule[];
  pinnedCount: number;
  permissionTrusted: boolean;
  readOnlyMode: boolean;
  onClose: () => void;
  onUpdate: (patch: SettingsUpdatePayload) => Promise<void>;
  onDiagnosticsClick: () => void | Promise<void>;
  onPermissionGuideClick: () => void | Promise<void>;
  onRuleUpsert: (payload: RulesUpsertPayload) => Promise<void>;
  onRuleDelete: (ruleId: string) => Promise<void>;
  onRulesClear: () => Promise<void>;
  onShortcutStart: () => Promise<void>;
  onShortcutCancel: () => Promise<void>;
  onShortcutValidate: (binding: string) => Promise<ShortcutValidationResponse>;
  onShortcutUpdate: (binding: string) => Promise<void>;
  onShortcutRestoreDefault: () => Promise<void>;
}

const sections: Array<{
  key: SettingsSectionKey;
  label: string;
  icon: typeof Sliders;
}> = [
  { key: "general", label: "通用", icon: Sliders },
  { key: "shortcuts", label: "快捷键", icon: Keyboard },
  { key: "privacy", label: "排除规则", icon: Shield },
  { key: "about", label: "高级", icon: Monitor },
];

const ruleKindLabels: Record<ExclusionRuleKind, string> = {
  bundle_id: "App Bundle ID",
  content_kind: "内容类型",
  keyword: "关键词",
};

const contentKindOptions = [
  { value: "text", label: "Text" },
  { value: "html", label: "HTML" },
  { value: "rtf", label: "RTF" },
  { value: "image", label: "Image" },
  { value: "file", label: "File" },
];

/* 主题分段按钮 —— F2 原型语言（与 Quick Panel 分段一致），hover 由 React state 驱动。
   选中 = 蓝底 rgba(56,189,248,0.08) + 蓝边 0.22 + 蓝字；未选中 = 浅底。
   注意：不套按钮容器底框（与 F2 一致）。 */
function ThemeSegButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 py-[7px] text-[12px] transition-all duration-150",
        disabled && "cursor-not-allowed opacity-60",
      )}
      style={{
        border: `1px solid ${
          active
            ? "rgba(56, 189, 248, 0.22)"
            : hovered
              ? "var(--border-strong)"
              : "var(--seg-border)"
        }`,
        background: active
          ? "rgba(56, 189, 248, 0.08)"
          : hovered
            ? "var(--row-hover)"
            : "var(--card-bg)",
        color: active
          ? "rgba(56, 189, 248, 0.9)"
          : hovered
            ? "var(--text-primary)"
            : "var(--text-secondary)",
        fontWeight: active ? 550 : 400,
      }}
    >
      {children}
    </button>
  );
}

/* 粘贴行为分段按钮（默认动作）—— 与主题分段同一语言 */
function SegControlButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "flex flex-1 items-center justify-center rounded-[9px] px-3 py-[7px] text-[12px] transition-all duration-150",
        disabled && "cursor-not-allowed opacity-60",
      )}
      style={{
        border: `1px solid ${
          active
            ? "rgba(56, 189, 248, 0.22)"
            : hovered
              ? "var(--border-strong)"
              : "var(--seg-border)"
        }`,
        background: active
          ? "rgba(56, 189, 248, 0.08)"
          : hovered
            ? "var(--row-hover)"
            : "var(--card-bg)",
        color: active
          ? "rgba(56, 189, 248, 0.9)"
          : hovered
            ? "var(--text-primary)"
            : "var(--text-secondary)",
        fontWeight: active ? 550 : 400,
      }}
    >
      {children}
    </button>
  );
}

/* 滑块轨道底（F2 深色 = rgba(255,255,255,0.08)）+ hover/拖拽 thumb glow。
   注意随 data-theme-mode 联动：用户切深色后即使系统浅色也用深色轨道。 */
function readSliderTrackColors() {
  if (typeof document === "undefined") {
    return { bg: "rgba(255,255,255,0.08)", hover: "rgba(255,255,255,0.22)", active: "rgba(56,189,248,0.6)" };
  }
  const mode = document.documentElement.dataset.themeMode;
  const dark =
    mode === "dark" ||
    (mode !== "light" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return dark
    ? { bg: "rgba(255,255,255,0.08)", hover: "rgba(255,255,255,0.22)", active: "rgba(56,189,248,0.6)" }
    : { bg: "rgba(15,23,42,0.14)", hover: "rgba(15,23,42,0.26)", active: "rgba(56,189,248,0.55)" };
}

/* F2 分区大标题：通用 / 快捷键 / 排除规则 / 高级 */
function PaneTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2
      className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]"
      style={{ margin: "0 0 14px", ...style }}
    >
      {children}
    </h2>
  );
}

/* F2 设置卡：浅底圆角卡片（r12 / padding 14px 16px），标题 12.5px/550 + 说明 10.5px 内嵌卡头 */
function SectionCard({
  title,
  description,
  children,
  style,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className="rounded-[12px] px-4 py-[14px]"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--divider)",
        ...style,
      }}
    >
      <div className="mb-2.5">
        <h3 className="block text-[12.5px] font-[550] leading-snug text-[var(--text-primary)]">{title}</h3>
        {description ? (
          <p className="mt-0.5 block text-[10.5px] leading-snug text-[var(--text-tertiary)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* F2 卡内设置行：无壳，label 12.5px/500 + hint 10.5px，右侧控件，行间 RowDivider 分隔 */
function Row({
  label,
  hint,
  action,
}: {
  label: string;
  hint: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-[7px]">
      <div className="min-w-0">
        <p className="block text-[12.5px] font-medium text-[var(--text-primary)]">{label}</p>
        {hint ? (
          <p className="mt-px block text-[10.5px] leading-snug text-[var(--text-tertiary)]">{hint}</p>
        ) : null}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

/* F2 行分隔线：1px、--divider（深色 rgba(255,255,255,0.03)）、上下 2px 呼吸 */
function RowDivider() {
  return <div className="my-0.5 h-px" style={{ background: "var(--divider)" }} />;
}

/* F2 快捷键行「更改」按钮：无框、蓝字，hover 浅蓝底（React state 驱动） */
function ChangeButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "rounded-[6px] px-2 py-1 text-[11.5px] font-medium transition-all duration-150",
        disabled && "cursor-not-allowed opacity-60",
      )}
      style={{
        background: hovered ? "rgba(56,189,248,0.08)" : "transparent",
        border: "none",
        color: hovered ? "rgba(56,189,248,0.8)" : "rgba(56,189,248,0.45)",
      }}
    >
      {children}
    </button>
  );
}

/* F2 快捷键徽标：等宽字体浅底块 */
function ShortcutBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-[6px] px-2.5 py-[3px] font-mono text-[11.5px] tracking-[0.02em]"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}

/* F2 顶部「返回列表」按钮：浅底 + 细边，hover 泛蓝（React state 驱动） */
function BackButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-all duration-150"
      style={{
        border: `1px solid ${hovered ? "rgba(56,189,248,0.2)" : "var(--border)"}`,
        background: hovered ? "rgba(56,189,248,0.06)" : "var(--card-bg)",
        color: hovered ? "rgba(56,189,248,0.8)" : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

/* F2「添加规则」主按钮：蓝系描边，hover 加深（React state 驱动） */
function PrimaryBtn({
  onClick,
  disabled,
  type = "button",
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
        disabled && "cursor-not-allowed opacity-60",
      )}
      style={{
        border: `1px solid ${hovered ? "rgba(56, 189, 248, 0.35)" : "rgba(56, 189, 248, 0.15)"}`,
        background: hovered ? "rgba(56, 189, 248, 0.12)" : "rgba(56, 189, 248, 0.06)",
        color: hovered ? "rgba(56, 189, 248, 0.9)" : "rgba(56, 189, 248, 0.7)",
      }}
    >
      {children}
    </button>
  );
}

/* F2 危险按钮：红底红边（#ef4444 系），hover 加深（React state 驱动） */
function DangerBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      data-variant="danger"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "flex items-center gap-1.5 rounded-[8px] px-3.5 py-[7px] text-[12px] font-medium transition-all duration-150",
        disabled && "cursor-not-allowed opacity-60",
      )}
      style={{
        border: `1px solid ${hovered ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.12)"}`,
        background: hovered ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.04)",
        color: hovered ? "rgba(239, 68, 68, 0.85)" : "rgba(239, 68, 68, 0.6)",
      }}
    >
      {children}
    </button>
  );
}

/* F2 侧栏分区项：选中 = 浅蓝底 rgba(56,189,248,0.07) + 左侧 3px 蓝条 + 蓝字；hover = 白 0.03 底。
   hover 一律 React state 驱动，禁止 currentTarget.style。 */
function SidebarNavItem({
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
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex w-full items-center gap-[9px] rounded-[9px] px-2.5 py-2 text-left text-[12px] transition-all duration-150"
      style={{
        border: "none",
        background: isActive
          ? "rgba(56, 189, 248, 0.07)"
          : hovered
            ? "var(--row-hover)"
            : "transparent",
        color: isActive
          ? "rgba(56, 189, 248, 0.85)"
          : hovered
            ? "var(--text-primary)"
            : "var(--text-tertiary)",
        fontWeight: isActive ? 550 : 400,
      }}
    >
      {/* 选中左侧色条（与 Main 列表选中同一语言） */}
      <div
        className="absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-[2px] transition-all duration-150"
        data-active-bar="true"
        style={{
          height: isActive ? 16 : 0,
          background: "#38bdf8",
          opacity: isActive ? 0.85 : 0,
        }}
      />
      {icon}
      {label}
    </button>
  );
}

/* F2 规则行：等宽值 + 类型/关键词 tag + 右侧开关/编辑/删除（删除 hover 红化，React state 驱动） */
function RuleRow({
  rule,
  readOnlyMode,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: ExclusionRule;
  readOnlyMode: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [deleteHovered, setDeleteHovered] = React.useState(false);
  const [editHovered, setEditHovered] = React.useState(false);
  const kindText = rule.kind === "bundle_id" ? "bundle" : rule.kind === "content_kind" ? "类型" : "关键词";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11.5px] font-medium text-[var(--text-primary)]">{rule.value}</span>
          <span className="text-[9px] text-[var(--text-tertiary)]">/</span>
          <span className="rounded-[4px] px-1.5 py-px text-[9.5px]" style={{ background: "var(--surface-2)", color: "var(--text-tertiary)" }}>
            {kindText}
          </span>
        </div>
        <span className="text-[10.5px] text-[var(--text-tertiary)]">
          {rule.kind === "bundle_id"
            ? "命中该来源应用后跳过入库"
            : rule.kind === "content_kind"
              ? "命中该类型后跳过"
              : "命中关键词后跳过"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Switch
          checked={rule.enabled}
          disabled={readOnlyMode}
          aria-label={`${rule.value} 规则开关`}
          onCheckedChange={onToggle}
        />
        <button
          type="button"
          aria-label={`编辑规则 ${rule.value}`}
          onClick={onEdit}
          disabled={readOnlyMode}
          onMouseEnter={() => setEditHovered(true)}
          onMouseLeave={() => setEditHovered(false)}
          className="rounded-[6px] p-1.5 transition-all duration-150"
          style={{
            background: editHovered ? "rgba(56,189,248,0.08)" : "transparent",
            border: "none",
            color: editHovered ? "rgba(56,189,248,0.8)" : "var(--text-tertiary)",
          }}
        >
          <PencilLine className="h-[13px] w-[13px]" />
        </button>
        <button
          type="button"
          aria-label={`删除规则 ${rule.value}`}
          onClick={onDelete}
          disabled={readOnlyMode}
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
          className="rounded-[6px] p-1.5 transition-all duration-150"
          style={{
            background: deleteHovered ? "rgba(239, 68, 68, 0.07)" : "transparent",
            border: "none",
            color: deleteHovered ? "rgba(239, 68, 68, 0.6)" : "var(--text-tertiary)",
          }}
        >
          <Trash2 className="h-[13px] w-[13px]" />
        </button>
      </div>
    </div>
  );
}

function formatShortcutKey(key: string) {
  if (key === " ") {
    return "Space";
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  const specialKeyMap: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Escape: "Esc",
    Enter: "Enter",
    Backspace: "Backspace",
    Delete: "Delete",
    Tab: "Tab",
  };

  return specialKeyMap[key] ?? key;
}

function buildShortcutFromEvent(event: KeyboardEvent) {
  const modifierOnlyKeys = ["Meta", "Control", "Alt", "Shift"];

  if (modifierOnlyKeys.includes(event.key)) {
    return null;
  }

  const parts = [
    event.metaKey ? "Cmd" : null,
    event.ctrlKey ? "Ctrl" : null,
    event.altKey ? "Option" : null,
    event.shiftKey ? "Shift" : null,
    formatShortcutKey(event.key),
  ].filter(Boolean);

  return parts.join("+");
}

export function SettingsShell({
  settings,
  shortcut,
  rules,
  pinnedCount,
  permissionTrusted,
  readOnlyMode,
  onClose,
  onUpdate,
  onDiagnosticsClick,
  onPermissionGuideClick,
  onRuleUpsert,
  onRuleDelete,
  onRulesClear,
  onShortcutStart,
  onShortcutCancel,
  onShortcutValidate,
  onShortcutUpdate,
  onShortcutRestoreDefault,
}: SettingsShellProps) {
  const [activeSection, setActiveSection] = React.useState<SettingsSectionKey>("general");
  const [isShortcutRecording, setIsShortcutRecording] = React.useState(false);
  const [shortcutPreview, setShortcutPreview] = React.useState<string | null>(null);
  const [shortcutError, setShortcutError] = React.useState<string | null>(null);
  const [startupError, setStartupError] = React.useState<string | null>(null);
  const [startupRetryPatch, setStartupRetryPatch] = React.useState<SettingsUpdatePayload | null>(null);
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null);
  const [ruleKind, setRuleKind] = React.useState<ExclusionRuleKind>("bundle_id");
  const [ruleValue, setRuleValue] = React.useState("");
  const [ruleEnabled, setRuleEnabled] = React.useState(true);
  const [ruleError, setRuleError] = React.useState<string | null>(null);
  const [isRuleEditorOpen, setIsRuleEditorOpen] = React.useState(false);
  // 滑块轨道色随 data-theme-mode 联动（settings.themeMode 变化即重渲染）
  const sliderTrack = readSliderTrackColors();

  function resetRuleEditor() {
    setEditingRuleId(null);
    setRuleKind("bundle_id");
    setRuleValue("");
    setRuleEnabled(true);
    setRuleError(null);
  }

  async function handleStartupUpdate(patch: SettingsUpdatePayload) {
    try {
      await onUpdate(patch);
      setStartupError(null);
      setStartupRetryPatch(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStartupRetryPatch(patch);
      setStartupError(
        message.includes("LOGIN_ITEM_UPDATE_FAILED")
          ? "登录启动设置未能写入系统，请稍后重试。"
          : "启动设置更新失败，请重试。",
      );
    }
  }

  async function handleRuleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (readOnlyMode) {
      return;
    }

    const normalizedValue = ruleValue.trim();

    if (!normalizedValue) {
      setRuleError("规则值不能为空。");
      return;
    }

    try {
      await onRuleUpsert({
        id: editingRuleId ?? undefined,
        kind: ruleKind,
        value: normalizedValue,
        enabled: ruleEnabled,
      });

      resetRuleEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRuleError(message.includes("RULE_DUPLICATE") ? "同类型同值规则已存在。" : "规则保存失败，请重试。");
    }
  }

  function handleRuleEdit(rule: ExclusionRule) {
    setEditingRuleId(rule.id);
    setRuleKind(rule.kind);
    setRuleValue(rule.value);
    setRuleEnabled(rule.enabled);
    setRuleError(null);
    setIsRuleEditorOpen(true);
  }

  async function handleRuleToggle(rule: ExclusionRule) {
    if (readOnlyMode) {
      return;
    }

    try {
      await onRuleUpsert({
        id: rule.id,
        kind: rule.kind,
        value: rule.value,
        enabled: !rule.enabled,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRuleError(message.includes("RULE_DUPLICATE") ? "规则切换失败：存在重复规则。" : "规则更新失败，请重试。");
    }
  }

  async function handleRuleDeleteAction(ruleId: string) {
    if (readOnlyMode) {
      return;
    }

    await onRuleDelete(ruleId);

    if (editingRuleId === ruleId) {
      resetRuleEditor();
    }
  }

  async function handleRulesClearAction() {
    if (readOnlyMode) {
      return;
    }

    await onRulesClear();
    resetRuleEditor();
  }

  async function handleClose() {
    if (isShortcutRecording) {
      await onShortcutCancel();
      setIsShortcutRecording(false);
      setShortcutPreview(null);
      setShortcutError(null);
    }

    onClose();
  }

  React.useEffect(() => {
    if (!isShortcutRecording) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void onShortcutCancel();
      setIsShortcutRecording(false);
      setShortcutPreview(null);
      setShortcutError("录入超时，已恢复到旧绑定。");
    }, 10000);

    return () => window.clearTimeout(timeout);
  }, [isShortcutRecording, onShortcutCancel]);

  React.useEffect(() => {
    if (!isShortcutRecording) {
      return;
    }

    async function handleShortcutCapture(event: KeyboardEvent) {
      if (event.isComposing) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        await onShortcutCancel();
        setIsShortcutRecording(false);
        setShortcutPreview(null);
        setShortcutError(null);
        return;
      }

      const candidate = buildShortcutFromEvent(event);

      if (!candidate) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setShortcutPreview(candidate);

      const validation = await onShortcutValidate(candidate);

      if (validation.conflictType) {
        setShortcutError(
          validation.conflictType === "system"
            ? `该快捷键已被系统占用：${validation.conflictTarget ?? "macOS 保留快捷键"}`
            : `该快捷键与现有绑定冲突：${validation.conflictTarget ?? "SuperClip 内部快捷路径"}`,
        );
        return;
      }

      await onShortcutUpdate(candidate);
      setIsShortcutRecording(false);
      setShortcutPreview(null);
      setShortcutError(null);
    }

    window.addEventListener("keydown", handleShortcutCapture);
    return () => window.removeEventListener("keydown", handleShortcutCapture);
  }, [isShortcutRecording, onShortcutCancel, onShortcutUpdate, onShortcutValidate]);

  React.useEffect(() => {
    if (isShortcutRecording) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.isComposing) {
        return;
      }

      event.preventDefault();
      void handleClose();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isShortcutRecording, onClose, onShortcutCancel]);

  React.useEffect(() => {
    if (!readOnlyMode || !isShortcutRecording) {
      return;
    }

    void onShortcutCancel();
    setIsShortcutRecording(false);
    setShortcutPreview(null);
    setShortcutError(null);
  }, [isShortcutRecording, onShortcutCancel, readOnlyMode]);

  React.useEffect(() => {
    if (activeSection === "shortcuts") {
      return;
    }

    if (!isShortcutRecording) {
      return;
    }

    void onShortcutCancel();
    setIsShortcutRecording(false);
    setShortcutPreview(null);
    setShortcutError(null);
  }, [activeSection, isShortcutRecording, onShortcutCancel]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* ================= F2 顶部 toolbar：identity + 返回列表（与 E2/F2 同位） ================= */}
      <div className="shrink-0 px-4 pt-3.5">
        <div className="flex items-center gap-2.5">
          {/* Window identity：渐变图标 + 「设置」（与 Main 列表 toolbar 的 identity 语言一致） */}
          <div className="flex shrink-0 items-center gap-[7px]">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-gradient-to-br from-[rgba(56,189,248,0.35)] to-[rgba(167,139,250,0.25)] shadow-[0_0_12px_rgba(56,189,248,0.2)]"
              aria-hidden="true"
            >
              <Copy className="h-3 w-3 text-white/85" />
            </div>
            <span className="text-[13px] font-semibold text-[var(--text-secondary)]">设置</span>
          </div>

          <div className="flex-1" />

          {/* 返回列表（回到 Main 的剪贴板分区） */}
          <BackButton onClick={() => void handleClose()}>
            <ArrowLeft className="h-[13px] w-[13px]" />
            <span>返回列表</span>
          </BackButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden pt-2.5">
        {/* ================= F2 左侧分区导航 ================= */}
        <aside
          className="w-[168px] shrink-0 px-2 pb-2 pt-1"
          style={{ borderRight: "1px solid var(--sidebar-border)" }}
        >
          <nav className="flex flex-col gap-0.5">
            {sections.map((section) => (
              <SidebarNavItem
                key={section.key}
                icon={<section.icon className="h-[13px] w-[13px] shrink-0" />}
                label={section.label}
                isActive={activeSection === section.key}
                onClick={() => setActiveSection(section.key)}
              />
            ))}
          </nav>
        </aside>

        {/* ================= 内容区（分区切换 fadeSlideIn） ================= */}
        <div className="flex min-w-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <div
              key={activeSection}
              className="px-5 pb-5 pt-3.5"
              style={{ animation: "fadeSlideIn 0.18s ease-out" }}
            >
              {readOnlyMode ? (
                <div className="mb-3.5 rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[12px] text-[var(--warning-text)]">
                  只读模式：修改类操作已禁用。
                </div>
              ) : null}

              {activeSection === "general" ? (
                <div>
                  <PaneTitle>通用</PaneTitle>

                  {/* 主题 */}
                  <SectionCard title="主题" description="选择 SuperClip 的显示外观">
                    <div className="flex gap-1.5">
                      {[
                        { value: "system", title: "跟随系统", icon: Monitor },
                        { value: "light", title: "浅色", icon: Sun },
                        { value: "dark", title: "深色", icon: Moon },
                      ].map((option) => {
                        const isActive = settings.themeMode === option.value;
                        const Icon = option.icon;
                        return (
                          <ThemeSegButton
                            key={option.value}
                            active={isActive}
                            disabled={readOnlyMode}
                            onClick={() =>
                              void onUpdate({
                                themeMode: option.value as SettingsResponse["themeMode"],
                              })
                            }
                          >
                            <Icon className="h-[13px] w-[13px]" />
                            {option.title}
                          </ThemeSegButton>
                        );
                      })}
                    </div>
                  </SectionCard>

                  {/* 历史保留上限 */}
                  <SectionCard
                    title="历史保留上限"
                    description="超出上限时自动清理最早记录"
                    style={{ marginTop: 14 }}
                  >
                    <div className="flex items-center gap-3.5">
                      <input
                        type="range"
                        min={100}
                        max={5000}
                        step={100}
                        disabled={readOnlyMode}
                        value={settings.historyLimit}
                        onChange={(event) => {
                          const nextValue = Number(event.currentTarget.value);
                          if (Number.isNaN(nextValue)) {
                            return;
                          }

                          void onUpdate({
                            historyLimit: Math.max(100, Math.min(5000, nextValue)),
                          });
                        }}
                        className="slider-range flex-1"
                        style={
                          {
                            "--slider-fill": `${((settings.historyLimit - 100) / (5000 - 100)) * 100}%`,
                            "--slider-track-color": sliderTrack.bg,
                            "--slider-hover-thumb-color": sliderTrack.hover,
                            "--slider-active-thumb-color": sliderTrack.active,
                          } as React.CSSProperties
                        }
                      />
                      <span className="min-w-[44px] text-right text-[13px] font-semibold tabular-nums" style={{ color: "rgba(56,189,248,0.85)" }}>
                        {settings.historyLimit}
                      </span>
                      <span className="min-w-[32px] text-[10.5px] text-[var(--text-tertiary)]">条</span>
                    </div>
                    {pinnedCount > 50 ? (
                      <div className="mt-2 rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[12px] leading-5 text-[var(--warning-text)]">
                        置顶项较多，可能影响首屏检索效率。建议进入历史整理路径收敛置顶数量。
                      </div>
                    ) : null}
                  </SectionCard>

                  {/* 粘贴行为（真实设置项：F2 原型未含，结构沿用通用卡 + 分段语言） */}
                  <SectionCard
                    title="粘贴行为"
                    description="设置 Enter 默认执行直接粘贴还是仅复制"
                    style={{ marginTop: 14 }}
                  >
                    <Row
                      label="默认动作"
                      hint="Enter 执行默认动作，Cmd+Enter 执行相反动作"
                      action={
                        <div className="flex w-[240px] gap-1.5">
                          {[
                            { value: "direct_paste", label: "直接粘贴优先" },
                            { value: "copy_only", label: "仅复制优先" },
                          ].map((option) => (
                            <SegControlButton
                              key={option.value}
                              active={settings.defaultAction === option.value}
                              disabled={readOnlyMode}
                              onClick={() =>
                                void onUpdate({
                                  defaultAction: option.value as SettingsResponse["defaultAction"],
                                })
                              }
                            >
                              {option.label}
                            </SegControlButton>
                          ))}
                        </div>
                      }
                    />

                    <div className="mt-1 text-[10.5px] leading-5 text-[var(--text-tertiary)]">
                      失败回退始终开启；文件类型固定为仅复制，富文本和图片在目标应用不支持时会降级。
                    </div>
                  </SectionCard>

                  {/* 启动行为 */}
                  <SectionCard title="启动行为" description="" style={{ marginTop: 14 }}>
                    <Row
                      label="登录时启动"
                      hint="登录 macOS 时自动启动 SuperClip"
                      action={
                        <Switch
                          checked={settings.launchAtLogin}
                          disabled={readOnlyMode}
                          aria-label="登录时启动"
                          onCheckedChange={(checked) => void handleStartupUpdate({ launchAtLogin: checked })}
                        />
                      }
                    />
                    <RowDivider />
                    <Row
                      label="启动时自动显示"
                      hint="启动后自动打开 Main 窗口"
                      action={
                        <Switch
                          checked={settings.showOnStartup}
                          disabled={readOnlyMode}
                          aria-label="启动时自动显示"
                          onCheckedChange={(checked) => void handleStartupUpdate({ showOnStartup: checked })}
                        />
                      }
                    />

                    {startupError ? (
                      <div className="mt-2 flex items-center justify-between gap-3 rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[12px] text-[var(--warning-text)]">
                        <p>{startupError}</p>
                        {startupRetryPatch ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={readOnlyMode}
                            onClick={() => void handleStartupUpdate(startupRetryPatch)}
                          >
                            重试
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </SectionCard>
                </div>
              ) : null}

              {activeSection === "shortcuts" ? (
                <div>
                  <PaneTitle>快捷键</PaneTitle>

                  {/* 全局快捷键：当前绑定行 + 录入操作（真实后端录制器，保留） */}
                  <SectionCard title="全局快捷键" description="这些快捷键在任意应用中均可使用">
                    <Row
                      label="唤出 Popup"
                      hint=""
                      action={
                        <div className="flex items-center gap-2">
                          <ShortcutBadge>{shortcut.binding}</ShortcutBadge>
                          {!isShortcutRecording ? (
                            <ChangeButton
                              disabled={readOnlyMode}
                              onClick={async () => {
                                await onShortcutStart();
                                setIsShortcutRecording(true);
                                setShortcutPreview(null);
                                setShortcutError(null);
                              }}
                            >
                              更改
                            </ChangeButton>
                          ) : (
                            <ChangeButton
                              disabled={readOnlyMode}
                              onClick={async () => {
                                await onShortcutCancel();
                                setIsShortcutRecording(false);
                                setShortcutPreview(null);
                                setShortcutError(null);
                              }}
                            >
                              取消
                            </ChangeButton>
                          )}
                        </div>
                      }
                    />

                    {/* 录入状态块：录入中 / 错误提示时展开 */}
                    <div
                      className="mt-2 rounded-[8px] px-3 py-2.5"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-medium" style={{ border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text-secondary)" }}>
                          来源：{shortcut.source === "default" ? "默认" : "用户"}
                        </span>
                        <span className="inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-medium" style={{ border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text-secondary)" }}>
                          {shortcut.isRegistered ? "已注册" : "待注册"}
                        </span>
                        <span className="flex-1" />
                        <ChangeButton
                          disabled={readOnlyMode}
                          onClick={async () => {
                            await onShortcutRestoreDefault();
                            setIsShortcutRecording(false);
                            setShortcutPreview(null);
                            setShortcutError(null);
                          }}
                        >
                          恢复默认
                        </ChangeButton>
                      </div>
                      <p className="mt-2 text-[12px] font-medium text-[var(--text-primary)]">
                        {isShortcutRecording
                          ? shortcutPreview ?? "按下新的组合键，Esc 取消。"
                          : shortcut.binding}
                      </p>
                      <p className="mt-0.5 text-[10.5px] leading-5 text-[var(--text-tertiary)]">
                        {isShortcutRecording
                          ? "10 秒无输入自动退出。"
                          : "点击「更改」重新录入，录入后会先做冲突校验。"}
                      </p>

                      {shortcutError ? (
                        <div className="mt-2 rounded-[8px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[12px] leading-5 text-[var(--warning-text)]">
                          {shortcutError}
                        </div>
                      ) : null}
                    </div>
                  </SectionCard>

                  <SectionCard title="应用内快捷键" description="仅在 Main 窗口中可用" style={{ marginTop: 14 }}>
                    <Row label="切换列表/网格" hint="" action={<ShortcutBadge>⌘L</ShortcutBadge>} />
                    <RowDivider />
                    <Row label="全选" hint="" action={<ShortcutBadge>⌘A</ShortcutBadge>} />
                    <RowDivider />
                    <Row label="删除选中" hint="" action={<ShortcutBadge>⌘⌫</ShortcutBadge>} />
                  </SectionCard>
                </div>
              ) : null}

              {activeSection === "privacy" ? (
                <div>
                  <div className="mb-3.5 flex items-center justify-between">
                    <PaneTitle style={{ margin: 0 }}>排除规则</PaneTitle>
                    {!isRuleEditorOpen ? (
                      <PrimaryBtn
                        disabled={readOnlyMode}
                        onClick={() => {
                          resetRuleEditor();
                          setIsRuleEditorOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        添加规则
                      </PrimaryBtn>
                    ) : null}
                  </div>

                  {/* 规则编辑器：点击「添加规则 / 编辑」后展开（真实后端 upsert，保留） */}
                  {isRuleEditorOpen ? (
                    <SectionCard
                      title={editingRuleId ? "编辑规则" : "添加规则"}
                      description="符合任一启用规则的内容将被排除在历史记录之外"
                    >
                      <form onSubmit={handleRuleSubmit}>
                        <div className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-[160px_minmax(0,1fr)_120px]">
                          <label className="space-y-1.5">
                            <span className="text-[11px] font-medium text-[var(--text-secondary)]">规则类型</span>
                            <select
                              disabled={readOnlyMode}
                              value={ruleKind}
                              onChange={(event) => {
                                const nextKind = event.currentTarget.value as ExclusionRuleKind;
                                setRuleKind(nextKind);
                                setRuleValue(nextKind === "content_kind" ? "text" : "");
                                setRuleError(null);
                              }}
                              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] outline-none"
                            >
                              {Object.entries(ruleKindLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="space-y-1.5">
                            <span className="text-[11px] font-medium text-[var(--text-secondary)]">规则值</span>
                            {ruleKind === "content_kind" ? (
                              <select
                                disabled={readOnlyMode}
                                value={ruleValue || "text"}
                                onChange={(event) => {
                                  setRuleValue(event.currentTarget.value);
                                  setRuleError(null);
                                }}
                                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] outline-none"
                              >
                                {contentKindOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                disabled={readOnlyMode}
                                value={ruleValue}
                                onChange={(event) => {
                                  setRuleValue(event.currentTarget.value);
                                  setRuleError(null);
                                }}
                                placeholder={ruleKind === "bundle_id" ? "如 com.apple.KeychainAccess" : "如 验证码"}
                                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] outline-none"
                              />
                            )}
                          </label>

                          <label className="space-y-1.5">
                            <span className="text-[11px] font-medium text-[var(--text-secondary)]">启用状态</span>
                            <div className="flex items-center justify-between rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5">
                              <span className="text-[12px] text-[var(--text-secondary)]">{ruleEnabled ? "启用" : "停用"}</span>
                              <Switch
                                checked={ruleEnabled}
                                disabled={readOnlyMode}
                                aria-label="规则启用状态"
                                onCheckedChange={setRuleEnabled}
                              />
                            </div>
                          </label>
                        </div>

                        {ruleError ? (
                          <div className="mt-3 rounded-[8px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[12px] text-[var(--warning-text)]">
                            {ruleError}
                          </div>
                        ) : null}

                        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                          <PrimaryBtn disabled={readOnlyMode}>
                            {editingRuleId ? "保存规则" : "新增规则"}
                          </PrimaryBtn>
                          <ChangeButton
                            disabled={readOnlyMode}
                            onClick={() => {
                              resetRuleEditor();
                              setIsRuleEditorOpen(false);
                            }}
                          >
                            取消
                          </ChangeButton>
                          <span className="flex-1" />
                          <ChangeButton
                            disabled={readOnlyMode || !rules.length}
                            onClick={() => void handleRulesClearAction()}
                          >
                            清空全部规则
                          </ChangeButton>
                        </div>
                      </form>
                    </SectionCard>
                  ) : null}

                  {/* 当前规则 */}
                  <SectionCard
                    title="当前规则"
                    description="符合任一规则的内容将被排除在历史记录之外"
                    style={{ marginTop: isRuleEditorOpen ? 14 : 0 }}
                  >
                    <div className="-mt-1 mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-[4px] px-1.5 py-0.5 text-[9.5px]" style={{ background: "var(--surface-2)", color: "var(--text-tertiary)" }}>
                        共 {rules.length} 条
                      </span>
                      <span className="inline-flex rounded-[4px] px-1.5 py-0.5 text-[9.5px]" style={{ background: "var(--surface-2)", color: "var(--text-tertiary)" }}>
                        启用中 {rules.filter((rule) => rule.enabled).length} 条
                      </span>
                    </div>

                    {rules.length ? (
                      rules.map((rule, index) => (
                        <React.Fragment key={rule.id}>
                          {index > 0 ? <RowDivider /> : null}
                          <RuleRow
                            rule={rule}
                            readOnlyMode={readOnlyMode}
                            onToggle={() => void handleRuleToggle(rule)}
                            onEdit={() => {
                              handleRuleEdit(rule);
                              setIsRuleEditorOpen(true);
                            }}
                            onDelete={() => void handleRuleDeleteAction(rule.id)}
                          />
                        </React.Fragment>
                      ))
                    ) : (
                      <div className="rounded-[8px] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center">
                        <p className="text-[12px] font-medium text-[var(--text-primary)]">还没有排除规则</p>
                        <p className="mt-1.5 text-[10.5px] leading-5 text-[var(--text-tertiary)]">
                          先从最敏感的来源应用、关键词或内容类型开始，逐步收紧入库范围。
                        </p>
                      </div>
                    )}
                  </SectionCard>
                </div>
              ) : null}

              {activeSection === "about" ? (
                <div>
                  <PaneTitle>高级</PaneTitle>

                  <SectionCard title="存储信息" description="数据库和配置文件位置">
                    <div
                      className="rounded-[8px] px-3 py-2.5 font-mono text-[11.5px] leading-[1.8] text-[var(--text-secondary)]"
                      style={{ background: "var(--card-bg)", border: "1px solid var(--divider)" }}
                    >
                      <div>~/Library/Application Support/com.superclip/</div>
                      <div className="text-[var(--text-tertiary)]">├── superclip.db (SQLite v3)</div>
                      <div className="text-[var(--text-tertiary)]">├── config.json (Schema v1)</div>
                      <div className="text-[var(--text-tertiary)]">└── logs/</div>
                    </div>
                  </SectionCard>

                  <SectionCard title="诊断" description="用于排查问题的工具" style={{ marginTop: 14 }}>
                    <DangerBtn onClick={() => void onDiagnosticsClick()}>
                      <Database className="h-[13px] w-[13px]" />
                      导出诊断数据
                    </DangerBtn>
                  </SectionCard>

                  {/* 关于（真实版本 / 权限状态，合理扩展卡） */}
                  <SectionCard title="关于" description="版本与权限状态" style={{ marginTop: 14 }}>
                    <Row
                      label="当前版本"
                      hint="SuperClip 本地客户端"
                      action={<ShortcutBadge>superclip@0.1.0</ShortcutBadge>}
                    />
                    <RowDivider />
                    <Row
                      label="Accessibility"
                      hint={permissionTrusted ? "直接粘贴可用" : "未授权时仅复制"}
                      action={
                        <div className="flex items-center justify-end gap-2.5">
                          <span
                            className="inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[9.5px]"
                            style={
                              permissionTrusted
                                ? { background: "var(--surface-2)", color: "var(--text-secondary)" }
                                : { background: "var(--warning-bg)", color: "var(--warning-text)", border: "1px solid var(--warning-border)" }
                            }
                          >
                            {permissionTrusted ? "已授权" : "未授权"}
                          </span>
                          <ChangeButton onClick={() => void onPermissionGuideClick()}>
                            打开系统设置
                          </ChangeButton>
                        </div>
                      }
                    />
                  </SectionCard>
                </div>
              ) : null}

            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
