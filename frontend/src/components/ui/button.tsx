import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "bg-blue-500 hover:bg-blue-400 text-white transition-colors duration-200",
  outline:
    "border border-white/10 bg-transparent hover:bg-white/5 transition-colors duration-200",
  ghost: "bg-transparent hover:bg-white/10",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black/60",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
