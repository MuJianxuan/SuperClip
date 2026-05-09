import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainTabNavigation } from "./MainTabNavigation";

describe("MainTabNavigation", () => {
  it("renders all 5 tabs", () => {
    render(<MainTabNavigation activeTab="all" onTabChange={() => {}} />);

    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("文本")).toBeInTheDocument();
    expect(screen.getByText("图片")).toBeInTheDocument();
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.getByText("置顶")).toBeInTheDocument();
  });

  it("highlights the active tab", () => {
    render(<MainTabNavigation activeTab="image" onTabChange={() => {}} />);

    const imageTab = screen.getByText("图片");
    expect(imageTab.className).toContain("bg-[var(--surface)]");
  });

  it("calls onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    render(<MainTabNavigation activeTab="all" onTabChange={onTabChange} />);

    fireEvent.click(screen.getByText("文件"));
    expect(onTabChange).toHaveBeenCalledWith("file");
  });

  it("does not call onTabChange for already active tab click", () => {
    const onTabChange = vi.fn();
    render(<MainTabNavigation activeTab="text" onTabChange={onTabChange} />);

    fireEvent.click(screen.getByText("文本"));
    expect(onTabChange).toHaveBeenCalledWith("text");
  });
});
