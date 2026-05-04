import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  writable: true,
  value: vi.fn(),
});

if (!("ImageData" in window)) {
  class ImageDataMock {
    data: Uint8ClampedArray;
    width: number;
    height: number;

    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  }

  Object.defineProperty(window, "ImageData", {
    writable: true,
    value: ImageDataMock,
  });

  Object.defineProperty(globalThis, "ImageData", {
    writable: true,
    value: ImageDataMock,
  });
}

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  writable: true,
  value: vi.fn(() => ({
    putImageData: vi.fn(),
  })),
});

Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
  writable: true,
  value: vi.fn(() => "data:image/png;base64,superclip-test"),
});
