import Link from "next/link";
import { type Game, ACCENT_CLASSES } from "@/lib/games";
import { Placeholder } from "@/components/ui/Placeholder";
import { cn } from "@/lib/cn";

const DIFFICULTY_TONE: Record<Game["difficulty"], string> = {
  Chill: "bg-lime",
  Spicy: "bg-coral",
  Hectic: "bg-magenta",
};

export function GameCard({ game, index = 0 }: { game: Game; index?: number }) {
  const a = ACCENT_CLASSES[game.accent];
  const rotate = index % 2 === 0 ? "rotate-[-1deg]" : "rotate-[1deg]";

  return (
    <article
      className={cn(
        "group relative border-[3px] border-black rounded-chunk bg-ink-800 shadow-pop-lg overflow-hidden",
        "transition-all duration-200 ease-out",
        "hover:-translate-x-[3px] hover:-translate-y-[3px] hover:rotate-0",
        "animate-wobble-in",
        rotate
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Decorative panel */}
      <div className={cn("relative h-48 sm:h-56 overflow-hidden border-b-[3px] border-black", a.bg)}>
        <div className="absolute inset-0 bg-stripes opacity-15" />
        <div className="absolute inset-0 bg-dots opacity-30" />

        {/* Game art placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="absolute -inset-12 rounded-full border-[3px] border-black/40 border-dashed animate-spin-slow" />
            <div className="absolute -inset-6 rounded-full bg-black/15" />
            <div className="relative group-hover:scale-110 transition-transform duration-300">
              <Placeholder label={game.icon} size="3xl" tone="light" />
            </div>
          </div>
        </div>

        {/* Status pill */}
        <div className="absolute top-3 left-3 chip bg-black text-bone-50 border-bone-50/20">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            game.status === "live" ? "bg-lime animate-pulse" : game.status === "beta" ? "bg-lemon" : "bg-bone-200/40"
          )} />
          {game.status === "live" ? "Live" : game.status === "beta" ? "Beta" : "Soon"}
        </div>

        {/* Difficulty */}
        <div className={cn("absolute top-3 right-3 chip text-black border-black", DIFFICULTY_TONE[game.difficulty])}>
          {game.difficulty}
        </div>

        {/* Players badge */}
        <div className="absolute bottom-3 left-3 chip bg-black text-bone-50 border-bone-50/20">
          {game.players}
        </div>
        <div className="absolute bottom-3 right-3 chip bg-black text-bone-50 border-bone-50/20">
          {game.duration}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl sm:text-3xl text-bone-50 leading-none">
              {game.name}
            </h3>
            <p className={cn("mt-1 text-sm font-bold uppercase tracking-wider", a.text)}>
              {game.tagline}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-bone-200/70 font-semibold leading-relaxed">
          {game.description}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/games/${game.id}`}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-chunk border-[3px] border-black bg-bone-50 text-black font-display uppercase text-xs shadow-pop-sm hover:shadow-pop hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all"
          >
            Play
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7H13M13 7L7 1M13 7L7 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <Link
            href={`/leaderboard/${game.id}`}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-chunk border-[3px] border-black bg-ink-900 text-bone-50 font-display uppercase text-xs shadow-pop-sm hover:shadow-pop hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all"
          >
            Board
          </Link>
        </div>
      </div>
    </article>
  );
}
