import { cn } from "@/lib/utils";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

const Spinner = ({ size = "md", className }: SpinnerProps) => (
  <div
    className={cn(
      "animate-spin rounded-full border-2 border-gray-300 border-t-green-600",
      sizeClasses[size],
      className
    )}
    role="status"
    aria-label="Loading"
  >
    <span className="sr-only">Loading...</span>
  </div>
);

export default Spinner;
