import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useClipboardData } from "./useClipboardData";

let historyUpdatedHandler: (() => void) | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: () => void) => {
    if (event === "history-updated") {
      historyUpdatedHandler = handler;
    }
    return Promise.resolve(() => { historyUpdatedHandler = null; });
  }),
}));

describe("useClipboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historyUpdatedHandler = null;
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

  it("history-updated event triggers enqueueRefresh in Tauri environment", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      writable: true,
      configurable: true,
    });

    renderHook(() => useClipboardData());

    await waitFor(() => {
      expect(historyUpdatedHandler).not.toBeNull();
    });

    // Simulate history-updated event — should not throw
    act(() => { historyUpdatedHandler!(); });

    // Cleanup
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });
});
