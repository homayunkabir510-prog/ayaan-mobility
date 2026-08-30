import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const Card = ({ className, children, ...props }: CardProps) => (
  <div className={cn("rounded-lg border border-gray-200 bg-white shadow-sm", className)} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ className, children, ...props }: CardProps) => (
  <div className={cn("border-b border-gray-200 px-6 py-4", className)} {...props}>
    {children}
  </div>
);

export const CardContent = ({ className, children, ...props }: CardProps) => (
  <div className={cn("px-6 py-4", className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ className, children, ...props }: CardProps) => (
  <div className={cn("border-t border-gray-200 bg-gray-50 px-6 py-4", className)} {...props}>
    {children}
  </div>
);

export default Card;
