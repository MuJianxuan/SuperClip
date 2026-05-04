import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

type StatusTone = "neutral" | "success" | "warning";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
  success: "border-transparent bg-[var(--success-bg)] text-[var(--success-text)]",
  warning: "border-transparent bg-[var(--warning-bg)] text-[var(--warning-text)]",
};

interface StatusPillProps {
  icon: LucideIcon;
  label: string;
  tone?: StatusTone;
}

export function StatusPill({ icon: Icon, label, tone = "neutral" }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1 text-[11px] font-medium",
        toneClasses[tone],
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
