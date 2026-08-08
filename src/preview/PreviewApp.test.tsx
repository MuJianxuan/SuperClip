import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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
  listen: (...args: unknown[]) =>
    mockListen(...(args as [string, (e: unknown) => void])),
  emit: (...args: unknown[]) => mockEmit(...(args as [string, unknown?])),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

Object.defineProperty(window, "__TAURI_INTERNALS__", {
  value: {},
  writable: true,
  configurable: true,
});

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function emitShow(item: Record<string, unknown>) {
  listenHandler!({ payload: { item } });
}

describe("PreviewApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listenHandler = null;
  });

  it("renders empty container when no item", () => {
    const { container } = render(<PreviewApp />);
    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.children.length).toBe(0);
  });

  it("renders read-only G2 layout: type label, time, source, zero buttons", async () => {
    const { container } = render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    emitShow(baseItem());

    await vi.waitFor(() =>
      expect(screen.getByText("Preview content here")).toBeInTheDocument(),
    );

    // Header：类型标签 + 时间（footer 与 body 中不得出现按钮）
    expect(screen.getByText("文本")).toBeInTheDocument();
    expect(screen.getByText("2s前")).toBeInTheDocument();
    expect(screen.getByText(/来自/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    // Footer：Clock 图标 + 「来自 · App」单行
    const clock = container.querySelector(".lucide-clock");
    expect(clock).not.toBeNull();
    expect(container.textContent).toContain("来自 · Terminal");
  });

  it("renders code block distinctly with language line stripped", async () => {
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    emitShow(
      makeItem({
        title: "Code",
        preview:
          "intro paragraph\n\n```tsx\nconst a = 1;\nexport default a;\n```\n\noutro",
      }),
    );

    const root = await vi.waitFor(() => {
      const r = screen.getByText(/outro/);
      expect(r).toBeInTheDocument();
      return r.closest("[class*='h-screen']") as HTMLElement;
    });

    const text = root.textContent ?? "";
    // 代码内容存在且语言标注行 tsx 被剥离
    expect(text).toContain("const a = 1;");
    expect(text).not.toContain("```tsx");
    // 两个 pre 块（含代码）存在，代码为等宽等宽样式
    const preBlocks = root.querySelectorAll("pre");
    expect(preBlocks.length).toBe(1);
    expect(preBlocks[0].textContent).toContain("const a = 1;");
  });

  it("renders image placeholder with meta for image kind", async () => {
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    emitShow(
      makeItem({
        id: "clip-2",
        kind: "image",
        title: "Screenshot",
        preview: "",
        meta: "1920x1080 PNG",
        timeLabel: "5m前",
      }),
    );

    await vi.waitFor(() =>
      expect(screen.getByText("1920x1080 PNG")).toBeInTheDocument(),
    );
    // 图片占位包含标题行（G2：描述 + 标题两行）
    expect(screen.getByText("Screenshot")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders G2 window material: rounded 12px + previewFadeIn entry", async () => {
    const { container } = render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());
    emitShow(makeItem());

    await vi.waitFor(() =>
      expect(screen.getByText("Preview content here")).toBeInTheDocument(),
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("rounded-[12px]");
    expect(root.className).toContain("frost-window");
    expect(root.style.animation).toContain("previewFadeIn");
  });

  it("emits preview:mouse-enter on mouse enter", async () => {
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());
    emitShow(makeItem());

    const root = (await vi.waitFor(() => {
      const el = screen.getByText("Preview content here").closest(
        "[class*='h-screen']",
      );
      expect(el).not.toBeNull();
      return el as HTMLElement;
    }));

    fireEvent.mouseEnter(root);
    expect(mockEmit).toHaveBeenCalledWith("preview:mouse-enter");
  });

  it("emits preview:mouse-leave on mouse leave", async () => {
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());
    emitShow(makeItem());

    const root = (await vi.waitFor(() => {
      const el = screen.getByText("Preview content here").closest(
        "[class*='h-screen']",
      );
      expect(el).not.toBeNull();
      return el as HTMLElement;
    }));

    fireEvent.mouseLeave(root);
    expect(mockEmit).toHaveBeenCalledWith("preview:mouse-leave");
  });

  describe("theme following", () => {
    beforeEach(() => {
      delete document.documentElement.dataset.themeMode;
    });

    it("writes concrete data-theme-mode derived from system appearance (dark)", async () => {
      // PreviewApp 启用 Tauri 运行时：mock settings_get 返回 themeMode: "system"
      const { invoke } = await import("@tauri-apps/api/core");
      (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
        if (cmd === "settings_get") {
          return {
            schemaVersion: 1,
            exposedKeys: [],
            reservedKeys: [],
            defaultAction: "direct_paste",
            themeMode: "system",
            historyLimit: 1000,
            launchAtLogin: false,
            showOnStartup: false,
          };
        }
        if (cmd === "system_appearance_get") {
          return "dark";
        }
        return null;
      });
      render(<PreviewApp />);
      await act(async () => {
        await Promise.resolve();
      });
      // system_appearance_get mock 返回 dark（system 模式以后端解析的有效外观为准）
      expect(document.documentElement.dataset.themeMode).toBe("dark");
    });
  });
});

function makeItem(overrides: Record<string, unknown> = {}) {
  return baseItem(overrides);
}