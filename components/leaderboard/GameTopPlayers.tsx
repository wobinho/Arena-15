"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Placeholder } from "@/components/ui/Placeholder";
import { getRatingTier, TIER_STYLES } from "@/lib/leaderboard";

export function GameTopPlayers() {
  const players = useQuery(api.leaderboard.getTopPlayers, { limit: 5 });

  if (players === undefined) {
    return (
      <div className="mt-4 space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-chunk border-2 border-black bg-ink-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="mt-4 py-8 text-center text-bone-200/50 font-semibold text-sm">
        No ranked players yet — be the first!
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-2">
      {players.map((p) => {
        const tier = getRatingTier(p.rating);
        const t = TIER_STYLES[tier];
        return (
          <li
            key={p.rank}
            className="flex items-center gap-3 p-3 rounded-chunk border-2 border-black bg-ink-800"
          >
            <div
              className={`w-8 h-8 rounded-chunk border-2 border-black flex items-center justify-center font-display text-sm ${p.rank === 1 ? "bg-lemon text-black" : "bg-ink-700 text-bone-50"}`}
            >
              {p.rank}
            </div>
            <Placeholder label={p.avatar} size="md" shape="circle" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-bone-50 truncate">@{p.handle}</div>
              <div className="text-xs text-bone-200/60 font-semibold">
                {p.matchesPlayed} match{p.matchesPlayed !== 1 ? "es" : ""}
              </div>
            </div>
            <div className={`chip ${t.bg} ${t.color} border-2`}>{tier}</div>
            <div className="font-display text-lg text-bone-50 tabular-nums hidden sm:block">
              {p.rating.toLocaleString()}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
