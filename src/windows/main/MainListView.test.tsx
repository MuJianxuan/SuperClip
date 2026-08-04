import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainListView } from "./MainListView";
import type { ClipboardItem } from "../../components/history-row";

const mockItems: ClipboardItem[] = [
  { id: "1", kind: "text", title: "Hello", preview: "Hello preview text", sourceApp: "VSCode", meta: "", timeLabel: "3 分钟前", isPinned: false, matchType: null, matchedFields: [], highlightRanges: [] },
  { id: "2", kind: "image", title: "Screenshot", preview: "1600×1200", sourceApp: "Finder", meta: "800x600", timeLabel: "1 天前", isPinned: true, matchType: null, matchedFields: [], highlightRanges: [] },
  { id: "3", kind: "file", title: "brief.pdf", preview: "第四版", sourceApp: "Mail", meta: "", timeLabel: "3 天前", isPinned: false, matchType: null, matchedFields: [], highlightRanges: [] },
];

describe("MainListView", () => {
  const defaultProps = {
    items: mockItems,
    selectedId: "1",
    selectedIds: new Set<string>(),
    hasQuery: false,
    onClearSearch: vi.fn(),
    onSelect: vi.fn(),
    onToggleSelect: vi.fn(),
    onAction: vi.fn(),
    onCopy: vi.fn(),
    onPin: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders item titles", () => {
    render(<MainListView {...defaultProps} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Screenshot")).toBeInTheDocument();
  });

  it("groups items by 今天/昨天/更早 based on time label", () => {
    render(<MainListView {...defaultProps} />);
    expect(screen.getByText("今天")).toBeInTheDocument();
    expect(screen.getByText("昨天")).toBeInTheDocument();
    expect(screen.getByText("更早")).toBeInTheDocument();
  });

  it("renders source app and time", () => {
    render(<MainListView {...defaultProps} />);
    expect(screen.getByText("VSCode")).toBeInTheDocument();
    expect(screen.getByText("3 分钟前")).toBeInTheDocument();
  });

  it("renders preview text", () => {
    render(<MainListView {...defaultProps} />);
    expect(screen.getByText("Hello preview text")).toBeInTheDocument();
  });

  it("shows empty state with no-records copy when no items", () => {
    render(<MainListView {...defaultProps} items={[]} />);
    expect(screen.getByText("剪贴板暂无记录")).toBeInTheDocument();
  });

  it("shows empty state with no-match copy when search has no results", () => {
    render(<MainListView {...defaultProps} items={[]} hasQuery />);
    expect(screen.getByText("没有匹配的内容")).toBeInTheDocument();
  });

  it("shows clear-search button and calls onClearSearch when search has no results", () => {
    const onClearSearch = vi.fn();
    render(<MainListView {...defaultProps} items={[]} hasQuery onClearSearch={onClearSearch} />);
    const clearBtn = screen.getByRole("button", { name: "清空搜索" });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(onClearSearch).toHaveBeenCalled();
  });

  it("does not show clear-search button in no-records empty state", () => {
    render(<MainListView {...defaultProps} items={[]} />);
    expect(screen.queryByRole("button", { name: "清空搜索" })).not.toBeInTheDocument();
  });

  it("shows pin indicator for pinned items", () => {
    const { container } = render(<MainListView {...defaultProps} />);
    expect(container.querySelectorAll(".lucide-star").length).toBeGreaterThan(0);
  });

  it("shows row actions on hover", () => {
    const { container } = render(<MainListView {...defaultProps} />);
    const row = container.querySelector('[data-clipboard-row-id="3"]');
    expect(row).not.toBeNull();
    fireEvent.mouseEnter(row!);
    expect(screen.getByTitle("复制")).toBeInTheDocument();
    expect(screen.getByTitle("置顶")).toBeInTheDocument();
    expect(screen.getByTitle("删除")).toBeInTheDocument();
  });

  it("calls onSelect when a row is clicked", () => {
    const onSelect = vi.fn();
    const { container } = render(<MainListView {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(container.querySelector('[data-clipboard-row-id="2"]')!);
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("calls onToggleSelect when checkbox is clicked", () => {
    const onToggleSelect = vi.fn();
    const { container } = render(<MainListView {...defaultProps} onToggleSelect={onToggleSelect} />);
    const row = container.querySelector('[data-clipboard-row-id="1"]');
    const checkbox = row!.querySelector("button[title='选择']");
    fireEvent.click(checkbox!);
    expect(onToggleSelect).toHaveBeenCalledWith("1");
  });

  it("applies rowSlideIn enter animation to rows", () => {
    const { container } = render(<MainListView {...defaultProps} />);
    const rows = container.querySelectorAll('[data-clipboard-row-id]');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect((row as HTMLElement).className).toContain("animate-[rowSlideIn_0.2s_ease-out]");
    });
  });
});
