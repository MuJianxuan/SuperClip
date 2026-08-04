import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainApp } from "./MainApp";

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

  it("renders top bar with app title", () => {
    render(<MainApp />);
    expect(screen.getByText("SuperClip")).toBeInTheDocument();
  });

  it("renders all filter chip labels", () => {
    render(<MainApp />);
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("文本")).toBeInTheDocument();
    expect(screen.getByText("图片")).toBeInTheDocument();
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.getAllByText("置顶").length).toBeGreaterThan(0);
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
});
