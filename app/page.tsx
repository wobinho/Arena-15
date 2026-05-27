import Link from "next/link";
import { GAMES } from "@/lib/games";
import { GameCard } from "@/components/GameCard";
import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/ui/Placeholder";

export default function HomePage() {
  return (
    <div className="flex-1">
      {/* HERO */}
      <section className="relative overflow-hidden border-b-2 border-black">
        <div className="absolute inset-0 bg-dots opacity-50" />
        {/* Floating sticker shapes */}
        <div className="absolute -top-10 -left-12 w-44 h-44 rounded-full bg-magenta border-[3px] border-black shadow-pop-lg rotate-12 hidden sm:block" />
        <div className="absolute -bottom-12 right-10 w-28 h-28 bg-lime border-[3px] border-black rounded-chunk shadow-pop-lg -rotate-12 hidden sm:block" />
        <div className="absolute top-12 right-20 w-20 h-20 bg-cyan border-[3px] border-black rounded-full shadow-pop animate-float hidden md:block" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-20 pb-10 sm:pb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-black bg-bone-50 rounded-full">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-magenta animate-pulse-ring" />
              <span className="w-2 h-2 rounded-full bg-magenta" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">
              247 friends playing right now
            </span>
          </div>

          <h1 className="mt-4 sm:mt-6 font-display text-[2.8rem] sm:text-7xl lg:text-8xl leading-[0.92] text-bone-50">
            ONE V ONE.<br />
            <span className="inline-block px-2 -rotate-2 bg-lemon text-black border-[3px] border-black rounded-chunk shadow-pop-lg">
              ZERO MERCY.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base sm:text-lg text-bone-200/80 font-semibold">
            Arena 15 is a chaotic collection of 1v1 mini games. Pick a game, grab a
            friend (or a stranger), and find out who actually has the reflexes.
          </p>

          <div className="mt-6 sm:mt-8 flex flex-wrap gap-2 sm:gap-3">
            <Link href="/play">
              <Button size="lg">Quick match</Button>
            </Link>
            <Link href="/play?mode=room">
              <Button size="lg" variant="cyan">
                Create a room
              </Button>
            </Link>
            <Link href="/leaderboard/timeout">
              <Button size="lg" variant="ghost">Leaderboards</Button>
            </Link>
          </div>

          {/* Games catalog CTA */}
          <div className="mt-10 max-w-2xl">
            <Link
              href="#games"
              className="group flex items-center gap-4 border-[3px] border-black bg-ink-800 rounded-chunk p-4 sm:p-5 shadow-pop hover:shadow-pop-lg transition-all hover:-translate-y-[2px] animate-wobble-in"
              style={{ animationDelay: "200ms" }}
            >
              <div className="w-14 h-14 bg-lemon border-[3px] border-black rounded-chunk flex items-center justify-center shadow-pop flex-shrink-0">
                <span className="font-display text-2xl text-black">▶</span>
              </div>
              <div className="flex-1 text-left">
                <div className="font-display text-xl sm:text-2xl text-bone-50">Browse the game catalog</div>
                <p className="text-xs sm:text-sm text-bone-200/60 font-semibold mt-0.5">
                  {GAMES.filter((g) => g.status === "live").length} games live — pick one and find out who&apos;s actually better.
                </p>
              </div>
              <div className="flex-shrink-0 w-10 h-10 bg-lemon border-2 border-black rounded-chunk flex items-center justify-center shadow-pop-sm group-hover:translate-x-1 transition-transform">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* GAMES GRID */}
      <section id="games" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-12">
          <div>
            <div className="label-cap mb-2">The roster</div>
            <h2 className="font-display text-4xl sm:text-5xl text-bone-50">
              Pick your <span className="text-lemon">poison.</span>
            </h2>
          </div>
          <p className="text-sm text-bone-200/60 font-semibold max-w-md">
            New games drop every season. Tap one to read the rules, see the leaderboard,
            or jump straight into matchmaking.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {GAMES.map((g, i) => (
            <GameCard key={g.id} game={g} index={i} />
          ))}
          {/* Coming-soon placeholder card */}
          <article className="relative border-[3px] border-dashed border-black/60 rounded-chunk bg-ink-900/60 p-8 flex flex-col items-center justify-center text-center min-h-[400px] hover:bg-ink-900 transition-colors">
            <div className="mb-4 animate-float">
              <Placeholder label="coming-soon" size="2xl" />
            </div>
            <div className="font-display text-2xl text-bone-50">More games soon</div>
            <p className="mt-2 text-sm text-bone-200/60 font-semibold max-w-xs">
              Got an idea for a 1v1 mini game? We're shipping a new one every other Friday.
            </p>
            <Link
              href="/about"
              className="mt-4 text-xs font-bold uppercase tracking-widest text-lemon hover:underline"
            >
              Pitch us one
            </Link>
          </article>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y-2 border-black bg-ink-900/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="text-center mb-12">
            <div className="label-cap mb-2">How a match works</div>
            <h2 className="font-display text-4xl sm:text-5xl text-bone-50">
              Three steps. <span className="text-cyan">Total chaos.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              { n: "01", t: "Pick a game", d: "Browse the roster, see the rules, check the leaderboard. Pick whatever matches the mood.", c: "bg-lemon", p: "step-pick" },
              { n: "02", t: "Queue or invite", d: "Hit Quick Match for a random opponent, or spin up a private room and share the 5-char code.", c: "bg-magenta", p: "step-queue" },
              { n: "03", t: "Best of three", d: "Three rounds. The winner climbs the board. The loser learns. The chat is unhinged.", c: "bg-cyan", p: "step-win" },
            ].map((s, i) => (
              <div
                key={s.n}
                className="relative border-[3px] border-black rounded-chunk bg-ink-800 p-6 shadow-pop-lg animate-wobble-in"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className={`absolute -top-5 -left-3 w-14 h-14 ${s.c} border-[3px] border-black rounded-chunk shadow-pop flex items-center justify-center font-display text-xl text-black -rotate-6`}>
                  {s.n}
                </div>
                <div className="ml-12 mb-3">
                  <Placeholder label={s.p} size="lg" />
                </div>
                <div className="font-display text-2xl text-bone-50">{s.t}</div>
                <p className="mt-2 text-sm text-bone-200/70 font-semibold">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="relative overflow-hidden border-[3px] border-black rounded-chunk bg-lemon shadow-pop-lg p-6 sm:p-14">
          <div className="absolute inset-0 bg-stripes opacity-10" />
          <div className="absolute -top-10 right-10 w-32 h-32 bg-magenta border-[3px] border-black rounded-full shadow-pop-lg hidden sm:block animate-float" />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-4xl sm:text-6xl text-black leading-[0.95]">
              No download.<br />
              No tutorials.<br />
              <span className="bg-black text-lemon px-2 rounded-chunk inline-block -rotate-1">Just go.</span>
            </h2>
            <p className="mt-4 text-black/80 font-bold text-base sm:text-lg max-w-lg">
              Arena 15 runs in your browser. Phone, tablet, laptop — anywhere your friends are.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button size="lg" variant="ghost" className="!bg-black !text-lemon hover:!bg-ink-800">
                  Create free account
                </Button>
              </Link>
              <Link href="/play">
                <Button size="lg" variant="secondary">
                  Play as guest
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
