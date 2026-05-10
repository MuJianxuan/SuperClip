import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetSuperClipFallbackForTests,
  clipboardGet,
  clipboardSearch,
  previewHide,
  previewShow,
  sessionUiStateGet,
  sessionUiStateUpdate,
  showMain,
  windowPlacementRefresh,
} from "./superclip";

describe("superclip browser fallback", () => {
  beforeEach(() => {
    __resetSuperClipFallbackForTests();
  });

  it("returns full detail payloads for preview types", async () => {
    const textDetail = await clipboardGet("clip-1");
    const htmlDetail = await clipboardGet("clip-2");
    const imageDetail = await clipboardGet("clip-3");
    const fileDetail = await clipboardGet("clip-4");
    const rtfDetail = await clipboardGet("clip-5");

    expect(textDetail.payload.textPlain).toContain("完整多行内容");
    expect(htmlDetail.payload.textHtml).toContain("<strong>");
    expect(imageDetail.payload.imageBytes).toHaveLength(64);
    expect(imageDetail.payload.imageWidth).toBe(4);
    expect(fileDetail.payload.fileUrls).toHaveLength(6);
    expect(rtfDetail.payload.textRtf).toContain("\\rtf1");
  });

  it("searches summaries without mutating detail payloads", async () => {
    const response = await clipboardSearch("诊断");
    const detail = await clipboardGet("clip-2");

    expect(response.results.some((item) => item.id === "clip-2")).toBe(true);
    expect(detail.payload.textPlain).toContain("HTML 原文不会直接渲染");
  });

  it("keeps session and runtime state aligned in fallback mode", async () => {
    const updated = await sessionUiStateUpdate({
      query: "发布",
      selectedItemId: "clip-3",
      scrollAnchor: "clip-2",
      layoutSidebarWidthPx: 320,
      lastDisplayId: "browser-test",
      lastWindowMode: "large_window",
    });
    const restored = await sessionUiStateGet();

    expect(updated.selectedItemId).toBe("clip-3");
    expect(restored.restoredFromSession).toBe(true);
    expect(restored.presentationReason).toBe("manual_open");
    expect(restored.lastWindowMode).toBe("large_window");
    expect(restored.layoutSidebarWidthPx).toBe(320);
  });

  it("derives fallback window mode from viewport size", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 700 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });

    const state = await windowPlacementRefresh();

    expect(state.lastWindowMode).toBe("fallback_window");
    expect(state.fallbackReason).toBe("safe_area_fallback");
  });

  it("showMain resolves without error in fallback mode", async () => {
    await expect(showMain()).resolves.toBeUndefined();
  });

  it("previewShow resolves without error in fallback mode", async () => {
    await expect(previewShow(100, 200, 280, 320)).resolves.toBeUndefined();
  });

  it("previewHide resolves without error in fallback mode", async () => {
    await expect(previewHide()).resolves.toBeUndefined();
  });
});
