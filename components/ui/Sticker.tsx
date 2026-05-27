import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type StickerProps = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "article";
  tone?: "default" | "ink" | "paper" | "lemon" | "magenta" | "cyan" | "lime";
};

const TONES = {
  default: "bg-ink-800",
  ink: "bg-ink-900",
  paper: "bg-bone-50 text-black",
  lemon: "bg-lemon text-black",
  magenta: "bg-magenta text-black",
  cyan: "bg-cyan text-black",
  lime: "bg-lime text-black",
};

export function Sticker({ className, tone = "default", ...rest }: StickerProps) {
  return (
    <div
      className={cn(
        "relative border-[3px] border-black rounded-chunk shadow-pop",
        TONES[tone],
        className
      )}
      {...rest}
    />
  );
}
