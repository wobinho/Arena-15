"use client";

import { useToasts, type Toast } from "@/lib/toast-store";
import { cn } from "@/lib/cn";

const TONE: Record<NonNullable<Toast["tone"]>, string> = {
  default: "bg-bone-50 text-black",
  success: "bg-lime text-black",
  error: "bg-magenta text-black",
  warning: "bg-lemon text-black",
};

export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 max-w-[calc(100vw-2rem)] sm:max-w-sm">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            "text-left px-4 py-3 border-[3px] border-black rounded-chunk shadow-pop animate-wobble-in",
            TONE[t.tone ?? "default"]
          )}
        >
          <div className="font-display uppercase text-sm">{t.title}</div>
          {t.body && <div className="text-xs font-semibold opacity-80 mt-0.5">{t.body}</div>}
        </button>
      ))}
    </div>
  );
}
