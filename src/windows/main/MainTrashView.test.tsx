import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainTrashView } from "./MainTrashView";
import type { TrashEntry } from "../../lib/superclip";

const entries: TrashEntry[] = [
  {
    trashId: "trash-1",
    itemId: "clip-1",
    undoToken: "undo-1",
    kind: "text",
    title: "发布命令片段",
    preview: "npm run tauri dev -- --no-watch…",
    sourceApp: "Warp",
    deletedAt: 1_700_000_000,
    deletedLabel: "3 分钟前",
    expiresAt: 1_700_000_000 + 30 * 86_400,
    remainingDays: 29,
    isTruncated: true,
  },
  {
    trashId: "trash-2",
    itemId: "clip-2",
    undoToken: "undo-2",
    kind: "file",
    title: "旧版交付说明.md",
    preview: "包含 P0 风险关闭门…",
    sourceApp: "Finder",
    deletedAt: 1_699_000_000,
    deletedLabel: "昨天",
    expiresAt: 1_699_000_000 + 30 * 86_400,
    remainingDays: 28,
    isTruncated: false,
  },
];

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    entries,
    retentionDays: 30,
    selectedIds: new Set<string>(),
    readOnly: false,
    onToggleSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onRestore: vi.fn(),
    onRestoreSelected: vi.fn(),
    onRestoreAll: vi.fn(),
    onPurgeSelected: vi.fn(),
    onPurgeAll: vi.fn(),
    ...overrides,
  };
}

describe("MainTrashView", () => {
  it("renders 回收站 title with count and retention copy", () => {
    render(<MainTrashView {...makeProps()} />);
    expect(screen.getByRole("heading", { name: "回收站" })).toBeInTheDocument();
    expect(screen.getByText("2 条记录 · 30 天后自动清空")).toBeInTheDocument();
  });

  it("renders each trash row as a table row with source / deleted label / remaining days", () => {
    render(<MainTrashView {...makeProps()} />);
    expect(screen.getAllByTestId("trash-row")).toHaveLength(2);
    expect(screen.getByText("发布命令片段")).toBeInTheDocument();
    expect(screen.getByText("Warp")).toBeInTheDocument();
    expect(screen.getByText("3 分钟前")).toBeInTheDocument();
    expect(screen.getByText("29 天")).toBeInTheDocument();
  });

  it("marks truncated trash rows with a badge", () => {
    render(<MainTrashView {...makeProps()} />);
    expect(screen.getAllByTestId("trash-row-truncated")).toHaveLength(1);
  });

  it("renders the retention note card", () => {
    render(<MainTrashView {...makeProps()} />);
    const note = screen.getByTestId("trash-retention-note");
    expect(note.textContent).toContain("保留 30 天");
    expect(note.textContent).toContain("清空后无法找回");
  });

  it("shows empty state when there are no entries", () => {
    render(<MainTrashView {...makeProps({ entries: [] })} />);
    expect(screen.getByText("回收站为空")).toBeInTheDocument();
    expect(screen.queryByTestId("trash-bulk-bar")).not.toBeInTheDocument();
  });

  it("calls onRestore with the row undo token", () => {
    const onRestore = vi.fn();
    render(<MainTrashView {...makeProps({ onRestore })} />);
    fireEvent.click(screen.getByLabelText("恢复 发布命令片段"));
    expect(onRestore).toHaveBeenCalledWith("undo-1");
  });

  it("toggles row selection through the checkbox", () => {
    const onToggleSelect = vi.fn();
    render(<MainTrashView {...makeProps({ onToggleSelect })} />);
    fireEvent.click(screen.getAllByTitle("选择")[0]);
    expect(onToggleSelect).toHaveBeenCalledWith("trash-1");
  });

  it("批量栏显示已选条数并在未选中时禁用批量按钮", () => {
    const { unmount } = render(<MainTrashView {...makeProps()} />);
    expect(screen.getByTestId("trash-bulk-bar").textContent).toContain("已选择 0 条");
    expect(screen.getByText("恢复所选").closest("button")).toBeDisabled();
    expect(screen.getByText("彻底删除所选").closest("button")).toBeDisabled();
    unmount();

    render(<MainTrashView {...makeProps({ selectedIds: new Set(["trash-1"]) })} />);
    expect(screen.getByTestId("trash-bulk-bar").textContent).toContain("已选择 1 条");
    expect(screen.getByText("恢复所选").closest("button")).not.toBeDisabled();
  });

  it("顶部「全部恢复 / 清空回收站」交给调用方二次确认", () => {
    const onRestoreAll = vi.fn();
    const onPurgeAll = vi.fn();
    render(<MainTrashView {...makeProps({ onRestoreAll, onPurgeAll })} />);
    fireEvent.click(screen.getByText("全部恢复"));
    expect(onRestoreAll).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("清空回收站"));
    expect(onPurgeAll).toHaveBeenCalledTimes(1);
  });

  it("只读模式禁用全部破坏性操作", () => {
    render(<MainTrashView {...makeProps({ readOnly: true })} />);
    expect(screen.getByText("全部恢复").closest("button")).toBeDisabled();
    expect(screen.getByText("清空回收站").closest("button")).toBeDisabled();
    expect(screen.getAllByLabelText(/恢复 /)[0].closest("button")).toBeDisabled();
  });
});
