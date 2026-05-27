import { cn } from "@/lib/cn";

type PlaceholderSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
type PlaceholderShape = "square" | "circle" | "chunk";

type PlaceholderProps = {
  label: string;
  size?: PlaceholderSize;
  shape?: PlaceholderShape;
  className?: string;
  tone?: "ink" | "light";
};

const SIZE: Record<PlaceholderSize, string> = {
  xs: "w-5 h-5 text-[7px]",
  sm: "w-7 h-7 text-[8px]",
  md: "w-10 h-10 text-[9px]",
  lg: "w-14 h-14 text-[10px]",
  xl: "w-20 h-20 text-xs",
  "2xl": "w-28 h-28 text-sm",
  "3xl": "w-40 h-40 text-base",
};

const SHAPE: Record<PlaceholderShape, string> = {
  square: "rounded-md",
  circle: "rounded-full",
  chunk: "rounded-chunk",
};

export function Placeholder({
  label,
  size = "md",
  shape = "chunk",
  className,
  tone = "ink",
}: PlaceholderProps) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden",
        "border-2 border-dashed",
        tone === "ink"
          ? "bg-ink-900/60 border-bone-50/40 text-bone-50/70"
          : "bg-black/10 border-black/50 text-black/70",
        SIZE[size],
        SHAPE[shape],
        className
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 8px)",
        }}
      />
      <span className="relative font-display uppercase tracking-widest leading-none text-center px-1 truncate max-w-full">
        {label}
      </span>
    </span>
  );
}
