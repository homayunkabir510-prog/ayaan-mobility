import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps {
  variant?: "approved" | "pending" | "rejected" | "default";
  children: ReactNode;
  className?: string;
}

const variantClasses = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  default: "bg-gray-100 text-gray-800",
};

const Badge = ({ variant = "default", children, className }: BadgeProps) => (
  <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs font-medium", variantClasses[variant], className)}>
    {children}
  </span>
);

export default Badge;
