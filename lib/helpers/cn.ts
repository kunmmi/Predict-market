import { clsx, type ClassValue } from "clsx";

/**
 * Small className helper.
 * We keep it intentionally minimal (no tailwind-merge) for MVP.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

