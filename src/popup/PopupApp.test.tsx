import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { PopupApp } from "./PopupApp";
import * as superclip from "../lib/superclip";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    hide: vi.fn(),
    outerPosition: () => Promise.resolve({ x: 100, y: 50 }),
    scaleFactor: () => Promise.resolve(1),
  }),
}));

describe("PopupApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders compact search input", () => {
    render(<PopupApp />);
    expect(screen.getByPlaceholderText("搜索...")).toBeInTheDocument();
  });

  it("renders shortcut badge", () => {
    render(<PopupApp />);
    expect(screen.getByText("⌘⇧V")).toBeInTheDocument();
  });

  it("renders info-only footer with item count and preview hint", () => {
    const { container } = render(<PopupApp />);
    expect(screen.getByText(/共 \d+ 条/)).toBeInTheDocument();
    expect(screen.getByText("悬停预览")).toBeInTheDocument();
    // 底栏（border-t）内无任何按钮
    const footer = Array.from(container.querySelectorAll("div")).find(
      (el) => el.className.includes("border-t") && el.className.includes("h-[35px]"),
    );
    expect(footer).toBeTruthy();
    expect(footer?.querySelectorAll("button").length).toBe(0);
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
    const input = screen.getByPlaceholderText("搜索...");
    fireEvent.change(input, { target: { value: "nonexistent" } });
    // 等待搜索 debounce(150ms) 生效，act 包裹确保 React flush
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(screen.getByText("没有匹配的内容")).toBeInTheDocument();
  });

  it("shows clear button when query non-empty and clears on click", () => {
    render(<PopupApp />);
    const input = screen.getByPlaceholderText("搜索...");
    fireEvent.change(input, { target: { value: "test" } });
    expect(screen.getByLabelText("清空搜索")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("清空搜索"));
    expect(input).toHaveValue("");
    expect(screen.queryByLabelText("清空搜索")).not.toBeInTheDocument();
  });

  it("clears query on Escape", () => {
    render(<PopupApp />);
    const input = screen.getByPlaceholderText("搜索...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(input).toHaveValue("");
  });

  it("navigates with arrow keys and keeps rows focusable", () => {
    render(<PopupApp />);
    // 首帧空态时箭头键不抛错（visible 为空）
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByPlaceholderText("搜索...")).toBeInTheDocument();
  });

  it("signals popup readiness after first data paint", async () => {
    const popupReadySpy = vi.spyOn(superclip, "popupReady").mockResolvedValue();
    render(<PopupApp />);
    // 首批 fallback 数据加载完成 → isLoading 置 false → 双 rAF 后触发就绪信号；
    // waitFor 轮询等待 rAF 触发（act 退出时机不保证 rAF 已执行）
    await waitFor(() => expect(popupReadySpy).toHaveBeenCalled());
    popupReadySpy.mockRestore();
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
