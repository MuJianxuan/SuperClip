import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainGridView } from "./MainGridView";
import type { ClipboardItem } from "../../components/history-row";

const mockItems: ClipboardItem[] = [
  { id: "1", kind: "text", title: "Hello", preview: "Hello World content", sourceApp: "VSCode", meta: "", timeLabel: "3s前", isPinned: false, matchType: null, matchedFields: [], highlightRanges: [] },
  { id: "2", kind: "image", title: "Screenshot", preview: "", sourceApp: "Finder", meta: "800x600", timeLabel: "1m前", isPinned: true, matchType: null, matchedFields: [], highlightRanges: [] },
];

describe("MainGridView", () => {
  const defaultProps = {
    items: mockItems,
    selectedId: "1",
    selectedIds: new Set<string>(),
    hasQuery: false,
    onClearSearch: vi.fn(),
    onSelect: vi.fn(),
    onToggleSelect: vi.fn(),
    onAction: vi.fn(),
    onPin: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders item titles", () => {
    render(<MainGridView {...defaultProps} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Screenshot")).toBeInTheDocument();
  });

  it("renders source and time for each card", () => {
    render(<MainGridView {...defaultProps} />);
    expect(screen.getByText("VSCode")).toBeInTheDocument();
    expect(screen.getByText("3s前")).toBeInTheDocument();
  });

  it("shows text preview for text items", () => {
    render(<MainGridView {...defaultProps} />);
    expect(screen.getByText("Hello World content")).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    render(<MainGridView {...defaultProps} items={[]} />);
    expect(screen.getByText("剪贴板暂无记录")).toBeInTheDocument();
  });

  it("shows empty state with no-match copy when search has no results", () => {
    render(<MainGridView {...defaultProps} items={[]} hasQuery />);
    expect(screen.getByText("没有匹配的内容")).toBeInTheDocument();
  });

  it("shows clear-search button and calls onClearSearch when search has no results", () => {
    const onClearSearch = vi.fn();
    render(<MainGridView {...defaultProps} items={[]} hasQuery onClearSearch={onClearSearch} />);
    const clearBtn = screen.getByRole("button", { name: "清空搜索" });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(onClearSearch).toHaveBeenCalled();
  });

  it("does not show clear-search button in no-records empty state", () => {
    render(<MainGridView {...defaultProps} items={[]} />);
    expect(screen.queryByRole("button", { name: "清空搜索" })).not.toBeInTheDocument();
  });

  it("shows pin indicator for pinned items", () => {
    const { container } = render(<MainGridView {...defaultProps} />);
    expect(container.querySelectorAll(".lucide-star").length).toBeGreaterThan(0);
  });

  it("marks the selected card", () => {
    const { container } = render(<MainGridView {...defaultProps} />);
    const selectedCard = container.querySelector('[data-clipboard-row-id="1"]');
    expect(selectedCard?.getAttribute("data-selected")).not.toBeNull();
    const otherCard = container.querySelector('[data-clipboard-row-id="2"]');
    expect(otherCard?.getAttribute("data-selected")).toBeNull();
  });

  it("calls onToggleSelect when checkbox is clicked", () => {
    const onToggleSelect = vi.fn();
    const { container } = render(<MainGridView {...defaultProps} onToggleSelect={onToggleSelect} />);
    const card = container.querySelector('[data-clipboard-row-id="1"]');
    const checkbox = card!.querySelector("button[title='选择']");
    fireEvent.click(checkbox!);
    expect(onToggleSelect).toHaveBeenCalledWith("1");
  });

  it("applies rowSlideIn enter animation to cards", () => {
    const { container } = render(<MainGridView {...defaultProps} />);
    const cards = container.querySelectorAll('[data-clipboard-row-id]');
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => {
      expect((card as HTMLElement).className).toContain("animate-[rowSlideIn_0.2s_ease-out]");
    });
  });

  it("uses minmax(160px,1fr) grid template", () => {
    const { container } = render(<MainGridView {...defaultProps} />);
    const grid = container.querySelector('[data-testid="main-grid-view"]');
    expect((grid as HTMLElement).style.gridTemplateColumns).toContain("minmax(160px, 1fr)");
  });
});
