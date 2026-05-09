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

  it("hides preview after row leave with delay", () => {
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
