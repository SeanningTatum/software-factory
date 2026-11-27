import type { ComponentProps } from "react";
import { cn } from "#/features/core/ui/lib/cn.ts";

export function Label({ className, htmlFor, children, ...props }: ComponentProps<"label">) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-sm font-medium leading-none", className)}
      {...props}
    >
      {children}
    </label>
  );
}
