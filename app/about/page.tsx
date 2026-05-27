import Link from "next/link";
import { Button } from "@/components/ui/Button";

const STACK = [
  { k: "Next.js 15", v: "App Router, RSC, edge-ready" },
  { k: "Convex", v: "Backend, auth, DB, realtime" },
  { k: "Tailwind v3", v: "Custom cartoon theme tokens" },
  { k: "TypeScript", v: "Strict mode everywhere" },
];

const DEPLOY = [
  {
    name: "Vercel",
    why: "Native Next.js host. Zero-config deploys, edge-ready, generous free tier. Push to deploy.",
    accent: "bg-lemon",
    badge: "Frontend",
    bullets: ["Push to GitHub → auto deploy", "Preview URLs per PR", "Instant rollbacks"],
  },
  {
    name: "Convex",
    why: "Serverless backend with a document DB, session-based auth, and live queries baked in — no infra to manage.",
    accent: "bg-cyan",
    badge: "Backend",
    bullets: ["Session token auth (built-in)", "Document DB with indexes", "Live queries for leaderboards"],
  },
  {
    name: "Convex Realtime",
    why: "Game state sync runs through Convex's built-in reactive queries and mutations — no separate WebSocket server needed.",
    accent: "bg-magenta",
    badge: "Realtime",
    bullets: ["Room state synced via live queries", "Mutations for game actions", "No PartyKit / socket server needed"],
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
      <div className="label-cap mb-2">About</div>
      <h1 className="font-display text-4xl sm:text-6xl text-bone-50 leading-[0.95]">
        Built for chaos.<br />
        Shipped on <span className="text-lemon">the edge.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-bone-200/70 font-semibold text-base sm:text-lg">
        Arena 15 is a 1v1 mini-game platform built on Next.js and Convex. Session auth, live game state, and leaderboards all run through Convex — no separate socket server or database to manage.
      </p>

      {/* Stack */}
      <section className="mt-10">
        <h2 className="font-display text-3xl text-bone-50">The stack</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STACK.map((s) => (
            <div key={s.k} className="border-[3px] border-black rounded-chunk bg-ink-800 p-4 shadow-pop-sm">
              <div className="font-display text-lg text-bone-50">{s.k}</div>
              <div className="text-xs text-bone-200/60 font-semibold mt-1">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Deploy */}
      <section className="mt-12">
        <div className="label-cap mb-2">Production deploy</div>
        <h2 className="font-display text-3xl text-bone-50">Where to ship it</h2>
        <p className="mt-2 max-w-2xl text-bone-200/60 font-semibold">
          For a 1v1 game with rooms + matchmaking + leaderboards, here's the recommended path:
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEPLOY.map((d) => (
            <div key={d.name} className="relative border-[3px] border-black rounded-chunk bg-ink-900 p-6 shadow-pop-lg">
              <div className={`absolute -top-3 left-4 px-3 py-1 ${d.accent} border-2 border-black rounded-full text-[10px] font-bold uppercase tracking-widest text-black`}>
                {d.badge}
              </div>
              <h3 className="mt-2 font-display text-2xl text-bone-50">{d.name}</h3>
              <p className="mt-2 text-sm text-bone-200/70 font-semibold">{d.why}</p>
              <ul className="mt-4 space-y-1.5 text-sm font-semibold">
                {d.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-bone-200/80">
                    <span className="text-lemon">▸</span> {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 border-[3px] border-dashed border-black/50 rounded-chunk bg-ink-900/40 p-6">
          <div className="label-cap mb-2">Deploy in 30 seconds</div>
          <ol className="space-y-2 text-sm font-semibold text-bone-200/80 list-decimal pl-5">
            <li>Push this repo to GitHub.</li>
            <li>Create a Convex project: <span className="text-lemon font-mono text-xs">npx convex dev</span> — follow the prompts to link or create.</li>
            <li>Import the repo at <span className="text-lemon">vercel.com/new</span> — Next.js is auto-detected. Add <span className="text-lemon font-mono text-xs">NEXT_PUBLIC_CONVEX_URL</span> from your Convex dashboard.</li>
            <li>Deploy Convex functions: <span className="text-lemon font-mono text-xs">npx convex deploy</span>. Auth, DB, and realtime are all live.</li>
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 border-[3px] border-black rounded-chunk bg-lemon p-8 shadow-pop-lg">
        <h2 className="font-display text-3xl sm:text-4xl text-black">Now go play.</h2>
        <p className="mt-2 text-black/80 font-bold max-w-lg">Build the streak. Climb the board. Block your friend.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/play">
            <Button variant="ghost" className="!bg-black !text-lemon hover:!bg-ink-800">Find a match</Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">Back to games</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
