import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import {
  __resetSuperClipFallbackForTests,
  sessionUiStateGet,
  sessionUiStateUpdate,
} from "./lib/superclip";
import { HistoryRow, type ClipboardItem } from "./components/history-row";

const tauriListeners = new Map<string, Array<(event: { payload: unknown }) => void>>();

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((eventName: string, handler: (event: { payload: unknown }) => void) => {
    const handlers = tauriListeners.get(eventName) ?? [];
    handlers.push(handler);
    tauriListeners.set(eventName, handlers);

    return Promise.resolve(() => {
      const nextHandlers = (tauriListeners.get(eventName) ?? []).filter((candidate) => candidate !== handler);
      tauriListeners.set(eventName, nextHandlers);
    });
  }),
}));

function renderApp() {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

  return render(<App />);
}

describe("App detail preview", () => {
  beforeEach(() => {
    __resetSuperClipFallbackForTests();
    tauriListeners.clear();
    invokeMock.mockReset();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("renders compact history rows and lets CSS truncate by available width", () => {
    const item: ClipboardItem = {
      id: "clip-long-title",
      kind: "html",
      title: "abcdefghijklmnopqrstuv",
      preview: "这段摘要不应该出现在左侧列表",
      sourceApp: "Safari",
      meta: "HTML · 22 chars",
      timeLabel: "刚刚",
      isPinned: true,
    };

    render(<HistoryRow item={item} selected={false} onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: /HTML abcdefghijklmnopqrstuv 置顶/i })).toHaveAttribute(
      "title",
      item.title,
    );
    expect(screen.getByText(item.title)).toHaveClass("truncate");
    expect(screen.queryByText(item.preview)).not.toBeInTheDocument();
    expect(screen.queryByText(item.sourceApp)).not.toBeInTheDocument();
    expect(screen.queryByText(item.timeLabel)).not.toBeInTheDocument();
    expect(screen.queryByText("HTML")).not.toBeInTheDocument();
  });

  it("renders the selected history row as a lightweight short indicator", () => {
    const item: ClipboardItem = {
      id: "clip-selected",
      kind: "text",
      title: "轻量选中态",
      preview: "不会作为左侧摘要展示",
      sourceApp: "Notes",
      meta: "Text · 5 chars",
      timeLabel: "刚刚",
      isPinned: false,
    };

    render(<HistoryRow item={item} selected={true} onSelect={vi.fn()} />);

    const row = screen.getByRole("button", { name: /Text 轻量选中态/i });
    expect(row).toHaveClass("before:h-5");
    expect(row).not.toHaveClass("shadow-[var(--shadow-soft)]");
    expect(row).not.toHaveClass("bg-[var(--surface)]");
    expect(screen.getByText(item.title)).toHaveClass("truncate");
  });

  it("changes rendered history title length from the available sidebar width budget", () => {
    const item: ClipboardItem = {
      id: "clip-resizable-title",
      kind: "text",
      title: "abcdefghijklmnopqrstuvwxyz",
      preview: "不会作为左侧摘要展示",
      sourceApp: "Notes",
      meta: "Text · 26 chars",
      timeLabel: "刚刚",
      isPinned: false,
    };

    const { rerender } = render(
      <HistoryRow item={item} selected={false} onSelect={vi.fn()} titleMaxUnits={10} />,
    );

    expect(screen.getByText("abcdefg...")).toBeInTheDocument();
    expect(screen.queryByText(item.title)).not.toBeInTheDocument();

    rerender(<HistoryRow item={item} selected={false} onSelect={vi.fn()} titleMaxUnits={18} />);

    expect(screen.getByText("abcdefghijklmno...")).toBeInTheDocument();
  });

  it("loads selected item detail instead of only rendering the list summary", async () => {
    renderApp();

    const preview = await screen.findByTestId("detail-preview");

    expect(await within(preview).findByText(/TEXT 详情/)).toBeInTheDocument();
    expect(within(preview).getByText(/完整多行内容/)).toBeInTheDocument();
    expect(within(preview).queryByText(/先验证壳体与焦点行为/)).not.toBeInTheDocument();
  });

  it("restores and persists the resizable home column width", async () => {
    await sessionUiStateUpdate({
      query: "",
      selectedItemId: null,
      scrollAnchor: null,
      layoutSidebarWidthPx: 360,
      lastDisplayId: "browser-test",
      lastWindowMode: "large_window",
    });

    renderApp();

    const resizer = await screen.findByTestId("layout-resizer");
    const workspace = resizer.closest("[data-layout-workspace]");

    expect(workspace).toHaveStyle({ "--sidebar-width": "360px" });
    await waitFor(() => expect(resizer).toHaveAttribute("aria-valuenow", "360"));

    fireEvent.pointerDown(resizer, { pointerId: 1, clientX: 360 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 460 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 460 });

    await waitFor(async () => {
      const restored = await sessionUiStateGet();
      expect(restored.layoutSidebarWidthPx).toBe(420);
    });
    expect(workspace).toHaveStyle({ "--sidebar-width": "420px" });
    expect(resizer).toHaveAttribute("aria-valuenow", "420");
  });

  it("clamps restored home column width to the safe minimum", async () => {
    await sessionUiStateUpdate({
      query: "",
      selectedItemId: null,
      scrollAnchor: null,
      layoutSidebarWidthPx: 120,
      lastDisplayId: "browser-test",
      lastWindowMode: "large_window",
    });

    renderApp();

    expect(await screen.findByTestId("layout-resizer")).toHaveAttribute("aria-valuenow", "220");
  });

  it("renders file detail paths and folds files beyond the first five", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: /交付清单\.pdf/i }));

    const preview = await screen.findByTestId("detail-preview");

    expect(await within(preview).findByText("FILE 详情")).toBeInTheDocument();
    expect(within(preview).getByText("6 个文件")).toBeInTheDocument();
    expect(within(preview).getByText("演示脚本.md")).toBeInTheDocument();
    expect(within(preview).getByText("另有 1 个文件已折叠。")).toBeInTheDocument();
  });

  it("renders image payload as an image preview with dimensions", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: /发布预览截图/i }));

    const preview = await screen.findByTestId("detail-preview");

    expect(await within(preview).findByText("IMAGE 详情")).toBeInTheDocument();
    expect(within(preview).getByText("4×4")).toBeInTheDocument();
    expect(within(preview).getByRole("img", { name: "发布预览截图" })).toHaveAttribute(
      "src",
      "data:image/png;base64,superclip-test",
    );
  });

  it("renders a generated preview image when a large image detail omits the full blob", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });

    const largeImageItem: ClipboardItem = {
      id: "clip-large-image",
      kind: "image",
      title: "大图剪贴板",
      preview: "读取到 1492×1410 图片。",
      sourceApp: "System Clipboard",
      timeLabel: "刚刚",
      meta: "Image · 1492×1410",
      isPinned: false,
    };

    invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === "settings_get") {
        return Promise.resolve({
          schemaVersion: 1,
          exposedKeys: [],
          reservedKeys: [],
          defaultAction: "direct_paste",
          themeMode: "system",
          historyLimit: 1000,
          launchAtLogin: false,
          showOnStartup: false,
        });
      }

      if (command === "rules_list") {
        return Promise.resolve({ rules: [], total: 0, enabledCount: 0, version: 1 });
      }

      if (command === "shortcut_get") {
        return Promise.resolve({
          binding: "Cmd+Shift+V",
          isRegistered: true,
          source: "default",
          version: 1,
        });
      }

      if (command === "permission_check_accessibility") {
        return Promise.resolve({ accessibilityTrusted: true, checkedAt: "2026-05-04T00:00:00+08:00" });
      }

      if (command === "window_placement_refresh" || command === "runtime_state_get") {
        return Promise.resolve({
          presentationReason: "manual_open",
          lastDisplayId: "main",
          lastWindowMode: "large_window",
          fallbackReason: null,
          migrationPhase: "ready",
          isRecoveryMode: false,
          restoredFromSession: false,
          updatedAt: "2026-05-04T00:00:00+08:00",
        });
      }

      if (command === "session_ui_state_get" || command === "session_ui_state_update") {
        return Promise.resolve({
          query: "",
          selectedItemId: "clip-large-image",
          scrollAnchor: null,
          layoutSidebarWidthPx: null,
          presentationReason: "manual_open",
          lastDisplayId: "main",
          lastWindowMode: "large_window",
          restoredFromSession: false,
          updatedAt: "2026-05-04T00:00:00+08:00",
        });
      }

      if (command === "clipboard_search") {
        return Promise.resolve({
          query: String(args?.query ?? ""),
          normalizedQuery: String(args?.query ?? ""),
          results: [largeImageItem],
          total: 1,
          searchTimeMs: 1,
          version: 1,
        });
      }

      if (command === "clipboard_get") {
        return Promise.resolve({
          item: largeImageItem,
          payload: {
            textPlain: null,
            textHtml: null,
            textRtf: null,
            imageBytes: null,
            imageWidth: 1492,
            imageHeight: 1410,
            fileUrls: null,
            extraJson: {
              previewImage: {
                bytes: [
                  255, 0, 0, 255, 0, 255, 0, 255,
                  0, 0, 255, 255, 255, 255, 255, 255,
                ],
                width: 2,
                height: 2,
                format: "rgba8",
              },
            },
          },
          version: 1,
        });
      }

      return Promise.resolve({});
    });

    renderApp();

    const preview = await screen.findByTestId("detail-preview");

    expect(await within(preview).findByText("IMAGE 详情")).toBeInTheDocument();
    expect(within(preview).getByText("1492×1410")).toBeInTheDocument();
    expect(within(preview).getByRole("img", { name: "大图剪贴板" })).toHaveAttribute(
      "src",
      "data:image/png;base64,superclip-test",
    );
    expect(within(preview).queryByText(/无法生成缩略图/)).not.toBeInTheDocument();
  });

  it("renders html and rtf as trusted plain text details", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: /客户邮件摘要/i }));
    let preview = await screen.findByTestId("detail-preview");
    expect(await within(preview).findByText("HTML 详情")).toBeInTheDocument();
    expect(within(preview).getByText(/HTML 原文不会直接渲染/)).toBeInTheDocument();
    expect(within(preview).getByText("富文本仅显示可信纯文本摘要。")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /会议纪要片段/i }));
    preview = await screen.findByTestId("detail-preview");
    expect(await within(preview).findByText("RTF 详情")).toBeInTheDocument();
    expect(within(preview).getByText(/RTF 内容在预览区按纯文本展示/)).toBeInTheDocument();
  });

  it("does not run the primary action when Enter is pressed in the search field", async () => {
    const user = userEvent.setup();
    renderApp();

    const search = await screen.findByPlaceholderText("搜索剪贴板");
    await user.type(search, "发布命令片段{Enter}");

    await waitFor(() => {
      expect(screen.queryByText("已直接执行")).not.toBeInTheDocument();
      expect(screen.queryByText("已复制到剪贴板")).not.toBeInTheDocument();
    });
  });

  it("does not render shortcut hints as an inline header row on click", async () => {
    const user = userEvent.setup();
    renderApp();

    const shortcutButton = await screen.findByRole("button", { name: "快捷键提示" });

    await user.click(shortcutButton);

    expect(shortcutButton).not.toHaveAttribute("aria-expanded");
    expect(screen.queryByText("↑↓ 切换")).not.toBeInTheDocument();
    expect(screen.queryByText("Cmd+Enter 相反动作")).not.toBeInTheDocument();
  });

  it("refreshes the visible history when the backend reports a clipboard monitor insert", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });

    const firstItem: ClipboardItem = {
      id: "clip-live-1",
      kind: "text",
      title: "第一次复制",
      preview: "初始剪贴板内容",
      sourceApp: "Safari",
      timeLabel: "刚刚",
      meta: "text",
      isPinned: false,
    };
    const insertedItem: ClipboardItem = {
      id: "clip-live-2",
      kind: "text",
      title: "即时复制内容",
      preview: "来自其他应用的新内容",
      sourceApp: "Notes",
      timeLabel: "刚刚",
      meta: "text",
      isPinned: false,
    };
    let liveItems = [firstItem];

    invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === "settings_get") {
        return Promise.resolve({
          schemaVersion: 1,
          exposedKeys: [],
          reservedKeys: [],
          defaultAction: "direct_paste",
          themeMode: "system",
          historyLimit: 1000,
          launchAtLogin: false,
          showOnStartup: false,
        });
      }

      if (command === "rules_list") {
        return Promise.resolve({ rules: [], total: 0, enabledCount: 0, version: 1 });
      }

      if (command === "shortcut_get") {
        return Promise.resolve({
          binding: "Cmd+Shift+V",
          isRegistered: true,
          source: "default",
          version: 1,
        });
      }

      if (command === "permission_check_accessibility") {
        return Promise.resolve({ accessibilityTrusted: true, checkedAt: "2026-05-04T00:00:00+08:00" });
      }

      if (command === "window_placement_refresh" || command === "runtime_state_get") {
        return Promise.resolve({
          presentationReason: "manual_open",
          lastDisplayId: "main",
          lastWindowMode: "large_window",
          fallbackReason: null,
          migrationPhase: "ready",
          isRecoveryMode: false,
          restoredFromSession: false,
          updatedAt: "2026-05-04T00:00:00+08:00",
        });
      }

      if (command === "session_ui_state_get" || command === "session_ui_state_update") {
        return Promise.resolve({
          query: "",
          selectedItemId: null,
          scrollAnchor: null,
          layoutSidebarWidthPx: null,
          presentationReason: "manual_open",
          lastDisplayId: "main",
          lastWindowMode: "large_window",
          restoredFromSession: false,
          updatedAt: "2026-05-04T00:00:00+08:00",
        });
      }

      if (command === "clipboard_search") {
        const query = String(args?.query ?? "").toLowerCase();
        const results = liveItems.filter((item) =>
          `${item.title} ${item.preview} ${item.sourceApp}`.toLowerCase().includes(query),
        );

        return Promise.resolve({
          query,
          normalizedQuery: query,
          results,
          total: results.length,
          searchTimeMs: 1,
          version: 1,
        });
      }

      if (command === "clipboard_get") {
        const item = liveItems.find((candidate) => candidate.id === args?.id) ?? firstItem;

        return Promise.resolve({
          item,
          payload: {
            textPlain: item.preview,
            textHtml: null,
            textRtf: null,
            imageBytes: null,
            imageWidth: null,
            imageHeight: null,
            fileUrls: null,
            extraJson: null,
          },
          version: 1,
        });
      }

      return Promise.resolve({});
    });

    renderApp();

    expect(await screen.findByRole("button", { name: /第一次复制/i })).toBeInTheDocument();

    liveItems = [insertedItem, firstItem];
    tauriListeners.get("history-updated")?.forEach((handler) =>
      handler({ payload: { reason: "monitor_insert" } }),
    );

    expect(await screen.findByRole("button", { name: /即时复制内容/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /即时复制内容/i }));
    expect(await within(await screen.findByTestId("detail-preview")).findByText(/来自其他应用的新内容/)).toBeInTheDocument();
  });
});
