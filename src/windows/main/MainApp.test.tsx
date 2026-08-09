import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { MainApp } from "./MainApp";
import * as superclip from "../../lib/superclip";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe("MainApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.clear();
    } catch {
      Object.defineProperty(window, "localStorage", {
        value: { getItem: () => null, setItem: () => {}, clear: () => {}, removeItem: () => {} },
        writable: true,
      });
    }
  });

  it("renders top bar without brand title text", () => {
    render(<MainApp />);
    // 品牌文字已移除，搜索框左拉占满；logo 图标保留（aria-label 兜底标识）
    expect(screen.queryByText("剪贴板")).not.toBeInTheDocument();
    expect(screen.getByLabelText("SuperClip")).toBeInTheDocument();
  });

  it("renders all filter chip labels", () => {
    render(<MainApp />);
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("文本")).toBeInTheDocument();
    expect(screen.getByText("图片")).toBeInTheDocument();
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.getAllByText("已置顶").length).toBeGreaterThan(0);
  });

  it("switches active chip on click", () => {
    render(<MainApp />);
    fireEvent.click(screen.getByText("图片"));
    const imageTab = screen.getByText("图片");
    expect(imageTab.style.color).toBe("var(--selection-accent)");
  });

  it("starts in list view by default", () => {
    render(<MainApp />);
    expect(screen.getByTestId("main-list-view")).toBeInTheDocument();
  });

  it("toggles view mode on Cmd+L", () => {
    render(<MainApp />);
    fireEvent.keyDown(window, { key: "l", metaKey: true });
    expect(screen.queryByTestId("main-list-view")).not.toBeInTheDocument();
    expect(screen.getByTestId("main-grid-view")).toBeInTheDocument();
  });

  it("renders view toggle and settings buttons", () => {
    render(<MainApp />);
    expect(screen.getByTitle("列表视图")).toBeInTheDocument();
    expect(screen.getByTitle("网格视图")).toBeInTheDocument();
    expect(screen.getByTitle("设置")).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    render(<MainApp />);
    expect(screen.getByText("剪贴板暂无记录")).toBeInTheDocument();
  });

  it("ignores global shortcuts while typing in the search input", () => {
    render(<MainApp />);
    // start in list view
    expect(screen.getByTestId("main-list-view")).toBeInTheDocument();
    // focus the search input
    const search = screen.getByPlaceholderText("搜索剪贴板...");
    search.focus();
    // Cmd+L should NOT toggle view while typing
    fireEvent.keyDown(search, { key: "l", metaKey: true });
    expect(screen.getByTestId("main-list-view")).toBeInTheDocument();
    expect(screen.queryByTestId("main-grid-view")).not.toBeInTheDocument();
  });

  it("hides MainTopBar and shows SettingsShell header when settings open", () => {
    render(<MainApp />);
    expect(screen.getByPlaceholderText("搜索剪贴板...")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("设置"));
    // MainTopBar hidden: no dominant search input
    expect(screen.queryByPlaceholderText("搜索剪贴板...")).not.toBeInTheDocument();
    // SettingsShell header present
    expect(screen.getByText("返回列表")).toBeInTheDocument();
  });

  it("row click selects item into batch set (checkbox + highlight coupling)", async () => {
    render(<MainApp />);
    // fallback 数据异步加载出历史行
    const row = await screen.findByText("发布命令片段");
    fireEvent.click(row);
    // 单击行 → 计入批量集合：批量操作栏从底部滑入可见
    const bar = screen.getByTestId("main-bulk-action-bar");
    expect(bar.getAttribute("aria-hidden")).toBe("false");
    expect(bar.textContent).toContain("已选 1 项");
    // 勾选框出现（行被选中）
    expect(bar.textContent).toContain("全选可见");
    // 行呈现浅蓝选中底（selectedId 联动）
    const rowEl = screen.getByText("发布命令片段").closest("[data-clipboard-row-id]");
    expect(rowEl).not.toBeNull();
  });

  it("wraps window in frosted square chrome", () => {
    const { container } = render(<MainApp />);
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main!.className).toContain("rounded-none");
    expect(main!.className).toContain("frost-window");
  });

  it("renders status banner slot styling for permission banner", async () => {
    // 启用 Tauri 运行时，让 bootstrap 走 invoke 路径（fallback 默认 trusted=true）
    (window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};
    const { invoke } = await import("@tauri-apps/api/core");
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
      if (cmd === "clipboard_search") return { query: "", normalizedQuery: "", results: [], total: 0, searchTimeMs: 2, version: 1 };
      if (cmd === "permission_check_accessibility") return { accessibilityTrusted: false, checkedAt: "2026-04-25T19:40:00+08:00" };
      if (cmd === "settings_get") return { schemaVersion: 1, exposedKeys: [], reservedKeys: [], defaultAction: "direct_paste", themeMode: "system", historyLimit: 1000, launchAtLogin: false, showOnStartup: false };
      if (cmd === "rules_list") return { rules: [] };
      if (cmd === "shortcut_get") return { binding: "Cmd+Shift+V", isRegistered: true, source: "default", version: 1 };
      if (cmd === "runtime_state_get") return { isRecoveryMode: false, migrationPhase: "idle", presentationReason: "manual_open", lastDisplayId: "main", lastWindowMode: "small_window", fallbackReason: null, restoredFromSession: false, updatedAt: "2026-04-25T20:10:00+08:00" };
      return {};
    });
    render(<MainApp />);
    expect(await screen.findByText(/仅复制模式/)).toBeInTheDocument();
    expect(screen.getByText(/仅复制模式/).closest("div")?.parentElement?.className).toContain("mx-4");
  });

  it("signals main window readiness after bootstrap completes", async () => {
    const mainWindowReadySpy = vi.spyOn(superclip, "mainWindowReady").mockResolvedValue();
    render(<MainApp />);
    // bootstrap 在 microtask 中完成（fallback 数据），双 rAF 后触发就绪信号；
    // waitFor 轮询等待 rAF 触发（act 退出时机不保证 rAF 已执行）
    await waitFor(() => expect(mainWindowReadySpy).toHaveBeenCalled());
    mainWindowReadySpy.mockRestore();
  });

  describe("theme following", () => {
    beforeEach(() => {
      delete document.documentElement.dataset.themeMode;
      delete (window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__;
    });

    it("writes concrete data-theme-mode derived from system appearance (dark)", async () => {
      // fallback settings 返回 themeMode: "system"; jsdom matchMedia 对 prefers-color-scheme 返回 matches=true
      render(<MainApp />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(document.documentElement.dataset.themeMode).toBe("dark");
    });
  });
});
