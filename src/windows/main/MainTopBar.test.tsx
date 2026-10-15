import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MainTopBar } from "./MainTopBar";

describe("MainTopBar", () => {
  const defaultProps = {
    viewMode: "list" as const,
    query: "",
    onViewModeChange: vi.fn(),
    onQueryChange: vi.fn(),
  };

  it("renders the section title in the content header", () => {
    render(<MainTopBar {...defaultProps} />);
    expect(screen.getByRole("heading", { name: "全部记录" })).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<MainTopBar {...defaultProps} />);
    expect(screen.getByPlaceholderText("搜索…")).toBeInTheDocument();
  });

  it("shows query value in search input", () => {
    render(<MainTopBar {...defaultProps} query="hello" />);
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("shows clear button when query is non-empty", () => {
    render(<MainTopBar {...defaultProps} query="hello" />);
    expect(screen.getByTitle("清空")).toBeInTheDocument();
  });

  it("does not show clear button when query is empty", () => {
    render(<MainTopBar {...defaultProps} />);
    expect(screen.queryByTitle("清空")).not.toBeInTheDocument();
  });

  it("renders view toggle buttons", () => {
    render(<MainTopBar {...defaultProps} />);
    expect(screen.getByTitle("列表视图")).toBeInTheDocument();
    expect(screen.getByTitle("网格视图")).toBeInTheDocument();
  });

  it("设置入口已移到左侧栏，标题栏不再渲染设置按钮", () => {
    render(<MainTopBar {...defaultProps} />);
    expect(screen.queryByTitle("设置")).not.toBeInTheDocument();
  });

  it("标题区可拖窗口，搜索框与视图切换不参与拖拽", () => {
    const { container } = render(<MainTopBar {...defaultProps} />);
    const header = container.querySelector("header");
    const title = screen.getByRole("heading", { name: "全部记录" });
    // tauri 2.10.3 只认鼠标下元素自身的属性：标题容器与标题都要带，否则按在标题上拖不动
    expect(header?.hasAttribute("data-tauri-drag-region")).toBe(true);
    expect(title.hasAttribute("data-tauri-drag-region")).toBe(true);
    expect(title.parentElement?.hasAttribute("data-tauri-drag-region")).toBe(true);
    // 交互元素不能带：否则点击/拖动会被当成拖窗口
    expect(screen.getByPlaceholderText("搜索…").closest("label")?.hasAttribute("data-tauri-drag-region")).toBe(false);
    const viewToggle = screen.getByTitle("列表视图").parentElement;
    expect(viewToggle).not.toBeNull();
    expect(viewToggle?.hasAttribute("data-tauri-drag-region")).toBe(false);
    expect(screen.getByTitle("列表视图").hasAttribute("data-tauri-drag-region")).toBe(false);
  });
});
