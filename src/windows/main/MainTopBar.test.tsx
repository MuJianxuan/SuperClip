import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MainTopBar } from "./MainTopBar";

describe("MainTopBar", () => {
  const defaultProps = {
    activeTab: "all" as const,
    viewMode: "list" as const,
    query: "",
    onTabChange: vi.fn(),
    onViewModeChange: vi.fn(),
    onQueryChange: vi.fn(),
    onSettingsClick: vi.fn(),
  };

  it("renders app title", () => {
    render(<MainTopBar {...defaultProps} />);
    expect(screen.getByText("SuperClip")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<MainTopBar {...defaultProps} />);
    expect(screen.getByPlaceholderText("搜索...")).toBeInTheDocument();
  });

  it("renders tab navigation", () => {
    render(<MainTopBar {...defaultProps} />);
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("置顶")).toBeInTheDocument();
  });

  it("renders view toggle buttons", () => {
    render(<MainTopBar {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(7);
  });

  it("shows query value in search input", () => {
    render(<MainTopBar {...defaultProps} query="hello" />);
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });
});
