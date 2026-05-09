import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PopupApp } from "./PopupApp";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ hide: vi.fn() }),
}));

describe("PopupApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input", () => {
    render(<PopupApp />);
    const input = screen.getByPlaceholderText("搜索剪贴板...");
    expect(input).toBeInTheDocument();
  });

  it("renders shortcut badge", () => {
    render(<PopupApp />);
    expect(screen.getByText("Cmd+Shift+V")).toBeInTheDocument();
  });

  it("renders bottom bar with pinned count", () => {
    render(<PopupApp />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows '暂无记录' when no items", () => {
    render(<PopupApp />);
    expect(screen.getByText("暂无记录")).toBeInTheDocument();
  });

  it("shows '没有匹配项' when query has no results", () => {
    render(<PopupApp />);
    const input = screen.getByPlaceholderText("搜索剪贴板...");
    fireEvent.change(input, { target: { value: "nonexistent" } });
    expect(screen.getByText("没有匹配项")).toBeInTheDocument();
  });

  it("clears query on Escape", () => {
    render(<PopupApp />);
    const input = screen.getByPlaceholderText("搜索剪贴板...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(input).toHaveValue("");
  });
});
