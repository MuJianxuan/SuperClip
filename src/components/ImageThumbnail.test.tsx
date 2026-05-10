import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockClipboardGet = vi.fn();
const mockResolveImageDataUrl = vi.fn();

vi.mock("../lib/superclip", () => ({
  clipboardGet: (...args: unknown[]) => mockClipboardGet(...args),
}));

vi.mock("../lib/image-utils", () => ({
  resolveImageDataUrl: (...args: unknown[]) => mockResolveImageDataUrl(...args),
}));

import { ImageThumbnail } from "./ImageThumbnail";

describe("ImageThumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveImageDataUrl.mockReturnValue(null);
  });

  it("shows loading skeleton initially", () => {
    mockClipboardGet.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ImageThumbnail itemId="clip-loading-1" />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders image after successful load", async () => {
    mockClipboardGet.mockResolvedValue({
      item: { id: "clip-img-ok" },
      payload: { imageBytes: [1, 2, 3, 4], imageWidth: 1, imageHeight: 1 },
    });
    mockResolveImageDataUrl.mockReturnValue("data:image/png;base64,test");

    render(<ImageThumbnail itemId="clip-img-ok" />);

    await waitFor(() => {
      expect(screen.getByAltText("thumbnail")).toBeInTheDocument();
    });
    expect(screen.getByAltText("thumbnail")).toHaveAttribute("src", "data:image/png;base64,test");
  });

  it("calls clipboardGet with the correct itemId", async () => {
    mockClipboardGet.mockResolvedValue({
      item: { id: "clip-check-id" },
      payload: { imageBytes: [1], imageWidth: 1, imageHeight: 1 },
    });
    mockResolveImageDataUrl.mockReturnValue("data:image/png;base64,ok");

    render(<ImageThumbnail itemId="clip-check-id" />);

    await waitFor(() => {
      expect(mockClipboardGet).toHaveBeenCalledWith("clip-check-id");
    });
  });

  it("passes payload to resolveImageDataUrl", async () => {
    const payload = { imageBytes: [1, 2], imageWidth: 2, imageHeight: 1 };
    mockClipboardGet.mockResolvedValue({ item: { id: "clip-pass" }, payload });
    mockResolveImageDataUrl.mockReturnValue("data:image/png;base64,pass");

    render(<ImageThumbnail itemId="clip-pass" />);

    await waitFor(() => {
      expect(mockResolveImageDataUrl).toHaveBeenCalledWith(payload);
    });
  });

  it("shows error icon when resolveImageDataUrl returns null and retries exhausted", async () => {
    mockClipboardGet.mockImplementation(() => Promise.resolve({
      item: { id: "clip-fail-final" },
      payload: { imageBytes: null, imageWidth: null, imageHeight: null, extraJson: null },
    }));
    mockResolveImageDataUrl.mockReturnValue(null);

    const { container } = render(<ImageThumbnail itemId="clip-fail-final" />);

    // Wait for retries to exhaust (1 retry * 3s delay + buffer)
    await waitFor(
      () => { expect(container.querySelector("svg")).toBeTruthy(); },
      { timeout: 5000 },
    );
    // Should have been called twice (initial + 1 retry)
    expect(mockClipboardGet).toHaveBeenCalledTimes(2);
  });

  it("retries on network error and succeeds on second attempt", async () => {
    let callCount = 0;
    mockClipboardGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("network"));
      return Promise.resolve({
        item: { id: "clip-retry-net" },
        payload: { imageBytes: [1], imageWidth: 1, imageHeight: 1 },
      });
    });
    mockResolveImageDataUrl.mockImplementation((p) =>
      p?.imageBytes ? "data:image/png;base64,retried" : null
    );

    render(<ImageThumbnail itemId="clip-retry-net" />);

    await waitFor(
      () => { expect(screen.getByAltText("thumbnail")).toBeInTheDocument(); },
      { timeout: 5000 },
    );
    expect(callCount).toBe(2);
  });

  it("resets failed state when itemId changes", async () => {
    // First item fails
    mockClipboardGet.mockResolvedValue({
      item: { id: "clip-a2" },
      payload: { imageBytes: null, imageWidth: null, imageHeight: null, extraJson: null },
    });
    mockResolveImageDataUrl.mockReturnValue(null);

    const { container, rerender } = render(<ImageThumbnail itemId="clip-a2" />);

    await waitFor(
      () => { expect(container.querySelector("svg")).toBeTruthy(); },
      { timeout: 5000 },
    );

    // Change to a new item that succeeds
    mockClipboardGet.mockResolvedValue({
      item: { id: "clip-b2" },
      payload: { imageBytes: [1], imageWidth: 1, imageHeight: 1 },
    });
    mockResolveImageDataUrl.mockReturnValue("data:image/png;base64,b2");

    rerender(<ImageThumbnail itemId="clip-b2" />);

    await waitFor(() => {
      expect(screen.getByAltText("thumbnail")).toBeInTheDocument();
    });
  });
});
