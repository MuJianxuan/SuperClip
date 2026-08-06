import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainTabNavigation } from "./MainTabNavigation";

const counts = { all: 12, text: 6, image: 3, file: 2, pinned: 1 };

describe("MainTabNavigation", () => {
  it("renders all 5 chips with labels", () => {
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={() => {}} />);

    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("文本")).toBeInTheDocument();
    expect(screen.getByText("图片")).toBeInTheDocument();
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.getByText("已置顶")).toBeInTheDocument();
  });

  it("renders count badges", () => {
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={() => {}} />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("highlights the active chip with accent color", () => {
    render(<MainTabNavigation activeTab="image" counts={counts} onTabChange={() => {}} />);

    const imageTab = screen.getByText("图片");
    expect(imageTab.style.color).toBe("var(--selection-accent)");
  });

  it("uses amber accent for active pinned chip", () => {
    render(<MainTabNavigation activeTab="pinned" counts={counts} onTabChange={() => {}} />);

    const pinnedTab = screen.getByText("已置顶");
    expect(pinnedTab.style.color).toBe("rgba(251, 191, 36, 0.9)");
  });

  it("shows pinned star icon", () => {
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={() => {}} />);
    expect(document.querySelector(".lucide-star")).toBeInTheDocument();
  });

  it("calls onTabChange when a chip is clicked", () => {
    const onTabChange = vi.fn();
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={onTabChange} />);

    fireEvent.click(screen.getByText("文件"));
    expect(onTabChange).toHaveBeenCalledWith("file");
  });
});
