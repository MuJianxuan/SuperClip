import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MainListView } from "./MainListView";
import type { ClipboardItem } from "../../components/history-row";

const mockItems: ClipboardItem[] = [
  { id: "1", kind: "text", title: "Hello", preview: "Hello", sourceApp: "VSCode", meta: "", timeLabel: "3s前", isPinned: false, matchType: null, matchedFields: [], highlightRanges: [] },
  { id: "2", kind: "image", title: "Screenshot", preview: "", sourceApp: "Finder", meta: "800x600", timeLabel: "1m前", isPinned: true, matchType: null, matchedFields: [], highlightRanges: [] },
];

describe("MainListView", () => {
  const defaultProps = {
    items: mockItems,
    selectedId: "1",
    selectedIds: new Set<string>(),
    onSelect: vi.fn(),
    onToggleSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onAction: vi.fn(),
    onCopy: vi.fn(),
    onPin: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders table headers", () => {
    render(<MainListView {...defaultProps} />);
    expect(screen.getByText("内容")).toBeInTheDocument();
    expect(screen.getByText("来源")).toBeInTheDocument();
    expect(screen.getByText("时间")).toBeInTheDocument();
    expect(screen.getByText("操作")).toBeInTheDocument();
  });

  it("renders item titles", () => {
    render(<MainListView {...defaultProps} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Screenshot")).toBeInTheDocument();
  });

  it("renders source app and time", () => {
    render(<MainListView {...defaultProps} />);
    expect(screen.getByText("VSCode")).toBeInTheDocument();
    expect(screen.getByText("3s前")).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    render(<MainListView {...defaultProps} items={[]} />);
    expect(screen.getByText("暂无记录")).toBeInTheDocument();
  });

  it("renders checkboxes for each row", () => {
    render(<MainListView {...defaultProps} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(3); // header + 2 rows
  });

  it("shows pin indicator for pinned items", () => {
    const { container } = render(<MainListView {...defaultProps} />);
    const pins = container.querySelectorAll(".lucide-pin");
    expect(pins.length).toBeGreaterThan(0);
  });
});
