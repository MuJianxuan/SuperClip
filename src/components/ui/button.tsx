import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--border-strong)] disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border-strong)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] hover:opacity-95",
        secondary:
          "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:bg-[var(--surface)]",
        ghost:
          "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
        danger:
          "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)] hover:bg-[rgba(239,68,68,0.18)]",
      },
      size: {
        default: "h-9 px-3.5 py-2 text-sm",
        sm: "h-8 px-3 py-1.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
