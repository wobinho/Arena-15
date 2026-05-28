import Link from "next/link";
import { Button } from "@/components/ui/Button";

const STACK = [
  { k: "Next.js 15", v: "App Router, RSC, edge-ready" },
  { k: "Convex", v: "Backend, auth, DB, realtime" },
  { k: "Tailwind v3", v: "Custom cartoon theme tokens" },
  { k: "TypeScript", v: "Strict mode everywhere" },
];

const DEVS = [
  {
    handle: "SANTI",
    role: "Creator",
    accent: "bg-cyan",
  },
  {
    handle: "NCLBN",
    role: "Creator",
    accent: "bg-lemon",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
      {/* Developers */}
      <section className="mb-12">
        <div className="label-cap mb-2">The team</div>
        <h1 className="font-display text-4xl sm:text-6xl text-bone-50 leading-[0.95]">
          Built by two people
          <br />
          <span className="text-lemon">who actually play.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-bone-200/70 font-semibold text-base sm:text-lg">
          Arena 15 is made by @SANTI and @NCLBN
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          {DEVS.map((d) => (
            <div
              key={d.handle}
              className="relative border-[3px] border-black rounded-chunk bg-ink-800 p-6 shadow-pop-lg overflow-hidden"
            >
              <div
                className={`absolute -top-6 -right-6 w-24 h-24 ${d.accent} rounded-full border-[3px] border-black opacity-40`}
              />
              <div
                className={`w-14 h-14 ${d.accent} border-[3px] border-black rounded-chunk flex items-center justify-center shadow-pop mb-4`}
              >
                <span className="font-display text-xl text-black">@</span>
              </div>
              <div className="font-display text-2xl text-bone-50">
                @{d.handle}
              </div>
              <div className="text-xs text-bone-200/60 font-semibold mt-1 uppercase tracking-widest">
                {d.role}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About the platform */}
      <section className="mb-12">
        <div className="label-cap mb-2">The platform</div>
        <h2 className="font-display text-3xl text-bone-50">
          Built for chaos.
          <br />
          <span className="text-lemon">Shipped on the edge.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-bone-200/70 font-semibold text-base sm:text-lg">
          Arena 15 is a 1v1 mini-game platform built on Next.js and Convex.
          Session auth, live game state, and leaderboards all run through Convex
          — no separate socket server or database to manage.
        </p>
      </section>

      {/* Stack */}
      <section className="mt-10">
        <h2 className="font-display text-3xl text-bone-50">The stack</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STACK.map((s) => (
            <div
              key={s.k}
              className="border-[3px] border-black rounded-chunk bg-ink-800 p-4 shadow-pop-sm"
            >
              <div className="font-display text-lg text-bone-50">{s.k}</div>
              <div className="text-xs text-bone-200/60 font-semibold mt-1">
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 border-[3px] border-black rounded-chunk bg-lemon p-8 shadow-pop-lg">
        <h2 className="font-display text-3xl sm:text-4xl text-black">
          Now go play.
        </h2>
        <p className="mt-2 text-black/80 font-bold max-w-lg">
          Build the streak. Climb the board. Block your friend.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/play">
            <Button
              variant="ghost"
              className="!bg-black !text-lemon hover:!bg-ink-800"
            >
              Find a match
            </Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">Back to games</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
