import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PreviewApp } from "./PreviewApp";

const mockEmit = vi.fn((_event: string, _payload?: unknown) => Promise.resolve());
const mockListen = vi.fn((event: string, handler: (e: unknown) => void) => {
  if (event === "preview:show") {
    listenHandler = handler;
  }
  return Promise.resolve(() => {});
});

let listenHandler: ((e: unknown) => void) | null = null;

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...(args as [string, (e: unknown) => void])),
  emit: (...args: unknown[]) => mockEmit(...(args as [string, unknown?])),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

Object.defineProperty(window, "__TAURI_INTERNALS__", {
  value: {},
  writable: true,
  configurable: true,
});

describe("PreviewApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listenHandler = null;
  });

  it("renders empty state when no item", () => {
    const { container } = render(<PreviewApp />);
    const root = container.firstElementChild;
    expect(root?.children.length).toBe(0);
  });

  it("renders item content after preview:show event", async () => {
    render(<PreviewApp />);

    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    listenHandler!({
      payload: {
        item: {
          id: "clip-1",
          kind: "text",
          title: "Test Title",
          preview: "Preview content here",
          sourceApp: "Terminal",
          meta: "",
          timeLabel: "2s前",
          isPinned: false,
          matchType: null,
          matchedFields: [],
          highlightRanges: [],
        },
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByText("text")).toBeInTheDocument();
    });
    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.getByText("Preview content here")).toBeInTheDocument();
    expect(screen.getByText("2s前")).toBeInTheDocument();
  });

  it("renders image placeholder for image kind", async () => {
    render(<PreviewApp />);

    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    listenHandler!({
      payload: {
        item: {
          id: "clip-2",
          kind: "image",
          title: "Screenshot",
          preview: "",
          sourceApp: "Finder",
          meta: "1920x1080 PNG",
          timeLabel: "5m前",
          isPinned: false,
          matchType: null,
          matchedFields: [],
          highlightRanges: [],
        },
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByText("1920x1080 PNG")).toBeInTheDocument();
    });
  });

  it("emits preview:mouse-enter on mouse enter", async () => {
    render(<PreviewApp />);

    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    listenHandler!({
      payload: {
        item: {
          id: "clip-1",
          kind: "text",
          title: "Test",
          preview: "content",
          sourceApp: "App",
          meta: "",
          timeLabel: "1s前",
          isPinned: false,
          matchType: null,
          matchedFields: [],
          highlightRanges: [],
        },
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByText("content")).toBeInTheDocument();
    });

    const container = screen.getByText("content").closest("[class*='h-screen']")!;
    fireEvent.mouseEnter(container);

    expect(mockEmit).toHaveBeenCalledWith("preview:mouse-enter");
  });

  it("emits preview:mouse-leave on mouse leave", async () => {
    render(<PreviewApp />);

    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    listenHandler!({
      payload: {
        item: {
          id: "clip-1",
          kind: "text",
          title: "Test",
          preview: "content",
          sourceApp: "App",
          meta: "",
          timeLabel: "1s前",
          isPinned: false,
          matchType: null,
          matchedFields: [],
          highlightRanges: [],
        },
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByText("content")).toBeInTheDocument();
    });

    const container = screen.getByText("content").closest("[class*='h-screen']")!;
    fireEvent.mouseLeave(container);

    expect(mockEmit).toHaveBeenCalledWith("preview:mouse-leave");
  });
});
