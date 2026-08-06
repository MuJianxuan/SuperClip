import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "../../lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-[rgba(255,255,255,0.1)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--border-strong)] data-[state=checked]:bg-[rgba(56,189,248,0.85)] data-[state=checked]:shadow-[0_0_10px_rgba(56,189,248,0.25)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]",
      className,
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb className="pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-[cubic-bezier(0.25,1.2,0.4,1)] data-[state=checked]:translate-x-[16px]" style={{ marginLeft: 2 }} />
  </SwitchPrimitives.Root>
));

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
