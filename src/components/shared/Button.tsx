import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const variantClasses = {
  solid: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
  outline: "border border-gray-300 text-gray-900 hover:bg-gray-50 focus:ring-gray-500",
  ghost: "text-gray-700 hover:bg-gray-100 focus:ring-gray-500",
  destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
} as const;

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
}

const Button = ({
  className,
  variant = "solid",
  size = "md",
  ...props
}: ButtonProps) => (
  <button
    className={cn(
      "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed gap-2",
      variantClasses[variant],
      sizeClasses[size],
      className
    )}
    {...props}
  />
);

export default Button;
