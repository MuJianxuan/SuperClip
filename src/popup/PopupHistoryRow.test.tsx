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

function renderRow(overrides: Partial<typeof mockItem> = {}, props: Record<string, unknown> = {}) {
  return render(
    <PopupHistoryRow
      item={{ ...mockItem, ...overrides }}
      isSelected={false}
      onSelect={() => {}}
      onClick={() => {}}
      onMouseEnter={() => {}}
      onMouseLeave={() => {}}
      {...props}
    />,
  );
}

describe("PopupHistoryRow", () => {
  it("renders title and preview lines (two-line row)", () => {
    renderRow();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(screen.getByText("Hello World preview")).toBeInTheDocument();
  });

  it("renders time label", () => {
    renderRow();
    expect(screen.getByText("3s前")).toBeInTheDocument();
  });

  it("shows amber star when pinned", () => {
    const { container } = renderRow({ isPinned: true });
    expect(container.querySelector(".lucide-star")).toBeInTheDocument();
  });

  it("does not show star when not pinned", () => {
    const { container } = renderRow();
    expect(container.querySelector(".lucide-star")).not.toBeInTheDocument();
  });

  it("applies selected styles when isSelected", () => {
    const { container } = renderRow({}, { isSelected: true });
    const button = container.querySelector("button");
    expect(button?.className).toContain("row-selected");
  });

  it("calls onSelect and onMouseEnter with rect on mouse enter", () => {
    const onSelect = vi.fn();
    const onMouseEnter = vi.fn();
    const { container } = renderRow({}, { onSelect, onMouseEnter });
    const button = container.querySelector("button")!;
    fireEvent.mouseEnter(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    // jsdom 的 getBoundingClientRect 与全局 DOMRect 构造器不同 realm，断言结构而非实例
    expect(onMouseEnter.mock.calls[0][0]).toHaveProperty("top");
    expect(onMouseEnter.mock.calls[0][0]).toHaveProperty("left");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    renderRow({}, { onClick });
    screen.getByText("Hello World").closest("button")?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls onMouseLeave on mouse leave", () => {
    const onMouseLeave = vi.fn();
    const { container } = renderRow({}, { onMouseLeave });
    const button = container.querySelector("button")!;
    fireEvent.mouseLeave(button);
    expect(onMouseLeave).toHaveBeenCalled();
  });
});
