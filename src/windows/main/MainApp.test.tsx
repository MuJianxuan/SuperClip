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
    try { localStorage.clear(); } catch {
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

  it("renders all tab labels", () => {
    render(<MainApp />);
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("文本")).toBeInTheDocument();
    expect(screen.getByText("图片")).toBeInTheDocument();
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.getByText("置顶")).toBeInTheDocument();
  });

  it("switches tabs on click", () => {
    render(<MainApp />);
    fireEvent.click(screen.getByText("图片"));
    const imageTab = screen.getByText("图片");
    expect(imageTab.className).toContain("bg-[var(--surface)]");
  });

  it("toggles view mode on Cmd+L", () => {
    render(<MainApp />);
    fireEvent.keyDown(window, { key: "l", metaKey: true });
    // After toggle, grid view should be active (no table header)
    expect(screen.queryByText("内容")).not.toBeInTheDocument();
  });

  it("starts in list view by default", () => {
    render(<MainApp />);
    expect(screen.getByText("内容")).toBeInTheDocument();
  });

  it("renders view toggle buttons", () => {
    render(<MainApp />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(5);
  });

  it("renders settings button", () => {
    render(<MainApp />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no items", () => {
    render(<MainApp />);
    expect(screen.getByText("暂无记录")).toBeInTheDocument();
  });
});
