"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "magenta" | "cyan" | "lime";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  full?: boolean;
};

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-lemon text-black hover:bg-lemon-dark",
  secondary: "bg-bone-50 text-black hover:bg-bone-100",
  ghost: "bg-ink-800 text-bone-50 hover:bg-ink-700",
  danger: "bg-magenta text-black hover:bg-magenta-dark",
  magenta: "bg-magenta text-black hover:bg-magenta-dark",
  cyan: "bg-cyan text-black hover:bg-cyan-dark",
  lime: "bg-lime text-black hover:bg-lime-dark",
};

const SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, full, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 font-display uppercase tracking-wide",
        "border-[3px] border-black rounded-chunk shadow-pop",
        "transition-all duration-150 ease-out",
        "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-pop-lg",
        "active:translate-x-[3px] active:translate-y-[3px] active:shadow-pop-sm",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-pop",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className
      )}
      {...rest}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
      )}
      <span>{children}</span>
    </button>
  );
});
