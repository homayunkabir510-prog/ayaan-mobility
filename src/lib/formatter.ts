import type { Prisma } from "@prisma/client";

// Format currency in BDT. Accepts a plain number (e.g. from a Server
// Action's return value) or a Prisma Decimal (e.g. from a raw query result
// passed straight into a component) so callers never have to remember to
// convert first.
export function formatCurrency(value: number | Prisma.Decimal): string {
  const numericValue = typeof value === "number" ? value : value.toNumber();
  return `৳ ${numericValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

// Format duration in hours and minutes
export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Format date as "Aug 30, 2026"
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Format datetime as "Aug 30, 2026 10:30 AM"
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format time as "10:30 AM"
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
