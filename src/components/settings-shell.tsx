import * as React from "react";
import {
  ClipboardPaste,
  Download,
  Info,
  Keyboard,
  Palette,
  PencilLine,
  Plus,
  Rocket,
  Settings2,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
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

type SettingsSectionKey =
  | "general"
  | "shortcuts"
  | "pasteBehavior"
  | "privacy"
  | "appearance"
  | "startup"
  | "about";

interface SettingsShellProps {
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
  icon: typeof Settings2;
}> = [
  { key: "general", label: "通用", icon: Settings2 },
  { key: "shortcuts", label: "快捷键", icon: Keyboard },
  { key: "pasteBehavior", label: "粘贴行为", icon: ClipboardPaste },
  { key: "privacy", label: "隐私规则", icon: Shield },
  { key: "appearance", label: "外观", icon: Palette },
  { key: "startup", label: "启动更新", icon: Rocket },
  { key: "about", label: "关于", icon: Info },
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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div>
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-1 max-w-[38rem] text-[12px] leading-5 text-[var(--text-secondary)]">
          {description}
        </p>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

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
    <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 min-[820px]:flex-row min-[820px]:items-center min-[820px]:justify-between">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{label}</p>
        <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{hint}</p>
      </div>
      <div className="shrink-0">{action}</div>
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
  const activeSectionMeta = sections.find((section) => section.key === activeSection) ?? sections[0];

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
    <div className="fixed inset-0 z-40 bg-[var(--bg)]">
      <div className="flex h-full w-full overflow-hidden border border-[var(--border)] bg-[var(--bg)]">
        <aside className="hidden w-[92px] shrink-0 border-r border-[var(--border)] bg-[var(--surface-raised)] p-2 min-[840px]:flex min-[840px]:flex-col">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <Settings2 className="h-4 w-4" />
          </div>

          <nav className="mt-3 space-y-1">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-[8px] border px-1.5 py-1.5 text-center transition-colors",
                  activeSection === section.key
                    ? "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-primary)]"
                    : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
                )}
              >
                <section.icon className="h-4 w-4" />
                <span className="text-[10px] font-medium leading-4">{section.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2 py-2.5 text-center">
            <p className="text-[10px] font-medium text-[var(--text-tertiary)]">SuperClip</p>
            <p className="mt-1 text-[11px] font-semibold text-[var(--text-primary)]">0.1.0</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                  {activeSectionMeta.label}
                </h2>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={onDiagnosticsClick}>
                  <Download className="h-4 w-4" />
                  诊断
                </Button>
                <Button variant="secondary" size="sm" onClick={onPermissionGuideClick}>
                  <Shield className="h-4 w-4" />
                  权限
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handleClose()}>
                  <X className="h-4 w-4" />
                  关闭
                </Button>
              </div>
            </div>

            <div className="mt-2.5 flex gap-2 overflow-x-auto min-[840px]:hidden">
              {sections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={cn(
                    "shrink-0 rounded-[10px] border px-3 py-1.5 text-xs font-medium transition-colors",
                    activeSection === section.key
                      ? "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
                  )}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </header>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-2.5 px-3.5 py-3">
              {readOnlyMode ? (
                <div className="rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-text)]">
                  只读模式：修改类操作已禁用。
                </div>
              ) : null}

              {activeSection === "general" ? (
                <SectionCard
                  title="通用"
                  description="历史数量和置顶提醒。"
                >
                  <Row
                    label="历史保留数量"
                    hint="建议 100 到 5000。"
                    action={
                      <label className="inline-flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
                        <input
                          type="number"
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
                          className="w-24 border-0 bg-transparent text-right text-sm font-medium text-[var(--text-primary)] outline-none"
                        />
                        <span className="text-xs text-[var(--text-tertiary)]">items</span>
                      </label>
                    }
                  />

                  {pinnedCount > 50 ? (
                    <div className="rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm leading-6 text-[var(--warning-text)]">
                      置顶项较多，可能影响首屏检索效率。建议进入历史整理路径收敛置顶数量。
                    </div>
                  ) : null}
                </SectionCard>
              ) : null}

              {activeSection === "shortcuts" ? (
                <SectionCard
                  title="快捷键"
                  description="修改全局唤起快捷键。"
                >
                  <Row
                    label="当前全局快捷键"
                    hint="重新录入后按下新的组合键。"
                    action={
                      <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
                        <Keyboard className="h-4 w-4 text-[var(--text-secondary)]" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">{shortcut.binding}</span>
                      </div>
                    }
                  />

                  <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                        来源：{shortcut.source === "default" ? "默认" : "用户"}
                      </span>
                      <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                        {shortcut.isRegistered ? "已注册" : "待注册"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {!isShortcutRecording ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={readOnlyMode}
                          onClick={async () => {
                            await onShortcutStart();
                            setIsShortcutRecording(true);
                            setShortcutPreview(null);
                            setShortcutError(null);
                          }}
                        >
                          重新录入
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={readOnlyMode}
                          onClick={async () => {
                            await onShortcutCancel();
                            setIsShortcutRecording(false);
                            setShortcutPreview(null);
                            setShortcutError(null);
                          }}
                        >
                          取消
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={readOnlyMode}
                        onClick={async () => {
                          await onShortcutRestoreDefault();
                          setIsShortcutRecording(false);
                          setShortcutPreview(null);
                          setShortcutError(null);
                        }}
                      >
                        恢复默认
                      </Button>
                    </div>

                    <div className="mt-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                      <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">
                        录入
                      </p>
                      <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                        {isShortcutRecording
                          ? shortcutPreview ?? "按下新的组合键，Esc 取消。"
                          : shortcut.binding}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                        {isShortcutRecording
                          ? "10 秒无输入自动退出。"
                          : "录入后会先做冲突校验。"}
                      </p>
                    </div>

                    {shortcutError ? (
                      <div className="mt-3 rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm leading-6 text-[var(--warning-text)]">
                        {shortcutError}
                      </div>
                    ) : null}
                  </div>
                </SectionCard>
              ) : null}

              {activeSection === "pasteBehavior" ? (
                <SectionCard
                  title="粘贴行为"
                  description="设置 Enter 默认执行直接粘贴还是仅复制。"
                >
                  <Row
                    label="默认动作"
                    hint="Enter 执行默认动作，Cmd+Enter 执行相反动作。"
                    action={
                      <div className="flex rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-1">
                        {[
                          { value: "direct_paste", label: "直接粘贴优先" },
                          { value: "copy_only", label: "仅复制优先" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={readOnlyMode}
                            onClick={() =>
                              void onUpdate({
                                defaultAction: option.value as SettingsResponse["defaultAction"],
                              })
                            }
                            className={cn(
                              "rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors",
                              settings.defaultAction === option.value
                                ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
                              readOnlyMode && "cursor-not-allowed opacity-60",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    }
                  />

                  <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                    失败回退始终开启；文件类型固定为仅复制，富文本和图片在目标应用不支持时会降级。
                  </div>
                </SectionCard>
              ) : null}

              {activeSection === "startup" ? (
                <SectionCard
                  title="启动与更新"
                  description="管理登录启动、启动展示和本地版本状态。"
                >
                  <Row
                    label="登录时启动"
                    hint="失败时在本行提示并可重试。"
                    action={
                      <div className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
                        <Switch
                          checked={settings.launchAtLogin}
                          disabled={readOnlyMode}
                          onCheckedChange={(checked) => void handleStartupUpdate({ launchAtLogin: checked })}
                        />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {settings.launchAtLogin ? "已开启" : "已关闭"}
                        </span>
                      </div>
                    }
                  />

                  <Row
                    label="启动时自动显示"
                    hint="开启后仍以空搜索打开。"
                    action={
                      <div className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
                        <Switch
                          checked={settings.showOnStartup}
                          disabled={readOnlyMode}
                          onCheckedChange={(checked) => void handleStartupUpdate({ showOnStartup: checked })}
                        />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {settings.showOnStartup ? "已开启" : "已关闭"}
                        </span>
                      </div>
                    }
                  />

                  {startupError ? (
                    <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-text)] min-[820px]:flex-row min-[820px]:items-center min-[820px]:justify-between">
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

                  <Row
                    label="版本状态"
                    hint="当前本地客户端版本。"
                    action={
                      <div className="inline-flex items-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                        0.1.0
                      </div>
                    }
                  />
                </SectionCard>
              ) : null}


              {activeSection === "privacy" ? (
                <SectionCard
                  title="隐私与排除规则"
                  description="按来源、类型或关键词跳过入库。"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                      共 {rules.length} 条
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                      启用中 {rules.filter((rule) => rule.enabled).length} 条
                    </span>
                  </div>

                  <form onSubmit={handleRuleSubmit} className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
                    <div className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-[160px_minmax(0,1fr)_120px]">
                      <label className="space-y-2">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">规则类型</span>
                        <select
                          disabled={readOnlyMode}
                          value={ruleKind}
                          onChange={(event) => {
                            const nextKind = event.currentTarget.value as ExclusionRuleKind;
                            setRuleKind(nextKind);
                            setRuleValue(nextKind === "content_kind" ? "text" : "");
                            setRuleError(null);
                          }}
                          className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
                        >
                          {Object.entries(ruleKindLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">规则值</span>
                        {ruleKind === "content_kind" ? (
                          <select
                            disabled={readOnlyMode}
                            value={ruleValue || "text"}
                            onChange={(event) => {
                              setRuleValue(event.currentTarget.value);
                              setRuleError(null);
                            }}
                            className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
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
                            className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
                          />
                        )}
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">启用状态</span>
                        <div className="flex items-center justify-between rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
                          <span className="text-sm text-[var(--text-secondary)]">{ruleEnabled ? "启用" : "停用"}</span>
                          <Switch
                            checked={ruleEnabled}
                            disabled={readOnlyMode}
                            onCheckedChange={setRuleEnabled}
                          />
                        </div>
                      </label>
                    </div>

                    {ruleError ? (
                      <div className="mt-3 rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-text)]">
                        {ruleError}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button size="sm" type="submit" disabled={readOnlyMode}>
                        <Plus className="h-4 w-4" />
                        {editingRuleId ? "保存规则" : "新增规则"}
                      </Button>
                      {editingRuleId ? (
                        <Button size="sm" variant="secondary" type="button" onClick={resetRuleEditor} disabled={readOnlyMode}>
                          取消编辑
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => void handleRulesClearAction()}
                        disabled={readOnlyMode || !rules.length}
                      >
                        清空全部规则
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {rules.length ? (
                      rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex flex-col gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                                {ruleKindLabels[rule.kind]}
                              </span>
                              <span className="text-sm font-medium text-[var(--text-primary)]">{rule.value}</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                              {rule.kind === "bundle_id"
                                ? "命中该来源应用后，剪贴板内容将被跳过入库。"
                                : rule.kind === "content_kind"
                                  ? "命中该类型后跳过。"
                                  : "命中关键词后跳过。"}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                              <Switch
                                checked={rule.enabled}
                                disabled={readOnlyMode}
                                onCheckedChange={() => void handleRuleToggle(rule)}
                              />
                              <span className="text-xs font-medium text-[var(--text-secondary)]">
                                {rule.enabled ? "已启用" : "已停用"}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              type="button"
                              onClick={() => handleRuleEdit(rule)}
                              disabled={readOnlyMode}
                            >
                              <PencilLine className="h-4 w-4" />
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              onClick={() => void handleRuleDeleteAction(rule.id)}
                              disabled={readOnlyMode}
                            >
                              <Trash2 className="h-4 w-4" />
                              删除
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[10px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-7 text-center">
                        <p className="text-sm font-medium text-[var(--text-primary)]">还没有排除规则</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                          先从最敏感的来源应用、关键词或内容类型开始，逐步收紧入库范围。
                        </p>
                      </div>
                    )}
                  </div>
                </SectionCard>
              ) : null}

              {activeSection === "appearance" ? (
                <SectionCard
                  title="外观"
                  description="选择浅色、深色或跟随系统。"
                >
                  <div className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-3">
                    {[
                      { value: "light", title: "浅色", hint: "默认高级灰白基调" },
                      { value: "dark", title: "深色", hint: "低饱和夜间模式" },
                      { value: "system", title: "跟随系统", hint: "随 macOS 外观切换" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={readOnlyMode}
                        onClick={() =>
                          void onUpdate({
                            themeMode: option.value as SettingsResponse["themeMode"],
                          })
                        }
                        className={cn(
                          "rounded-[10px] border px-3 py-3 text-left transition-colors",
                          settings.themeMode === option.value
                            ? "border-[var(--border-strong)] bg-[var(--surface)]"
                            : "border-[var(--border)] bg-[var(--surface-2)]",
                          readOnlyMode && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <p className="text-sm font-medium text-[var(--text-primary)]">{option.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{option.hint}</p>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              {activeSection === "about" ? (
                <SectionCard
                  title="关于"
                  description="版本、诊断和权限状态。"
                >
                  <Row
                    label="当前版本"
                    hint="SuperClip 本地客户端。"
                    action={
                      <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
                        superclip@0.1.0
                      </div>
                    }
                  />

                  <Row
                    label="诊断导出"
                    hint="导出本地排障信息，不包含剪贴板原文。"
                    action={
                      <Button variant="secondary" size="sm" onClick={onDiagnosticsClick}>
                        <Download className="h-4 w-4" />
                        导出诊断
                      </Button>
                    }
                  />

                  <Row
                    label="Accessibility"
                    hint={
                      permissionTrusted
                        ? "直接粘贴可用。"
                        : "未授权时仅复制。"
                    }
                    action={
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <div
                          className={cn(
                            "inline-flex items-center rounded-full border px-3 py-2 text-xs font-medium",
                            permissionTrusted
                              ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
                              : "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]",
                          )}
                        >
                          {permissionTrusted ? "已授权" : "未授权"}
                        </div>
                        <Button variant="secondary" size="sm" onClick={onPermissionGuideClick}>
                          <Shield className="h-4 w-4" />
                          打开系统设置
                        </Button>
                      </div>
                    }
                  />
                </SectionCard>
              ) : null}

              <Separator />

              <div className="text-xs text-[var(--text-tertiary)]">
                Esc 关闭，Tab 切换控件。
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
