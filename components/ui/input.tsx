import * as React from "react";

import { cn } from "@/lib/helpers/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] " +
            "shadow-sm placeholder:text-[var(--text-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
