import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
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
    // fallback 仓储是模块级状态：删除/清空会跨用例残留，每个用例前重置
    superclip.__resetSuperClipFallbackForTests();
    // Tauri 运行时标记同样是跨用例残留：个别用例会打开它走 invoke 路径，
    // 不复位会让后续用例的 IPC 命中 mock invoke（返回空对象）而非 fallback
    delete (window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__;
    try {
      localStorage.clear();
    } catch {
      Object.defineProperty(window, "localStorage", {
        value: { getItem: () => null, setItem: () => {}, clear: () => {}, removeItem: () => {} },
        writable: true,
      });
    }
  });

  it("renders 192 sidebar with brand and 5 navigation entries", () => {
    render(<MainApp />);
    const sidebar = screen.getByTestId("main-sidebar");
    expect(sidebar.className).toContain("w-[192px]");
    expect(screen.getByText("SuperClip")).toBeInTheDocument();
    expect(screen.getAllByText("全部记录").length).toBeGreaterThan(0);
    expect(screen.getAllByText("已置顶").length).toBeGreaterThan(0);
    expect(screen.getAllByText("回收站").length).toBeGreaterThan(0);
    expect(screen.getAllByText("排除规则").length).toBeGreaterThan(0);
    expect(screen.getAllByText("设置").length).toBeGreaterThan(0);
  });

  it("renders the sidebar monitoring status card", () => {
    render(<MainApp />);
    const status = screen.getByTestId("main-sidebar-status");
    expect(status.textContent).toContain("监听中");
    expect(status.textContent).toContain("直接粘贴");
  });

  it("renders all filter chip labels", () => {
    render(<MainApp />);
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("文本")).toBeInTheDocument();
    expect(screen.getByText("图片")).toBeInTheDocument();
    expect(screen.getByText("文件")).toBeInTheDocument();
  });

  it("switches active chip on click", () => {
    render(<MainApp />);
    fireEvent.click(screen.getByText("图片"));
    const imageTab = screen.getByText("图片");
    expect(imageTab.style.color).toBe("var(--accent-text)");
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

  it("renders view toggle buttons in the content header", () => {
    render(<MainApp />);
    expect(screen.getByTitle("列表视图")).toBeInTheDocument();
    expect(screen.getByTitle("网格视图")).toBeInTheDocument();
  });

  it("设置入口移到左侧栏导航项", () => {
    render(<MainApp />);
    const sidebar = screen.getByTestId("main-sidebar");
    expect(sidebar.textContent).toContain("设置");
    expect(screen.queryByTitle("设置")).not.toBeInTheDocument();
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
    const search = screen.getByPlaceholderText("搜索…");
    search.focus();
    // Cmd+L should NOT toggle view while typing
    fireEvent.keyDown(search, { key: "l", metaKey: true });
    expect(screen.getByTestId("main-list-view")).toBeInTheDocument();
    expect(screen.queryByTestId("main-grid-view")).not.toBeInTheDocument();
  });

  it("switches to the settings section from the sidebar", () => {
    render(<MainApp />);
    expect(screen.getByPlaceholderText("搜索…")).toBeInTheDocument();
    fireEvent.click(screen.getByText("设置"));
    // 内容区切到设置：搜索框消失，设置分区标题出现
    expect(screen.queryByPlaceholderText("搜索…")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "通用" })).toBeInTheDocument();
  });

  it("switches to the trash section from the sidebar", async () => {
    render(<MainApp />);
    fireEvent.click(screen.getByText("回收站"));
    expect(await screen.findByTestId("main-trash-view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "回收站" })).toBeInTheDocument();
  });

  it("侧栏「已置顶」切换标题与列表内容（不再是死导航）", async () => {
    render(<MainApp />);
    await screen.findByText("客户邮件摘要");
    const sidebar = screen.getByTestId("main-sidebar");
    fireEvent.click(within(sidebar).getByText("已置顶"));
    // 标题联动
    expect(screen.getByRole("heading", { name: "已置顶" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "全部记录" })).not.toBeInTheDocument();
    // 列表只剩置顶项：未置顶的 fallback 条目被过滤
    expect(screen.queryByText("客户邮件摘要")).not.toBeInTheDocument();
    expect(screen.getByText("发布命令片段")).toBeInTheDocument();
  });

  it("侧栏「排除规则」直接落到设置的排除规则分区", async () => {
    render(<MainApp />);
    const sidebar = screen.getByTestId("main-sidebar");
    fireEvent.click(within(sidebar).getByText("排除规则"));
    // 不点设置分区按钮，直接渲染出排除规则内容
    expect(await screen.findByRole("heading", { name: "排除规则" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /添加规则/ })).toBeInTheDocument();
  });

  it("设置 ↔ 排除规则互切时分区跟随侧栏（initialSection 变化需重挂载）", async () => {
    render(<MainApp />);
    const sidebar = screen.getByTestId("main-sidebar");
    // 先进设置（general）
    fireEvent.click(within(sidebar).getByText("设置"));
    expect(await screen.findByRole("heading", { name: "通用" })).toBeInTheDocument();
    // 再点「排除规则」→ 分区必须跟着切（修复前 SettingsShell 复用实例，停在「通用」）
    fireEvent.click(within(sidebar).getByText("排除规则"));
    expect(await screen.findByRole("heading", { name: "排除规则" })).toBeInTheDocument();
    // 再点回「设置」→ 应回到「通用」而不是残留「排除规则」
    fireEvent.click(within(sidebar).getByText("设置"));
    expect(await screen.findByRole("heading", { name: "通用" })).toBeInTheDocument();
  });

  it("已置顶视图不渲染类型 chips（chips 计数基于全量，避免误导）", async () => {
    render(<MainApp />);
    await screen.findByText("客户邮件摘要");
    const sidebar = screen.getByTestId("main-sidebar");
    fireEvent.click(within(sidebar).getByText("已置顶"));
    expect(screen.getByRole("heading", { name: "已置顶" })).toBeInTheDocument();
    // chips 只在全部记录视图渲染（R3-3：全量计数与置顶列表不符）
    expect(screen.queryByRole("button", { name: /^文本/ })).not.toBeInTheDocument();

    // ⌘1 仍能从已置顶退回全部记录（键盘路径与侧栏一致）
    fireEvent.keyDown(window, { key: "1", metaKey: true });
    expect(screen.getByRole("heading", { name: "全部记录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^文本/ })).toBeInTheDocument();
  });

  it("回收站视图下 Delete 不误删主列表条目", async () => {
    render(<MainApp />);
    await screen.findByText("发布命令片段");
    const sidebar = screen.getByTestId("main-sidebar");
    fireEvent.click(within(sidebar).getByText("回收站"));
    await screen.findByTestId("main-trash-view");

    const deleteSpy = vi.spyOn(superclip, "clipboardDelete");
    fireEvent.keyDown(window, { key: "Delete" });
    expect(deleteSpy).not.toHaveBeenCalled();
    deleteSpy.mockRestore();
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
    expect(screen.getByText(/仅复制模式/).closest("div")?.parentElement?.className).toContain("mx-5");
  });

  it("signals main window readiness after bootstrap completes", async () => {
    const mainWindowReadySpy = vi.spyOn(superclip, "mainWindowReady").mockResolvedValue();
    render(<MainApp />);
    // bootstrap 在 microtask 中完成（fallback 数据），双 rAF 后触发就绪信号；
    // waitFor 轮询等待 rAF 触发（act 退出时机不保证 rAF 已执行）
    await waitFor(() => expect(mainWindowReadySpy).toHaveBeenCalled());
    mainWindowReadySpy.mockRestore();
  });

  describe("回收站与危险操作", () => {
    it("回收站空态文案与说明卡", async () => {
      render(<MainApp />);
      fireEvent.click(screen.getByText("回收站"));
      // 等回收站数据加载完成（说明卡与空态同批渲染）
      await screen.findByTestId("trash-retention-note");
      expect(screen.getByText("回收站为空")).toBeInTheDocument();
      expect(screen.getByTestId("trash-retention-note").textContent).toContain("保留 30 天");
    });

    it("删除单条后弹出可撤销 Toast，撤销调用 clipboardRestore", async () => {
      const deleteSpy = vi
        .spyOn(superclip, "clipboardDelete")
        .mockResolvedValue({ itemId: "clip-1", undoToken: "undo-z", expiresAt: "30d", version: 1 });
      const restoreSpy = vi.spyOn(superclip, "clipboardRestore");

      render(<MainApp />);
      // 首行默认被选中（选中行不显示 hover 操作）；用第二行触发删除
      const row = (await screen.findByText("客户邮件摘要")).closest("[data-clipboard-row-id]")!;
      fireEvent.mouseEnter(row);
      fireEvent.click(screen.getAllByTitle("删除")[0]);

      await waitFor(() => expect(deleteSpy).toHaveBeenCalled());
      const toast = await screen.findByTestId("superclip-toast");
      expect(toast).toHaveAttribute("data-tone", "undo");

      fireEvent.click(screen.getByText("撤销"));
      await waitFor(() => expect(restoreSpy).toHaveBeenCalledWith("undo-z"));

      deleteSpy.mockRestore();
      restoreSpy.mockRestore();
    });

    it("清空历史与重置设置都走二次确认弹窗，取消不执行", async () => {
      const clearSpy = vi.spyOn(superclip, "clipboardClear");
      const resetSpy = vi.spyOn(superclip, "settingsReset");

      render(<MainApp />);
      fireEvent.click(screen.getByText("设置"));
      fireEvent.click(screen.getByText("高级"));

      fireEvent.click(screen.getByText("清空历史"));
      expect(await screen.findByTestId("main-confirm-dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByText("取消"));
      expect(screen.queryByTestId("main-confirm-dialog")).not.toBeInTheDocument();
      expect(clearSpy).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText("重置设置"));
      const dialog = await screen.findByTestId("main-confirm-dialog");
      expect(dialog.textContent).toContain("重置所有设置？");
      // 弹窗内的确认按钮（行标签与弹窗按钮同名，用 within 限定在弹窗内）
      const confirmBtn = within(dialog).getByText("重置设置", { selector: "button" });
      fireEvent.click(confirmBtn);
      await waitFor(() => expect(resetSpy).toHaveBeenCalled());

      clearSpy.mockRestore();
      resetSpy.mockRestore();
    });

    it("清空历史确认后调用 clipboardClear 并提示条数", async () => {
      const clearSpy = vi
        .spyOn(superclip, "clipboardClear")
        .mockResolvedValue({ clearedCount: 12, version: 1 });

      render(<MainApp />);
      fireEvent.click(screen.getByText("设置"));
      fireEvent.click(screen.getByText("高级"));
      fireEvent.click(screen.getByText("清空历史"));
      await screen.findByTestId("main-confirm-dialog");
      const dialog = screen.getByTestId("main-confirm-dialog");
      fireEvent.click(within(dialog).getByText("清空历史", { selector: "button" }));

      await waitFor(() => expect(clearSpy).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.getByTestId("superclip-toast").textContent).toContain("已清空 12 条记录"),
      );
      clearSpy.mockRestore();
    });
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
