import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PopupContextMenu, PopupHistoryRow } from "./PopupHistoryRow";
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
      onPin={() => {}}
      onDelete={() => {}}
      onContextMenu={() => {}}
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

  it("swaps the time label for pin/delete actions on hover", () => {
    const { container } = renderRow();
    expect(screen.queryByTestId("popup-row-actions")).not.toBeInTheDocument();
    fireEvent.mouseEnter(container.querySelector("button")!);
    expect(screen.getByTestId("popup-row-actions")).toBeInTheDocument();
    expect(screen.getByLabelText("置顶")).toBeInTheDocument();
    expect(screen.getByLabelText("删除")).toBeInTheDocument();
  });

  it("fires onPin / onDelete without selecting the row", () => {
    const onPin = vi.fn();
    const onDelete = vi.fn();
    const onClick = vi.fn();
    const { container } = renderRow({}, { onPin, onDelete, onClick });
    fireEvent.mouseEnter(container.querySelector("button")!);
    fireEvent.click(screen.getByLabelText("置顶"));
    expect(onPin).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText("删除"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
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

  it("other 类型右键菜单隐藏两个直接粘贴入口（D-07 固定仅复制）", () => {
    render(
      <PopupContextMenu
        x={0}
        y={0}
        item={{ ...mockItem, kind: "other" }}
        onCopy={() => {}}
        onPaste={() => {}}
        onPastePlainText={() => {}}
        onPin={() => {}}
        onDetail={() => {}}
        onDelete={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("复制")).toBeInTheDocument();
    expect(screen.queryByText("粘贴到前台应用")).not.toBeInTheDocument();
    expect(screen.queryByText("粘贴为纯文本")).not.toBeInTheDocument();
    expect(screen.getByText("置顶")).toBeInTheDocument();
    expect(screen.getByText("查看详情")).toBeInTheDocument();
    expect(screen.getByText("删除")).toBeInTheDocument();
  });

  it("普通类型右键菜单保留两个粘贴入口", () => {
    render(
      <PopupContextMenu
        x={0}
        y={0}
        item={{ ...mockItem, kind: "link" }}
        onCopy={() => {}}
        onPaste={() => {}}
        onPastePlainText={() => {}}
        onPin={() => {}}
        onDetail={() => {}}
        onDelete={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("粘贴到前台应用")).toBeInTheDocument();
    expect(screen.getByText("粘贴为纯文本")).toBeInTheDocument();
  });
});
