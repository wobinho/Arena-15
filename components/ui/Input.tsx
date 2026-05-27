"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, leading, id, ...rest },
  ref
) {
  const inputId = id ?? rest.name;
  return (
    <label htmlFor={inputId} className="block">
      {label && <span className="label-cap mb-2 block">{label}</span>}
      <div
        className={cn(
          "flex items-center gap-2 px-4 h-12",
          "bg-ink-900 border-[3px] border-black rounded-chunk shadow-pop-sm",
          "focus-within:shadow-pop focus-within:-translate-x-[1px] focus-within:-translate-y-[1px]",
          "transition-all duration-150",
          error && "border-magenta"
        )}
      >
        {leading && <span className="text-bone-200/70">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex-1 bg-transparent outline-none text-bone-50 placeholder:text-bone-200/40",
            "font-body font-semibold",
            className
          )}
          {...rest}
        />
      </div>
      {hint && !error && <span className="mt-1.5 text-xs text-bone-200/60 block">{hint}</span>}
      {error && (
        <span className="mt-1.5 text-xs font-bold text-magenta flex items-center gap-1 animate-shake">
          <span className="inline-block w-1.5 h-1.5 bg-magenta rounded-full" />
          {error}
        </span>
      )}
    </label>
  );
});
