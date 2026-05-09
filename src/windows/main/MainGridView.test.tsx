import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("VSCode · 3s前")).toBeInTheDocument();
    expect(screen.getByText("Finder · 1m前")).toBeInTheDocument();
  });

  it("shows text preview for text items", () => {
    render(<MainGridView {...defaultProps} />);
    expect(screen.getByText("Hello World content")).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    render(<MainGridView {...defaultProps} items={[]} />);
    expect(screen.getByText("暂无记录")).toBeInTheDocument();
  });

  it("shows pin indicator for pinned items", () => {
    const { container } = render(<MainGridView {...defaultProps} />);
    const pins = container.querySelectorAll(".lucide-pin");
    expect(pins.length).toBeGreaterThan(0);
  });

  it("applies selected border to selected card", () => {
    const { container } = render(<MainGridView {...defaultProps} />);
    const selectedCard = container.querySelector("[class*='selection-accent']");
    expect(selectedCard).toBeInTheDocument();
  });
});
