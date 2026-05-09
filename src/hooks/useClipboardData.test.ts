import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useClipboardData } from "./useClipboardData";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe("useClipboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with empty items and loading state", () => {
    const { result } = renderHook(() => useClipboardData());
    expect(result.current.items).toEqual([]);
    expect(result.current.query).toBe("");
    expect(result.current.selectedId).toBe("");
  });

  it("provides setQuery to update search", () => {
    const { result } = renderHook(() => useClipboardData());
    act(() => { result.current.setQuery("test"); });
    expect(result.current.query).toBe("test");
  });

  it("provides setSelectedId (resets when no matching item)", () => {
    const { result } = renderHook(() => useClipboardData());
    act(() => { result.current.setSelectedId("clip-1"); });
    // selectedId resets to "" because items is empty and clip-1 doesn't exist
    expect(result.current.selectedId).toBe("");
  });

  it("provides enqueueRefresh to trigger data reload", async () => {
    const { result } = renderHook(() => useClipboardData());
    act(() => { result.current.enqueueRefresh(); });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("accepts kindFilter option", () => {
    const { result } = renderHook(() => useClipboardData({ kindFilter: "image" }));
    expect(result.current.items).toEqual([]);
  });

  it("accepts pinnedOnly option", () => {
    const { result } = renderHook(() => useClipboardData({ pinnedOnly: true }));
    expect(result.current.items).toEqual([]);
  });

  it("selectedItem is null when no items", () => {
    const { result } = renderHook(() => useClipboardData());
    expect(result.current.selectedItem).toBeNull();
  });
});
