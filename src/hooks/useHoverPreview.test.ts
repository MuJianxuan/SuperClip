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

  it("panel leave resets the row-leave hide timer (no stale timer fires later)", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });

    // 行离开起 100ms 计时 → 50ms 后窗口离开重置为新 100ms 计时
    act(() => { result.current.handleRowLeave(); });
    act(() => { vi.advanceTimersByTime(50); });
    act(() => { result.current.handlePanelLeave(); });
    act(() => { vi.advanceTimersByTime(50); });
    // 旧计时器（行离开后 100ms）已被清理，悬浮窗仍可见
    expect(result.current.isPreviewVisible).toBe(true);

    act(() => { vi.advanceTimersByTime(50); });
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

  it("hides preview when mouse leaves preview", () => {
    const { result } = renderHook(() => useHoverPreview<string>({ delay: 300, hideDelay: 100 }));

    act(() => {
      result.current.handleRowEnter("item-1", new DOMRect(0, 0, 100, 44));
    });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.handlePreviewEnter(); });
    act(() => { result.current.handlePreviewLeave(); });
    act(() => { vi.advanceTimersByTime(100); });

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
