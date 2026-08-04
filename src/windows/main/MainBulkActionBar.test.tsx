import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainBulkActionBar } from "./MainBulkActionBar";

describe("MainBulkActionBar", () => {
  const baseProps = {
    selectedCount: 0,
    totalCount: 10,
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onBulkCopy: vi.fn(),
    onBulkPin: vi.fn(),
    onBulkDelete: vi.fn(),
  };

  it("stays hidden when selectedCount is 0", () => {
    const { container } = render(<MainBulkActionBar {...baseProps} />);
    const bar = container.querySelector('[data-testid="main-bulk-action-bar"]');
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute("aria-hidden")).toBe("true");
    expect((bar as HTMLElement).style.opacity).toBe("0");
  });

  it("renders selected count when items are selected", () => {
    render(<MainBulkActionBar {...baseProps} selectedCount={3} />);
    expect(screen.getByText(/已选/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows '全选可见' when not all selected", () => {
    render(<MainBulkActionBar {...baseProps} selectedCount={3} />);
    expect(screen.getByText("全选可见")).toBeInTheDocument();
  });

  it("shows '已全选' when all selected", () => {
    render(<MainBulkActionBar {...baseProps} selectedCount={10} />);
    expect(screen.getByText("已全选")).toBeInTheDocument();
  });

  it("calls onBulkDelete when delete button clicked", () => {
    const onBulkDelete = vi.fn();
    render(<MainBulkActionBar {...baseProps} selectedCount={2} onBulkDelete={onBulkDelete} />);
    fireEvent.click(screen.getByText("删除"));
    expect(onBulkDelete).toHaveBeenCalledTimes(1);
  });

  it("calls onBulkCopy when copy button clicked", () => {
    const onBulkCopy = vi.fn();
    render(<MainBulkActionBar {...baseProps} selectedCount={2} onBulkCopy={onBulkCopy} />);
    fireEvent.click(screen.getByText("复制"));
    expect(onBulkCopy).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectAll when '全选可见' clicked", () => {
    const onSelectAll = vi.fn();
    render(<MainBulkActionBar {...baseProps} selectedCount={2} onSelectAll={onSelectAll} />);
    fireEvent.click(screen.getByText("全选可见"));
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it("calls onDeselectAll when clear button clicked", () => {
    const onDeselectAll = vi.fn();
    render(<MainBulkActionBar {...baseProps} selectedCount={2} onDeselectAll={onDeselectAll} />);
    fireEvent.click(screen.getByTitle("取消选择"));
    expect(onDeselectAll).toHaveBeenCalledTimes(1);
  });
});
