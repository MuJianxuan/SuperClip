import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Toast, type ToastState } from "./toast";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when toast is null", () => {
    const { container } = render(<Toast toast={null} onDismiss={() => {}} />);
    expect(container.firstElementChild).toBeNull();
  });

  it("renders success tone", () => {
    const toast: ToastState = { id: 1, tone: "success", message: "已复制到剪贴板" };
    render(<Toast toast={toast} onDismiss={() => {}} />);
    const el = screen.getByTestId("superclip-toast");
    expect(el).toHaveAttribute("data-tone", "success");
    expect(el.textContent).toContain("已复制到剪贴板");
    expect(el.querySelector(".lucide-check")).not.toBeNull();
  });

  it("renders warning tone with amber border", () => {
    const toast: ToastState = { id: 1, tone: "warning", message: "富文本已降级为纯文本" };
    render(<Toast toast={toast} onDismiss={() => {}} />);
    const el = screen.getByTestId("superclip-toast");
    expect(el).toHaveAttribute("data-tone", "warning");
    expect(el.style.border).toContain("var(--warn)");
    expect(el.querySelector(".lucide-triangle-alert")).not.toBeNull();
  });

  it("renders undo tone with an undo action that fires callback then dismisses", () => {
    const onUndo = vi.fn();
    const onDismiss = vi.fn();
    const toast: ToastState = { id: 1, tone: "undo", message: "已删除 1 条", onUndo };
    render(<Toast toast={toast} onDismiss={onDismiss} />);

    expect(screen.getByTestId("superclip-toast")).toHaveAttribute("data-tone", "undo");
    fireEvent.click(screen.getByText("撤销"));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto dismisses after 5 seconds by default", () => {
    const onDismiss = vi.fn();
    render(<Toast toast={{ id: 1, tone: "success", message: "ok" }} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("honours a custom timeout", () => {
    const onDismiss = vi.fn();
    render(
      <Toast toast={{ id: 1, tone: "success", message: "ok", timeoutMs: 1000 }} onDismiss={onDismiss} />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("same mounted toast does not re-arm timers when only the callback identity changes", () => {
    const first = vi.fn();
    const second = vi.fn();
    const toast: ToastState = { id: 1, tone: "success", message: "ok" };
    const { rerender } = render(<Toast toast={toast} onDismiss={first} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    rerender(<Toast toast={toast} onDismiss={second} />);
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    // 计时以 toast 对象 identity 为准，不因回调变化而重置
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
