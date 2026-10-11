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
});
