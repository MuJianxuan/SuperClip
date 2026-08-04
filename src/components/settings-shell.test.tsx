import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsShell, type SettingsShellProps } from "./settings-shell";
import type {
  SettingsResponse,
  ShortcutStateResponse,
  ExclusionRule,
  ShortcutValidationResponse,
} from "../lib/superclip";

const settings: SettingsResponse = {
  schemaVersion: 1,
  exposedKeys: [],
  reservedKeys: [],
  defaultAction: "direct_paste",
  themeMode: "system",
  historyLimit: 1000,
  launchAtLogin: false,
  showOnStartup: false,
};

const shortcut: ShortcutStateResponse = {
  binding: "Cmd+Shift+V",
  isRegistered: true,
  source: "default",
  version: 1,
};

const rules: ExclusionRule[] = [
  { id: "rule-1", kind: "bundle_id", value: "com.apple.KeychainAccess", enabled: true, version: 1 },
];

function makeProps(overrides: Partial<SettingsShellProps> = {}): SettingsShellProps {
  return {
    settings,
    shortcut,
    rules,
    pinnedCount: 0,
    permissionTrusted: true,
    readOnlyMode: false,
    onClose: vi.fn(),
    onUpdate: vi.fn(async () => {
      /* no-op: onUpdate 返回 Promise<void> */
    }),
    onDiagnosticsClick: vi.fn(),
    onPermissionGuideClick: vi.fn(),
    onRuleUpsert: vi.fn(),
    onRuleDelete: vi.fn(),
    onRulesClear: vi.fn(),
    onShortcutStart: vi.fn(),
    onShortcutCancel: vi.fn(),
    onShortcutValidate: vi.fn(async (): Promise<ShortcutValidationResponse> => ({
      binding: "Cmd+Shift+U",
      isRegistered: true,
      source: "default",
      version: 1,
      conflictType: null,
      conflictTarget: null,
    })),
    onShortcutUpdate: vi.fn(),
    onShortcutRestoreDefault: vi.fn(),
    ...overrides,
  };
}

describe("SettingsShell (F2 分区化)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("渲染 F2 四分区导航：通用/快捷键/排除规则/高级", () => {
    render(<SettingsShell {...makeProps()} />);
    // 「通用」在导航与 header 副标题各出现一次
    expect(screen.getAllByText("通用").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("快捷键")).toBeInTheDocument();
    expect(screen.getByText("排除规则")).toBeInTheDocument();
    expect(screen.getByText("高级")).toBeInTheDocument();
  });

  it("默认展示通用分区：主题分段 + 历史滑块 + 粘贴行为 + 启动行为", () => {
    render(<SettingsShell {...makeProps()} />);
    // 主题分段
    expect(screen.getByText("浅色")).toBeInTheDocument();
    expect(screen.getByText("深色")).toBeInTheDocument();
    expect(screen.getByText("跟随系统")).toBeInTheDocument();
    // 历史保留上限滑块
    expect(screen.getByText("历史保留数量")).toBeInTheDocument();
    // 粘贴行为
    expect(screen.getByText("直接粘贴优先")).toBeInTheDocument();
    expect(screen.getByText("仅复制优先")).toBeInTheDocument();
    // 启动行为
    expect(screen.getByText("登录时启动")).toBeInTheDocument();
    expect(screen.getByText("启动时自动显示")).toBeInTheDocument();
  });

  it("切到快捷键分区：全局快捷键录入 + 应用内快捷键卡", () => {
    render(<SettingsShell {...makeProps()} />);
    fireEvent.click(screen.getByText("快捷键"));
    // 全局快捷键
    expect(screen.getByText("当前全局快捷键")).toBeInTheDocument();
    expect(screen.getAllByText("Cmd+Shift+V").length).toBeGreaterThanOrEqual(1);
    // 应用内快捷键
    expect(screen.getByText("应用内快捷键")).toBeInTheDocument();
    expect(screen.getByText("⌘L")).toBeInTheDocument();
    expect(screen.getByText("⌘A")).toBeInTheDocument();
    expect(screen.getByText("⌘⌫")).toBeInTheDocument();
  });

  it("切到排除规则分区：规则列表与计数", () => {
    render(<SettingsShell {...makeProps()} />);
    fireEvent.click(screen.getByText("排除规则"));
    expect(screen.getByText("共 1 条")).toBeInTheDocument();
    expect(screen.getByText("启用中 1 条")).toBeInTheDocument();
    expect(screen.getByText("com.apple.KeychainAccess")).toBeInTheDocument();
    expect(screen.getByText("新增规则")).toBeInTheDocument();
  });

  it("切到高级分区：存储信息 + 诊断 danger 按钮", () => {
    render(<SettingsShell {...makeProps()} />);
    fireEvent.click(screen.getByText("高级"));
    // 存储信息卡
    expect(screen.getByText("存储信息")).toBeInTheDocument();
    expect(screen.getByText("~/Library/Application Support/com.superclip/")).toBeInTheDocument();
    // 诊断
    expect(screen.getByText("导出诊断")).toBeInTheDocument();
  });

  it("诊断导出按钮触发 onDiagnosticsClick", () => {
    const onDiagnosticsClick = vi.fn();
    render(<SettingsShell {...makeProps({ onDiagnosticsClick })} />);
    fireEvent.click(screen.getByText("高级"));
    fireEvent.click(screen.getAllByText("导出诊断")[0]);
    expect(onDiagnosticsClick).toHaveBeenCalled();
  });

  it("主题切换调用 onUpdate(themeMode)", () => {
    const onUpdate = vi.fn(async () => {
      /* no-op */
    });
    render(<SettingsShell {...makeProps({ onUpdate })} />);
    fireEvent.click(screen.getByText("深色"));
    expect(onUpdate).toHaveBeenCalledWith({ themeMode: "dark" });
  });

  it("返回列表按钮触发 onClose", () => {
    const onClose = vi.fn();
    render(<SettingsShell {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText("返回列表"));
    expect(onClose).toHaveBeenCalled();
  });

  it("只读模式下禁用修改类控件", () => {
    render(<SettingsShell {...makeProps({ readOnlyMode: true })} />);
    expect(screen.getByText("只读模式：修改类操作已禁用。")).toBeInTheDocument();
    const themeDark = screen.getByText("深色").closest("button");
    expect(themeDark).toBeDisabled();
  });
});
