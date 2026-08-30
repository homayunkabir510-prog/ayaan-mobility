import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from "lucide-react";

export interface AlertProps {
  variant?: "success" | "error" | "warning" | "info";
  children: ReactNode;
  onClose?: () => void;
  title?: string;
}

const variantConfig = {
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-900",
    icon: CheckCircle,
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    icon: AlertCircle,
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-900",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    icon: Info,
  },
};

const Alert = ({ variant = "info", children, onClose, title }: AlertProps) => {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div className={cn("rounded-lg border px-4 py-3", config.bg, config.border)}>
      <div className="flex gap-3">
        <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", config.text)} />
        <div className="flex-1">
          {title && <p className={cn("font-semibold", config.text)}>{title}</p>}
          <div className={cn("text-sm", config.text)}>{children}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={cn("text-sm font-medium hover:opacity-75 transition-opacity", config.text)}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;
