"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "./utils";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const safeValue = typeof value === "number" && !Number.isNaN(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      value={safeValue}
      max={100}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="bg-primary h-full transition-all duration-500"
        style={{ width: `${safeValue}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
