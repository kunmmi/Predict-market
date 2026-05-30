import * as React from "react";

import { cn } from "@/lib/helpers/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
      default:
        "bg-[var(--gold-dim)] text-[var(--gold)] ring-1 ring-[var(--border-gold)]",
      secondary:
        "bg-[var(--bg-elevated)] text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]",
      destructive:
        "bg-[var(--rose-dim)] text-[var(--rose)] ring-1 ring-[rgba(242,56,96,0.25)]",
      outline:
        "border border-[var(--border-strong)] bg-transparent text-[var(--text-secondary)]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium font-mono tracking-wide uppercase",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";
