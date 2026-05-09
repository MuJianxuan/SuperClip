import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainBulkActionBar } from "./MainBulkActionBar";

describe("MainBulkActionBar", () => {
  it("renders nothing when selectedCount is 0", () => {
    const { container } = render(
      <MainBulkActionBar
        selectedCount={0}
        totalCount={10}
        onSelectAll={() => {}}
        onDeselectAll={() => {}}
        onBulkCopy={() => {}}
        onBulkPin={() => {}}
        onBulkDelete={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when items are selected", () => {
    render(
      <MainBulkActionBar
        selectedCount={3}
        totalCount={10}
        onSelectAll={() => {}}
        onDeselectAll={() => {}}
        onBulkCopy={() => {}}
        onBulkPin={() => {}}
        onBulkDelete={() => {}}
      />,
    );
    expect(screen.getByText("已选 3 项")).toBeInTheDocument();
  });

  it("shows '全选' when not all selected", () => {
    render(
      <MainBulkActionBar
        selectedCount={3}
        totalCount={10}
        onSelectAll={() => {}}
        onDeselectAll={() => {}}
        onBulkCopy={() => {}}
        onBulkPin={() => {}}
        onBulkDelete={() => {}}
      />,
    );
    expect(screen.getByText("全选")).toBeInTheDocument();
  });

  it("shows '取消全选' when all selected", () => {
    render(
      <MainBulkActionBar
        selectedCount={10}
        totalCount={10}
        onSelectAll={() => {}}
        onDeselectAll={() => {}}
        onBulkCopy={() => {}}
        onBulkPin={() => {}}
        onBulkDelete={() => {}}
      />,
    );
    expect(screen.getByText("取消全选")).toBeInTheDocument();
  });

  it("calls onBulkDelete when delete button clicked", () => {
    const onBulkDelete = vi.fn();
    render(
      <MainBulkActionBar
        selectedCount={2}
        totalCount={10}
        onSelectAll={() => {}}
        onDeselectAll={() => {}}
        onBulkCopy={() => {}}
        onBulkPin={() => {}}
        onBulkDelete={onBulkDelete}
      />,
    );
    fireEvent.click(screen.getByText("删除"));
    expect(onBulkDelete).toHaveBeenCalledTimes(1);
  });

  it("calls onBulkCopy when copy button clicked", () => {
    const onBulkCopy = vi.fn();
    render(
      <MainBulkActionBar
        selectedCount={2}
        totalCount={10}
        onSelectAll={() => {}}
        onDeselectAll={() => {}}
        onBulkCopy={onBulkCopy}
        onBulkPin={() => {}}
        onBulkDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("复制"));
    expect(onBulkCopy).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectAll when '全选' clicked", () => {
    const onSelectAll = vi.fn();
    render(
      <MainBulkActionBar
        selectedCount={2}
        totalCount={10}
        onSelectAll={onSelectAll}
        onDeselectAll={() => {}}
        onBulkCopy={() => {}}
        onBulkPin={() => {}}
        onBulkDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("全选"));
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });
});
