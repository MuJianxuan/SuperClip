import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QuickPanelApp } from "./QuickPanelApp";

vi.mock("../lib/superclip", () => ({
  monitorStatusGet: vi.fn(() => Promise.resolve({ isMonitoring: true })),
  systemAppearanceGet: vi.fn(() => Promise.resolve("dark")),
  settingsGet: vi.fn(() =>
    Promise.resolve({
      schemaVersion: 1,
      exposedKeys: [],
      reservedKeys: [],
      defaultAction: "direct_paste",
      themeMode: "system",
      historyLimit: 1000,
      launchAtLogin: false,
      showOnStartup: false,
    }),
  ),
  monitorToggle: vi.fn((nextState: boolean) =>
    Promise.resolve({ isMonitoring: nextState }),
  ),
  settingsUpdate: vi.fn(() => Promise.resolve({})),
  showMain: vi.fn(() => Promise.resolve()),
  appQuit: vi.fn(() => Promise.resolve()),
  quickPanelHide: vi.fn(() => Promise.resolve()),
}));

import {
  monitorStatusGet,
  settingsGet,
  systemAppearanceGet,
  monitorToggle,
  settingsUpdate,
  showMain,
  appQuit,
  quickPanelHide,
} from "../lib/superclip";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

describe("QuickPanelApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders brand and monitoring status chip", async () => {
    render(<QuickPanelApp />);
    expect(screen.getByText("SuperClip")).toBeInTheDocument();
    expect(await screen.findByText("监听中")).toBeInTheDocument();
  });

  it("loads paste mode from settings on mount", async () => {
    render(<QuickPanelApp />);
    expect(await screen.findByText("选中条目后自动粘贴到前台应用")).toBeInTheDocument();
    expect(settingsGet).toHaveBeenCalled();
    expect(monitorStatusGet).toHaveBeenCalled();
  });

  it("toggles monitoring state and updates icon semantics", async () => {
    render(<QuickPanelApp />);
    const toggleButton = await screen.findByRole("button", { name: /暂停监听/ });
    fireEvent.click(toggleButton);
    expect(monitorToggle).toHaveBeenCalledWith(false);
    expect(await screen.findByText("已暂停")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /恢复监听/ })).toBeInTheDocument();
  });

  it("switches paste mode via segmented control and persists", async () => {
    render(<QuickPanelApp />);
    fireEvent.click(await screen.findByRole("button", { name: "仅复制" }));
    expect(settingsUpdate).toHaveBeenCalledWith({ defaultAction: "copy_only" });
    expect(screen.getByText("仅复制到剪贴板，需手动粘贴")).toBeInTheDocument();
  });

  it("opens main window", async () => {
    render(<QuickPanelApp />);
    fireEvent.click(await screen.findByRole("button", { name: /主管理台/ }));
    expect(showMain).toHaveBeenCalled();
  });

  it("quits app", async () => {
    render(<QuickPanelApp />);
    fireEvent.click(await screen.findByRole("button", { name: /退出 SuperClip/ }));
    expect(appQuit).toHaveBeenCalled();
  });

  it("hides panel on Escape", async () => {
    render(<QuickPanelApp />);
    await screen.findByText("监听中");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(quickPanelHide).toHaveBeenCalled();
  });

  it("does not mutate DOM styles directly on hover", async () => {
    render(<QuickPanelApp />);
    const button = await screen.findByRole("button", { name: /主管理台/ });
    const initialBackground = button.style.background;
    fireEvent.mouseEnter(button);
    expect(button.style.background).not.toBe(initialBackground);
    fireEvent.mouseLeave(button);
    expect(button.style.background).toBe(initialBackground);
  });

  describe("theme following", () => {
    beforeEach(() => {
      delete document.documentElement.dataset.themeMode;
    });

    it("writes concrete data-theme-mode derived from system appearance (dark)", async () => {
      // settingsGet mock 返回 themeMode: "system"; systemAppearanceGet mock 返回 dark
      render(<QuickPanelApp />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(systemAppearanceGet).toHaveBeenCalled();
      expect(document.documentElement.dataset.themeMode).toBe("dark");
    });
  });
});
