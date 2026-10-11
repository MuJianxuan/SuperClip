import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainTabNavigation } from "./MainTabNavigation";

const counts = { all: 12, text: 6, image: 3, file: 2, pinned: 1 };

describe("MainTabNavigation", () => {
  it("renders the 4 type chips (置顶入口移到左侧栏)", () => {
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={() => {}} />);

    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("文本")).toBeInTheDocument();
    expect(screen.getByText("图片")).toBeInTheDocument();
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.queryByText("已置顶")).not.toBeInTheDocument();
  });

  it("renders count badges for the visible chips", () => {
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={() => {}} />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("highlights the active chip with accent color", () => {
    render(<MainTabNavigation activeTab="image" counts={counts} onTabChange={() => {}} />);

    const imageTab = screen.getByText("图片");
    expect(imageTab.style.color).toBe("var(--accent-text)");
  });

  it("calls onTabChange when a chip is clicked", () => {
    const onTabChange = vi.fn();
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={onTabChange} />);

    fireEvent.click(screen.getByText("文件"));
    expect(onTabChange).toHaveBeenCalledWith("file");
  });
});
