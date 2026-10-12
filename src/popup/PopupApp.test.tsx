import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { PopupApp, buildLayout, OVERSCAN_ROWS } from "./PopupApp";
import type { ClipboardItem } from "../components/history-row";
import * as superclip from "../lib/superclip";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

const windowMock = vi.hoisted(() => ({ hide: vi.fn() }));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    hide: windowMock.hide,
    outerPosition: () => Promise.resolve({ x: 100, y: 50 }),
    scaleFactor: () => Promise.resolve(1),
  }),
}));

describe("PopupApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // fallback 仓储是模块级状态，删除/置顶会跨用例残留；每个用例前重置
    superclip.__resetSuperClipFallbackForTests();
  });

  it("renders compact search input", () => {
    render(<PopupApp />);
    expect(screen.getByPlaceholderText("搜索剪贴板…")).toBeInTheDocument();
  });

  it("renders shortcut badge", () => {
    render(<PopupApp />);
    expect(screen.getByText("⌘⇧V")).toBeInTheDocument();
  });

  it("renders keyboard hint footer with item count", () => {
    const { container } = render(<PopupApp />);
    expect(screen.getByText(/共 \d+ 条/)).toBeInTheDocument();
    // 底部提示条（h-32）含 ↑↓ / ↵ / ⌘⌫ 三条键位提示，且不是可复用的按钮区
    const footer = Array.from(container.querySelectorAll("div")).find(
      (el) => el.className.includes("h-[32px]") && el.className.includes("border-t"),
    );
    expect(footer).toBeTruthy();
    expect(footer?.textContent).toContain("选择");
    expect(footer?.textContent).toContain("粘贴");
    expect(footer?.textContent).toContain("删除");
  });

  it("does not render legacy bottom-bar action buttons", () => {
    const { container } = render(<PopupApp />);
    expect(container.querySelector(".lucide-home")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-settings-2")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-pause")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-pin")).not.toBeInTheDocument();
  });

  it("shows empty-state text on first render before data loads", () => {
    render(<PopupApp />);
    expect(screen.getByText("剪贴板暂无记录")).toBeInTheDocument();
  });

  it("shows empty-state icon alongside empty text", () => {
    const { container } = render(<PopupApp />);
    expect(container.querySelector(".lucide-file-text")).toBeInTheDocument();
  });

  it("shows no-match empty state when query has no results", async () => {
    render(<PopupApp />);
    const input = screen.getByPlaceholderText("搜索剪贴板…");
    fireEvent.change(input, { target: { value: "nonexistent" } });
    // 等待搜索 debounce(150ms) 生效，act 包裹确保 React flush
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(screen.getByText("没有匹配的内容")).toBeInTheDocument();
  });

  it("shows clear button when query non-empty and clears on click", () => {
    render(<PopupApp />);
    const input = screen.getByPlaceholderText("搜索剪贴板…");
    fireEvent.change(input, { target: { value: "test" } });
    expect(screen.getByLabelText("清空搜索")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("清空搜索"));
    expect(input).toHaveValue("");
    expect(screen.queryByLabelText("清空搜索")).not.toBeInTheDocument();
  });

  it("clears query on Escape", () => {
    render(<PopupApp />);
    const input = screen.getByPlaceholderText("搜索剪贴板…");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(input).toHaveValue("");
  });

  it("navigates with arrow keys and keeps rows focusable", () => {
    render(<PopupApp />);
    // 首帧空态时箭头键不抛错（visible 为空）
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByPlaceholderText("搜索剪贴板…")).toBeInTheDocument();
  });

  it("signals popup readiness after first data paint", async () => {
    const popupReadySpy = vi.spyOn(superclip, "popupReady").mockResolvedValue();
    render(<PopupApp />);
    // 首批 fallback 数据加载完成 → isLoading 置 false → 双 rAF 后触发就绪信号；
    // waitFor 轮询等待 rAF 触发（act 退出时机不保证 rAF 已执行）
    await waitFor(() => expect(popupReadySpy).toHaveBeenCalled());
    popupReadySpy.mockRestore();
  });

  it("applies list font size to CSS variable and derives row height", async () => {
    const base = await superclip.settingsGet();
    const settingsGetSpy = vi
      .spyOn(superclip, "settingsGet")
      .mockResolvedValue({ ...base, listFontSize: 15 });

    const { container } = render(<PopupApp />);
    await act(async () => {
      await Promise.resolve();
    });

    // 15px → CSS 变量同步 + 行高联动 46 + (15-13)*2 = 50
    expect(document.documentElement.style.getPropertyValue("--list-font-size")).toBe("15px");
    const row = container.querySelector("[data-clipboard-row-id]")?.parentElement;
    expect(row).toHaveStyle({ height: "50px" });

    settingsGetSpy.mockRestore();
  });

  describe("时间分组与行操作", () => {
    it("renders 已置顶/今天 group headers without duplicate 更早 headers", async () => {
      render(<PopupApp />);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      // fallback 有置顶项 → 单独成「已置顶」组且只出现一次
      expect(screen.getAllByText("已置顶")).toHaveLength(1);
      expect(screen.getAllByText("今天")).toHaveLength(1);
      expect(screen.queryAllByText("更早").length).toBeLessThanOrEqual(1);
    });

    it("键盘导航越过渲染窗口后选中行仍可被绝对偏移表定位（虚拟滚动跟随）", () => {
      // 回归：定位曾改用渲染窗口子集查询，↓ 越过 overscan 范围就找不到行，列表不再跟随；
      // 修复后 buildLayout 返回全量绝对偏移表 rowsByld（与 HEAD 的绝对下标定位等价）。
      // jsdom 没有 layout（clientHeight/scrollTop 恒 0，赋值不触发 scroll 事件），
      // 无法驱动真实滚动，故直接对定位依据做单元断言：
      const items = Array.from({ length: 120 }, (_, index) => ({
        id: `clip-${index}`,
        kind: "text",
        title: `条目 ${index}`,
        preview: `预览 ${index}`,
        sourceApp: "Test",
        meta: "",
        timeLabel: "刚刚",
        isPinned: false,
      })) as ClipboardItem[];
      const rowHeight = 46;
      const layout = buildLayout(items, rowHeight, 0, 800);
      // 全量偏移表覆盖窗口外条目
      expect(layout.rowsByld.get("clip-40")).toBeDefined();
      // 组头 24px + 40 行 × 46px（全部「刚刚」单组，无置顶）
      expect(layout.rowsByld.get("clip-40")).toBe(24 + 40 * rowHeight);
      expect(layout.totalHeight).toBe(24 + 120 * rowHeight);
      // 渲染窗口仍只含可视范围（偏移 ≤ maxTop = scrollTop + viewport + overscan）
      const maxRendered = Math.max(...layout.rows.map((row) => row.top));
      expect(maxRendered).toBeLessThan(0 + 800 + OVERSCAN_ROWS * rowHeight + rowHeight);
    });

    it("删除选中行后弹出可撤销 Toast，撤销调用 clipboardRestore", async () => {
      const deleteSpy = vi
        .spyOn(superclip, "clipboardDelete")
        .mockResolvedValue({ itemId: "clip-1", undoToken: "undo-x", expiresAt: "30d", version: 1 });
      const restoreSpy = vi
        .spyOn(superclip, "clipboardRestore")
        .mockResolvedValue({ item: (await superclip.clipboardList())[0], version: 1 });

      const { container } = render(<PopupApp />);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      const row = container.querySelector("[data-clipboard-row-id]")!;
      fireEvent.mouseEnter(row);
      fireEvent.click(screen.getAllByLabelText("删除")[0]);

      await waitFor(() => expect(deleteSpy).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId("superclip-toast")).toBeInTheDocument());
      expect(screen.getByTestId("superclip-toast")).toHaveAttribute("data-tone", "undo");

      fireEvent.click(screen.getByText("撤销"));
      await waitFor(() => expect(restoreSpy).toHaveBeenCalledWith("undo-x"));

      deleteSpy.mockRestore();
      restoreSpy.mockRestore();
    });

    it("⌘⌫ 删除当前选中项", async () => {
      const deleteSpy = vi
        .spyOn(superclip, "clipboardDelete")
        .mockResolvedValue({ itemId: "clip-1", undoToken: "undo-y", expiresAt: "30d", version: 1 });

      render(<PopupApp />);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      fireEvent.keyDown(window, { key: "Backspace", metaKey: true });
      await waitFor(() => expect(deleteSpy).toHaveBeenCalled());

      deleteSpy.mockRestore();
    });

    it("⌘P 置顶当前选中项", async () => {
      const pinSpy = vi.spyOn(superclip, "clipboardUnpin");
      render(<PopupApp />);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      // 首项 fallback 数据 isPinned=true，因此 ⌘P 应走取消置顶
      fireEvent.keyDown(window, { key: "p", metaKey: true });
      await waitFor(() => expect(pinSpy).toHaveBeenCalled());
      pinSpy.mockRestore();
    });

    it("右键菜单提供「粘贴为纯文本」并调用 asPlainText 通道", async () => {
      const pasteSpy = vi.spyOn(superclip, "clipboardPaste").mockResolvedValue({
        itemId: "clip-1",
        status: "completed",
        mode: "direct_paste",
        message: "ok",
        fallbackUsed: false,
        degraded: false,
        errorCode: null,
      });

      const { container } = render(<PopupApp />);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      fireEvent.contextMenu(container.querySelector("[data-clipboard-row-id]")!);
      expect(screen.getByTestId("popup-context-menu")).toBeInTheDocument();

      fireEvent.click(screen.getByText("粘贴为纯文本"));
      await waitFor(() => expect(pasteSpy).toHaveBeenCalledWith("clip-1", true));
      // 菜单选完即关闭
      expect(screen.queryByTestId("popup-context-menu")).not.toBeInTheDocument();

      pasteSpy.mockRestore();
    });

    it("other 类型固定走复制通道：不调 paste，行内提示后才关闭", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const otherItem: ClipboardItem = {
          id: "clip-other",
          kind: "other",
          title: "PDF",
          preview: "其他 · 1 种格式",
          sourceApp: "Preview",
          meta: "",
          timeLabel: "刚刚",
          isPinned: false,
        };
        const searchSpy = vi.spyOn(superclip, "clipboardSearch").mockResolvedValue({
          query: "",
          normalizedQuery: "",
          results: [otherItem],
          total: 1,
          searchTimeMs: 0,
          version: 1,
        });
        const copySpy = vi.spyOn(superclip, "clipboardCopy").mockResolvedValue({
          itemId: "clip-other",
          status: "completed",
          mode: "copy_only",
          message: "已复制（该类型仅支持复制）。",
          fallbackUsed: false,
          degraded: false,
          errorCode: "COPY_ONLY_TYPE",
        });
        const pasteSpy = vi.spyOn(superclip, "clipboardPaste");

        render(<PopupApp />);
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 60));
        });

        // hidePopup 仅在 Tauri 运行时才调 window.hide；数据已加载完再打开开关，
        // 避免影响 superclip 的 fallback 数据通道
        Object.defineProperty(window, "__TAURI_INTERNALS__", {
          value: {},
          writable: true,
          configurable: true,
        });

        try {
          fireEvent.click(screen.getByText("PDF"));
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
          });

          expect(copySpy).toHaveBeenCalledWith("clip-other");
          expect(pasteSpy).not.toHaveBeenCalled();
          expect(screen.getByText("已复制（该类型仅支持复制）。")).toBeInTheDocument();
          // D-13：后端已跳过 hide_popup_window，前端也要等提示展示完再关
          expect(windowMock.hide).not.toHaveBeenCalled();

          act(() => {
            vi.advanceTimersByTime(1600);
          });
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
          });
          expect(windowMock.hide).toHaveBeenCalled();
        } finally {
          delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
        }

        copySpy.mockRestore();
        pasteSpy.mockRestore();
        searchSpy.mockRestore();
      } finally {
        vi.useRealTimers();
      }
    });

    it("⌥↵ 触发纯文本粘贴", async () => {
      const pasteSpy = vi.spyOn(superclip, "clipboardPaste").mockResolvedValue({
        itemId: "clip-1",
        status: "completed",
        mode: "direct_paste",
        message: "ok",
        fallbackUsed: false,
        degraded: false,
        errorCode: null,
      });

      render(<PopupApp />);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      fireEvent.keyDown(window, { key: "Enter", altKey: true });
      await waitFor(() => expect(pasteSpy).toHaveBeenCalledWith("clip-1", true));

      pasteSpy.mockRestore();
    });

    it("↵ 遵守 default_action=copy_only：走复制而不是直接粘贴", async () => {
      // 回归：keydown 监听器只挂载一次，settings 必须经 ref 读取；
      // 若直接用闭包里的 settings，首帧 null 会让 ↵ 固定走 direct_paste
      const pasteSpy = vi.spyOn(superclip, "clipboardPaste").mockResolvedValue({
        itemId: "clip-1",
        status: "completed",
        mode: "direct_paste",
        message: "ok",
        fallbackUsed: false,
        degraded: false,
        errorCode: null,
      });
      const copySpy = vi.spyOn(superclip, "clipboardCopy").mockResolvedValue({
        itemId: "clip-1",
        status: "completed",
        mode: "copy_only",
        message: "ok",
        fallbackUsed: false,
        degraded: false,
        errorCode: null,
      });
      const base = await superclip.settingsGet();
      const settingsSpy = vi
        .spyOn(superclip, "settingsGet")
        .mockResolvedValue({ ...base, defaultAction: "copy_only" });

      render(<PopupApp />);
      await waitFor(() => expect(document.querySelector("[data-clipboard-row-id]")).toBeTruthy());

      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "Enter" });
      await waitFor(() => expect(copySpy).toHaveBeenCalled());
      expect(pasteSpy).not.toHaveBeenCalled();

      pasteSpy.mockRestore();
      copySpy.mockRestore();
      settingsSpy.mockRestore();
    });
  });

  describe("theme following", () => {
    beforeEach(() => {
      delete document.documentElement.dataset.themeMode;
    });

    it("writes concrete data-theme-mode derived from system appearance (dark)", async () => {
      // jsdom setup 的 matchMedia 对 prefers-color-scheme: dark 返回 matches=true
      render(<PopupApp />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(document.documentElement.dataset.themeMode).toBe("dark");
    });

    it("derives light data-theme-mode when matchMedia reports light", async () => {
      const matchMedia = window.matchMedia as unknown as ReturnType<typeof vi.fn>;
      matchMedia.mockReturnValueOnce({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });
      render(<PopupApp />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(document.documentElement.dataset.themeMode).toBe("light");
    });
  });
});
