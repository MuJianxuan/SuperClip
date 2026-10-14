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

    // Footer：来源 App 头像首字母 + 「来自 App」+ 元信息
    expect(screen.getByTestId("preview-source-avatar")).toHaveTextContent("T");
    expect(container.textContent).toContain("来自 Terminal");
  });

  it("renders footer metadata: size / char count / use count", async () => {
    // 字符数只在全量 payload（detail）就绪后统计：item.preview 是截断预览，
    // 拿它计数会先小后跳（R2-14）
    const invoke = (await import("@tauri-apps/api/core")).invoke as ReturnType<typeof vi.fn>;
    // invokeOrFallback 传的是后端命令名 clipboard_get（superclip.ts COMMANDS 映射）
    invoke.mockImplementation((cmd: string) =>
      cmd === "clipboard_get"
        ? Promise.resolve({
            item: baseItem({ preview: "hello world", useCount: 6, payloadSizeBytes: 1229 }),
            payload: { textPlain: "hello world" },
            version: 1,
          })
        : Promise.resolve(null),
    );
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    emitShow(
      baseItem({
        preview: "hello world",
        useCount: 6,
        payloadSizeBytes: 1229,
      }),
    );

    await vi.waitFor(() =>
      expect(screen.getByTestId("preview-meta-size")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("preview-meta-size")).toHaveTextContent("1.2 KB");
    expect(screen.getByTestId("preview-meta-chars")).toHaveTextContent("11 字符");
    expect(screen.getByTestId("preview-meta-uses")).toHaveTextContent("复制过 6 次");
    // 恢复模块级 mock，避免 impl 泄漏到后续用例（beforeEach 只 clear 调用记录不重置 impl）
    invoke.mockResolvedValue(null);
  });

  it("hide 使用次数为 0 / 体积缺失时的元信息胶囊", async () => {
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    emitShow(baseItem({ preview: "plain", useCount: 0, payloadSizeBytes: 0 }));

    await vi.waitFor(() =>
      expect(screen.getByText("plain")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("preview-meta-size")).not.toBeInTheDocument();
    expect(screen.queryByTestId("preview-meta-uses")).not.toBeInTheDocument();
  });

  it("图片类型不显示字符数，但仍显示体积与使用次数", async () => {
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    emitShow(
      baseItem({
        id: "clip-img-meta",
        kind: "image",
        title: "Screenshot",
        preview: "",
        meta: "2560 × 1600 PNG",
        useCount: 2,
        payloadSizeBytes: 862208,
      }),
    );

    await vi.waitFor(() =>
      expect(screen.getByTestId("preview-meta-size")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("preview-meta-size")).toHaveTextContent("842.0 KB");
    expect(screen.queryByTestId("preview-meta-chars")).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-meta-uses")).toHaveTextContent("复制过 2 次");
  });

  it("header 展示只读预览标识", async () => {
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());
    emitShow(baseItem());
    await vi.waitFor(() =>
      expect(screen.getByText("Preview content here")).toBeInTheDocument(),
    );
    expect(screen.getByText("只读预览")).toBeInTheDocument();
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

  it("shows truncation note for oversized stored items", async () => {
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    emitShow(baseItem({ isTruncated: true }));

    await vi.waitFor(() =>
      expect(screen.getByTestId("preview-truncated-note")).toBeInTheDocument(),
    );
  });

  it("omits truncation note for normal items", async () => {
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    emitShow(baseItem());

    await vi.waitFor(() =>
      expect(screen.getByText("Preview content here")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("preview-truncated-note")).not.toBeInTheDocument();
  });

  it("shows truncation note for oversized image items", async () => {
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    emitShow(
      baseItem({
        kind: "image",
        title: "Big screenshot",
        preview: "",
        meta: "Image · 4000×4000",
        isTruncated: true,
      }),
    );

    await vi.waitFor(() =>
      expect(screen.getByTestId("preview-truncated-note")).toBeInTheDocument(),
    );
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

  it("keeps cached detail when re-hovering the same item (no detail reset)", async () => {
    // 回归用例：同一行鼠标离开再回来（同一 item 对象再次 preview:show）时，
    // detail 应保持缓存；修复前 preview:show 无条件 setDetail(null)+effect 依赖
    // item?.id 未变不重载，导致 detail 停在 null（图片占位 / 文本回退到 preview）
    const { invoke } = await import("@tauri-apps/api/core");
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (cmd: string) => {
      if (cmd === "clipboard_get") {
        return {
          item: baseItem({ id: "clip-keep" }),
          payload: {
            textPlain: "REAL PAYLOAD TEXT",
            textHtml: null,
            textRtf: null,
            imageBytes: null,
            imageWidth: null,
            imageHeight: null,
            fileUrls: null,
            extraJson: null,
          },
          version: 1,
        };
      }
      return null;
    });
    render(<PreviewApp />);
    await vi.waitFor(() => expect(listenHandler).not.toBeNull());

    const item = makeItem({ id: "clip-keep", title: "T", preview: "FALLBACK" });
    emitShow(item);
    await vi.waitFor(() =>
      expect(screen.getByText("REAL PAYLOAD TEXT")).toBeInTheDocument(),
    );

    // 同一对象再次 emitShow：detail 应保持，不得回退到 item.preview
    emitShow(item);
    await vi.waitFor(() =>
      expect(screen.getByText("REAL PAYLOAD TEXT")).toBeInTheDocument(),
    );
    expect(screen.queryByText("FALLBACK")).not.toBeInTheDocument();
  });

  describe("flavor representation list", () => {
    it("renders stored flavors with sizes and truncation marker", async () => {
      const invoke = (await import("@tauri-apps/api/core")).invoke as ReturnType<typeof vi.fn>;
      invoke.mockImplementation((cmd: string) =>
        cmd === "clipboard_get"
          ? Promise.resolve({
              item: baseItem({ kind: "other", title: "PDF" }),
              payload: { textPlain: null },
              flavors: [
                { format: "com.adobe.pdf", sizeBytes: 4096, isTruncated: false, ordinal: 0 },
                { format: "com.apple.NSColorPboardType", sizeBytes: 1048577, isTruncated: true, ordinal: 1 },
              ],
              version: 1,
            })
          : Promise.resolve(null),
      );
      render(<PreviewApp />);
      await vi.waitFor(() => expect(listenHandler).not.toBeNull());

      emitShow(baseItem({ kind: "other", title: "PDF", preview: "PDF" }));

      await vi.waitFor(() =>
        expect(screen.getByTestId("preview-flavors")).toBeInTheDocument(),
      );
      expect(screen.getByText("com.adobe.pdf")).toBeInTheDocument();
      expect(screen.getByText("4.0 KB")).toBeInTheDocument();
      expect(screen.getByTestId("preview-flavor-truncated")).toBeInTheDocument();
      // 「其他」类型固定仅复制说明
      expect(screen.getByTestId("preview-copy-only-note")).toHaveTextContent(
        "该类型仅支持复制",
      );
      expect(screen.getByText("其他")).toBeInTheDocument();
      invoke.mockResolvedValue(null);
    });

    it("collapses the list beyond 6 entries", async () => {
      const invoke = (await import("@tauri-apps/api/core")).invoke as ReturnType<typeof vi.fn>;
      const flavors = Array.from({ length: 8 }, (_, index) => ({
        format: `com.example.flavor-${index}`,
        sizeBytes: 10,
        isTruncated: false,
        ordinal: index,
      }));
      invoke.mockImplementation((cmd: string) =>
        cmd === "clipboard_get"
          ? Promise.resolve({
              item: baseItem({ kind: "other" }),
              payload: { textPlain: null },
              flavors,
              version: 1,
            })
          : Promise.resolve(null),
      );
      render(<PreviewApp />);
      await vi.waitFor(() => expect(listenHandler).not.toBeNull());

      emitShow(baseItem({ kind: "other", title: "集合", preview: "集合" }));

      await vi.waitFor(() =>
        expect(screen.getByTestId("preview-flavors")).toBeInTheDocument(),
      );
      expect(screen.queryByText("com.example.flavor-7")).not.toBeInTheDocument();
      const toggle = screen.getByText("还有 2 种…");
      fireEvent.click(toggle);
      expect(screen.getByText("com.example.flavor-7")).toBeInTheDocument();
      invoke.mockResolvedValue(null);
    });

    it("keeps legacy details without flavors rendering unchanged", async () => {
      render(<PreviewApp />);
      await vi.waitFor(() => expect(listenHandler).not.toBeNull());

      emitShow(baseItem({ kind: "link", title: "example.com", preview: "https://example.com" }));

      await vi.waitFor(() => expect(screen.getByText("链接")).toBeInTheDocument());
      expect(screen.queryByTestId("preview-flavors")).not.toBeInTheDocument();
    });
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