import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES, getGame, ACCENT_CLASSES } from "@/lib/games";
import { GameTopPlayers } from "@/components/leaderboard/GameTopPlayers";
import { Placeholder } from "@/components/ui/Placeholder";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();
  const a = ACCENT_CLASSES[game.accent];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
      <Link href="/" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-bone-200/60 hover:text-lemon">
        All games
      </Link>

      {/* Hero */}
      <section className={`mt-6 relative overflow-hidden rounded-chunk border-[3px] border-black ${a.bg} shadow-pop-lg`}>
        <div className="absolute inset-0 bg-stripes opacity-10" />
        <div className="absolute inset-0 bg-dots opacity-30" />
        <div className="relative grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 p-6 sm:p-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black bg-black text-bone-50 rounded-full text-xs font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
              {game.status === "live" ? "Live" : game.status}
            </div>
            <h1 className="mt-3 font-display text-5xl sm:text-7xl text-black leading-[0.92]">
              {game.name}
            </h1>
            <p className="mt-3 text-black font-bold text-lg sm:text-xl">{game.tagline}</p>
            <p className="mt-4 text-black/80 font-semibold max-w-lg">{game.description}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/play?mode=quick&game=${game.id}`}
                className="inline-flex items-center gap-2 px-6 h-12 rounded-chunk border-[3px] border-black bg-black text-bone-50 font-display uppercase text-sm shadow-pop-lg hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all"
              >
                Quick match
              </Link>
              <Link
                href={`/play?mode=room&game=${game.id}`}
                className="inline-flex items-center gap-2 px-6 h-12 rounded-chunk border-[3px] border-black bg-bone-50 text-black font-display uppercase text-sm shadow-pop-lg hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all"
              >
                Create room
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-12 rounded-full border-[3px] border-black/30 border-dashed animate-spin-slow" />
              <div className="relative animate-float">
                <Placeholder label={game.icon} size="3xl" tone="light" className="w-40 h-40 sm:w-56 sm:h-56" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Meta strip */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: "Players", v: game.players, p: "players" },
          { k: "Duration", v: game.duration, p: "duration" },
          { k: "Difficulty", v: game.difficulty, p: "diff" },
          { k: "Mode", v: "Best to score", p: "mode" },
        ].map((m) => (
          <div key={m.k} className="border-[3px] border-black rounded-chunk bg-ink-800 p-4 shadow-pop-sm">
            <Placeholder label={m.p} size="md" />
            <div className="label-cap mt-1">{m.k}</div>
            <div className="font-display text-lg text-bone-50">{m.v}</div>
          </div>
        ))}
      </div>

      {/* Rules + leaderboard preview */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
        <section className="border-[3px] border-black rounded-chunk bg-ink-800 p-6 sm:p-8 shadow-pop-lg">
          <div className="label-cap mb-2">The rules</div>
          <h2 className="font-display text-3xl text-bone-50">How to play</h2>
          <ol className="mt-5 space-y-3">
            {game.rules.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className={`shrink-0 w-8 h-8 rounded-chunk border-2 border-black ${a.bg} text-black font-display flex items-center justify-center`}>
                  {i + 1}
                </span>
                <span className="text-bone-50/90 font-semibold pt-1">{r}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-[3px] border-black rounded-chunk bg-ink-900 p-6 sm:p-8 shadow-pop-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="label-cap">Top of the board</div>
              <h2 className="font-display text-3xl text-bone-50">Hall of fame</h2>
            </div>
            <Link
              href={`/leaderboard/${game.id}`}
              className="text-xs font-bold uppercase tracking-widest text-lemon hover:underline"
            >
              Full board
            </Link>
          </div>
          <GameTopPlayers />
        </section>
      </div>
    </div>
  );
}
