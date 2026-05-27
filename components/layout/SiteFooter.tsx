"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/play/room/") && pathname.endsWith("/game")) return null;

  return (
    <footer className="border-t-2 border-black bg-ink-950 mt-8">
      <div className="relative overflow-hidden border-b-2 border-black bg-stripes bg-ink-900">
        <div className="marquee-track py-3 text-bone-50 font-display uppercase text-sm whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex items-center">
              {[
                "READY UP",
                "BEST OF THREE",
                "NO MERCY",
                "WIN A TOKEN",
                "RANKED TONIGHT",
                "TIMING IS EVERYTHING",
                "BRING A FRIEND",
              ].map((w, j) => (
                <span key={`${i}-${j}`} className="mx-6 flex items-center gap-6">
                  <span className="inline-block w-2 h-2 bg-lemon border-2 border-black rounded-full" />
                  {w}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2">
          <div className="font-display text-2xl text-bone-50">
            ARENA<span className="text-lemon">15</span>
          </div>
          <p className="mt-2 text-sm text-bone-200/60 max-w-xs">
            A chaotic playground of 1v1 mini games. Built to be unfair to no one and brutal to everyone.
          </p>
        </div>
        <div>
          <div className="label-cap mb-3">Games</div>
          <ul className="space-y-2 text-sm font-semibold">
            <li><Link className="hover:text-lemon" href="/games/timeout">Timeout</Link></li>
            <li><Link className="hover:text-lemon" href="/games/high-low">High-Low</Link></li>
          </ul>
        </div>
        <div>
          <div className="label-cap mb-3">More</div>
          <ul className="space-y-2 text-sm font-semibold">
            <li><Link className="hover:text-lemon" href="/leaderboard/timeout">Leaderboards</Link></li>
            <li><Link className="hover:text-lemon" href="/play">Matchmaking</Link></li>
            <li><Link className="hover:text-lemon" href="/about">About</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t-2 border-black/40 py-4 text-center text-xs text-bone-200/40">
        © 2026 Arena 15 — A demo project. No actual arena was harmed.
      </div>
    </footer>
  );
}
