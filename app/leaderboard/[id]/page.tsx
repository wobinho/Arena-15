import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES, getGame, ACCENT_CLASSES } from "@/lib/games";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { cn } from "@/lib/cn";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function LeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();
  const a = ACCENT_CLASSES[game.accent];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-bone-200/60 hover:text-lemon"
      >
        All games
      </Link>

      {/* Header with game tabs */}
      <div className="mt-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="label-cap mb-2">Leaderboard</div>
          <h1 className="font-display text-4xl sm:text-5xl text-bone-50">
            {game.name} <span className={a.text}>· top 20</span>
          </h1>
          <p className="mt-2 text-bone-200/60 font-semibold">
            Global rating ranking · Season 1
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {GAMES.map((g) => {
            const active = g.id === game.id;
            const ga = ACCENT_CLASSES[g.accent];
            return (
              <Link
                key={g.id}
                href={`/leaderboard/${g.id}`}
                className={cn(
                  "px-4 h-10 inline-flex items-center gap-2 rounded-chunk border-[3px] border-black font-display uppercase text-xs",
                  active
                    ? `${ga.bg} text-black shadow-pop-sm`
                    : "bg-ink-800 text-bone-50 hover:bg-ink-700",
                )}
              >
                {g.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Podium + Table (client component with live Convex data) */}
      <LeaderboardTable />
    </div>
  );
}
