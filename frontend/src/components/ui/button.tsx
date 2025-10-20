import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 text-white shadow-[0_12px_30px_rgba(56,189,248,0.35)] transition-all duration-200 hover:brightness-105",
  outline:
    "border border-white/15 bg-transparent text-white hover:bg-white/10 transition-colors duration-200",
  ghost: "bg-transparent text-white hover:bg-white/10",
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
