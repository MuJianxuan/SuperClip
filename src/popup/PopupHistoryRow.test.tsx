import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PopupHistoryRow } from "./PopupHistoryRow";
import type { ClipboardItem } from "../components/history-row";

const mockItem: ClipboardItem = {
  id: "clip-1",
  kind: "text",
  title: "Hello World",
  preview: "Hello World preview",
  sourceApp: "VSCode",
  meta: "",
  timeLabel: "3s前",
  isPinned: false,
  matchType: null,
  matchedFields: [],
  highlightRanges: [],
};

describe("PopupHistoryRow", () => {
  it("renders item title", () => {
    render(
      <PopupHistoryRow
        item={mockItem}
        isSelected={false}
        onSelect={() => {}}
        onClick={() => {}}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
      />,
    );
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("shows pin indicator when pinned", () => {
    const pinnedItem = { ...mockItem, isPinned: true };
    const { container } = render(
      <PopupHistoryRow
        item={pinnedItem}
        isSelected={false}
        onSelect={() => {}}
        onClick={() => {}}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
      />,
    );
    expect(container.querySelector(".lucide-pin")).toBeInTheDocument();
  });

  it("applies selected styles when isSelected", () => {
    const { container } = render(
      <PopupHistoryRow
        item={mockItem}
        isSelected={true}
        onSelect={() => {}}
        onClick={() => {}}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
      />,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("selection-accent");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <PopupHistoryRow
        item={mockItem}
        isSelected={false}
        onSelect={() => {}}
        onClick={onClick}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
      />,
    );
    screen.getByText("Hello World").closest("button")?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls onMouseLeave on mouse leave", () => {
    const onMouseLeave = vi.fn();
    const { container } = render(
      <PopupHistoryRow
        item={mockItem}
        isSelected={false}
        onSelect={() => {}}
        onClick={() => {}}
        onMouseEnter={() => {}}
        onMouseLeave={onMouseLeave}
      />,
    );
    const button = container.querySelector("button")!;
    fireEvent.mouseLeave(button);
    expect(onMouseLeave).toHaveBeenCalled();
  });
});
