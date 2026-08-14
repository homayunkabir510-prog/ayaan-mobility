import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges conditional class names and resolves conflicting Tailwind utility
 * classes (e.g. "px-2" vs "px-4") in favor of the one that appears last.
 * Used by every shadcn/ui component generated into src/components/ui.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
