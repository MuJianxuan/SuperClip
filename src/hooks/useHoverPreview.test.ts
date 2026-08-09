import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHoverPreview } from "./useHoverPreview";

describe("useHoverPreview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show preview immediately on row enter", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });

    expect(result.current.isPreviewVisible).toBe(false);
    expect(result.current.hoveredItem).toBe("item-1");
  });

  it("shows preview after delay", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });

    act(() => { vi.advanceTimersByTime(300); });

    expect(result.current.isPreviewVisible).toBe(true);
  });

  it("hides preview after row leave with delay (default hideOnRowLeave)", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.isPreviewVisible).toBe(true);

    act(() => { result.current.handleRowLeave(); });
    expect(result.current.isPreviewVisible).toBe(true);

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.isPreviewVisible).toBe(false);
    expect(result.current.hoveredItem).toBeNull();
  });

  it("hides preview after leaving panel with delay", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.isPreviewVisible).toBe(true);

    act(() => { result.current.handlePanelLeave(); });
    expect(result.current.isPreviewVisible).toBe(true);

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.isPreviewVisible).toBe(false);
    expect(result.current.hoveredItem).toBeNull();
  });

  it("panel leave does not restart an in-flight hide timer (scheduleHide is idempotent)", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });

    // 行离开起 100ms 计时 → 50ms 后窗口离开：不重启（幂等），旧计时器剩余 50ms 触发
    act(() => { result.current.handleRowLeave(); });
    act(() => { vi.advanceTimersByTime(50); });
    act(() => { result.current.handlePanelLeave(); });
    act(() => { vi.advanceTimersByTime(50); });
    // 旧计时器（行离开后 100ms）未被重启，此时已触发隐藏
    expect(result.current.isPreviewVisible).toBe(false);
  });

  it("keeps preview visible when mouse enters preview (bridge pattern)", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });

    act(() => { result.current.handleRowLeave(); });
    act(() => { result.current.handlePreviewEnter(); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(result.current.isPreviewVisible).toBe(true);
  });

  it("does not hide on row leave when hideOnRowLeave is false (panel-scoped)", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100, hideOnRowLeave: false }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });

    act(() => { result.current.handleRowLeave(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.isPreviewVisible).toBe(true);

    // 离开窗口才隐藏
    act(() => { result.current.handlePanelLeave(); });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.isPreviewVisible).toBe(false);
  });

  it("hides preview when mouse leaves preview and no row is hovered", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.handlePreviewEnter(); });
    // 鼠标离开行（移向悬浮窗之外的空白/窗口外）后，再离开悬浮窗才隐藏
    act(() => { result.current.handleRowLeave(); });
    act(() => { result.current.handlePreviewLeave(); });
    act(() => { vi.advanceTimersByTime(100); });

    expect(result.current.isPreviewVisible).toBe(false);
  });

  it("keeps preview when mouse leaves preview while hovering a row (row-active, no race mis-hide)", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    // 模拟「从悬浮窗移回另一行」：行 B enter（rowActive=true）先到，悬浮窗 leave IPC 后到
    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.handlePreviewEnter(); });
    act(() => {
      result.current.handleRowEnter("item-2", new DOMRect(0, 44, 100, 44));
    });
    act(() => { result.current.handlePreviewLeave(); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(result.current.isPreviewVisible).toBe(true);
  });

  it("row enter resets stale isOverPreviewRef so hiding is never stuck", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    // 鼠标进过悬浮窗（isOverPreviewRef=true）后，直接 hover 新行：残留标记被重置，
    // 之后离开行的隐藏计时不会被跳过（修复「悬浮窗永不消失」）
    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.handlePreviewEnter(); });
    act(() => {
      result.current.handleRowEnter("item-2", new DOMRect(0, 44, 100, 44));
    });
    act(() => { result.current.handleRowLeave(); });
    act(() => { vi.advanceTimersByTime(100); });

    expect(result.current.isPreviewVisible).toBe(false);
  });

  it("panel leave clears stale isOverPreviewRef (drop lost leave event) so hiding is never stuck", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    // 模拟 preview:mouse-leave 丢失：鼠标进过悬浮窗（覆盖标记 true）且从未收到 leave，
    // 之后鼠标离开宿主窗口——handlePanelLeave 必须作废覆盖标记，隐藏计时才能生效
    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.handlePreviewEnter(); });
    act(() => { result.current.handleRowLeave(); });
    act(() => { result.current.handlePanelLeave(); });

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.isPreviewVisible).toBe(false);
  });

  it("preview overstay fallback hides stuck preview when leave event is lost", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    // mouse-leave 丢失：鼠标进过悬浮窗后无任何离开事件，覆盖标记永久 true。
    // 超过 PREVIEW_OVERSTAY_MS（10s）且鼠标不在行上时强制解除覆盖并隐藏
    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.handlePreviewEnter(); });
    act(() => { result.current.handleRowLeave(); });

    act(() => { vi.advanceTimersByTime(9_900); });
    // 未到兜底时限：悬浮窗保持（鼠标可能仍在悬浮窗上）
    expect(result.current.isPreviewVisible).toBe(true);

    act(() => { vi.advanceTimersByTime(200); });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.isPreviewVisible).toBe(false);
  });

  it("preview overstay does not fire while mouse is back on a row", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    // 鼠标从悬浮窗移回行（rowActive=true）：10s 兜底不触发，悬浮窗保持跟随
    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.handlePreviewEnter(); });
    act(() => {
      result.current.handleRowEnter("item-2", new DOMRect(0, 44, 100, 44));
    });

    act(() => { vi.advanceTimersByTime(10_200); });
    expect(result.current.isPreviewVisible).toBe(true);
  });

  it("reset clears all state and timers", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.isPreviewVisible).toBe(true);

    act(() => { result.current.reset(); });
    expect(result.current.isPreviewVisible).toBe(false);
    expect(result.current.hoveredItem).toBeNull();
    expect(result.current.hoveredRect).toBeNull();

    // reset 后无残留计时器：离开行/窗口不再触发隐藏副作用
    act(() => { result.current.handleRowLeave(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.isPreviewVisible).toBe(false);
  });

  it("cancels show timer if row leave happens before delay", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(150); });
    act(() => { result.current.handleRowLeave(); });
    act(() => { vi.advanceTimersByTime(300); });

    expect(result.current.isPreviewVisible).toBe(false);
  });
});
