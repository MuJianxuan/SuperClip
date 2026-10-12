import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainTabNavigation } from "./MainTabNavigation";

const counts = { all: 12, text: 6, rich: 4, image: 3, file: 2, link: 0, other: 0 };

describe("MainTabNavigation", () => {
  it("renders the 5 always-on type chips (置顶入口移到左侧栏)", () => {
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={() => {}} />);

    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("文本")).toBeInTheDocument();
    expect(screen.getByText("富文本")).toBeInTheDocument();
    expect(screen.getByText("图片")).toBeInTheDocument();
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.queryByText("已置顶")).not.toBeInTheDocument();
  });

  it("shows link/other chips only when those records exist", () => {
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={() => {}} />);
    expect(screen.queryByText("链接")).not.toBeInTheDocument();
    expect(screen.queryByText("其他")).not.toBeInTheDocument();

    render(
      <MainTabNavigation
        activeTab="all"
        counts={{ ...counts, link: 2, other: 1 }}
        onTabChange={() => {}}
      />,
    );
    expect(screen.getByText("链接")).toBeInTheDocument();
    expect(screen.getByText("其他")).toBeInTheDocument();
  });

  it("keeps the active chip visible even when its count drops to zero", () => {
    render(<MainTabNavigation activeTab="link" counts={counts} onTabChange={() => {}} />);

    expect(screen.getByText("链接")).toBeInTheDocument();
    expect(screen.queryByText("其他")).not.toBeInTheDocument();
  });

  it("renders count badges for the visible chips", () => {
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={() => {}} />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
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

  it("maps the rich chip to its own tab id", () => {
    const onTabChange = vi.fn();
    render(<MainTabNavigation activeTab="all" counts={counts} onTabChange={onTabChange} />);

    fireEvent.click(screen.getByText("富文本"));
    expect(onTabChange).toHaveBeenCalledWith("rich");
  });
});
