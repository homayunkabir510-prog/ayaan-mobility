import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = ({ label, error, helperText, className, ...props }: InputProps) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-900">{label}</label>}
    <input
      className={cn(
        "px-4 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors",
        error && "border-red-500 focus:ring-red-500",
        className
      )}
      {...props}
    />
    {error && <p className="text-sm text-red-600">{error}</p>}
    {helperText && !error && <p className="text-sm text-gray-500">{helperText}</p>}
  </div>
);

export const TextArea = ({ label, error, helperText, className, ...props }: InputProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-900">{label}</label>}
    <textarea
      className={cn(
        "px-4 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors resize-none",
        error && "border-red-500 focus:ring-red-500",
        className
      )}
      {...(props as any)}
    />
    {error && <p className="text-sm text-red-600">{error}</p>}
    {helperText && !error && <p className="text-sm text-gray-500">{helperText}</p>}
  </div>
);

export default Input;
