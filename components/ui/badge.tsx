import * as React from "react";

import { cn } from "@/lib/helpers/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
      default: "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200",
      secondary: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
      destructive: "bg-red-600 text-white",
      outline: "border border-slate-300 bg-white text-slate-700",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";
