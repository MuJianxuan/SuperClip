import { useEffect, useRef } from "react";
import { Check, TriangleAlert, Undo2, X } from "lucide-react";

export type ToastTone = "success" | "warning" | "undo";

export interface ToastState {
  /** 唯一 id：同一 id 重复设置只重置计时，不重放动画 */
  id: number;
  tone: ToastTone;
  message: string;
  /** tone === "undo" 时展示的撤销动作 */
  onUndo?: () => void;
  /** 自动消失时长（默认 5000ms） */
  timeoutMs?: number;
}

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * 统一 Toast：成功（深底）/ 降级（琥珀描边）/ 可撤销（深底 + 蓝色撤销链接）三态。
 * 同一时刻只显示一个（由调用方保证），默认 5 秒后自动消失。
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutMs = toast.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = window.setTimeout(() => dismissRef.current(), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const isWarning = toast.tone === "warning";

  return (
    <div
      data-testid="superclip-toast"
      data-tone={toast.tone}
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-center gap-[9px] rounded-[10px] px-3 py-[11px] text-[12px] shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
      style={{
        background: isWarning ? "var(--bg-window-solid, #14161a)" : "rgba(38, 40, 45, 0.96)",
        color: isWarning ? "var(--text-primary)" : "#fff",
        border: isWarning
          ? "1px solid var(--warn)"
          : "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {toast.tone === "success" ? (
        <Check className="h-[14px] w-[14px] shrink-0" />
      ) : toast.tone === "warning" ? (
        <TriangleAlert className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--warn)" }} />
      ) : (
        <X className="h-[14px] w-[14px] shrink-0" />
      )}

      <span className="min-w-0 flex-1 truncate">{toast.message}</span>

      {toast.tone === "undo" && toast.onUndo ? (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            onDismiss();
          }}
          className="ml-1 flex shrink-0 items-center gap-1 font-semibold"
          style={{
            color: "var(--accent-text)",
            borderBottom: "1px solid color-mix(in srgb, var(--accent-text) 50%, transparent)",
          }}
        >
          <Undo2 className="h-[12px] w-[12px]" />
          撤销
        </button>
      ) : null}
    </div>
  );
}
