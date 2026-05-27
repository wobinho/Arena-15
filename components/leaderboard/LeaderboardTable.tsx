"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Placeholder } from "@/components/ui/Placeholder";
import { getRatingTier, TIER_STYLES, type LeaderRow } from "@/lib/leaderboard";
import { cn } from "@/lib/cn";

function toLeaderRows(
  players: Array<{ rank: number; handle: string; avatar: string; rating: number; matchesPlayed: number }>,
): LeaderRow[] {
  return players.map((p) => ({
    ...p,
    tier: getRatingTier(p.rating),
  }));
}

export function LeaderboardTable({ gameId }: { gameId: string }) {
  const raw = useQuery(api.leaderboard.getTopPlayers, { gameId, limit: 20 });

  if (raw === undefined) {
    return (
      <div className="mt-10 flex items-center justify-center py-20 text-bone-200/60 font-semibold">
        Loading rankings…
      </div>
    );
  }

  if (raw.length === 0) {
    return (
      <div className="mt-10 border-[3px] border-black rounded-chunk bg-ink-800 shadow-pop-lg p-12 text-center">
        <div className="font-display text-2xl text-bone-50 mb-2">No rankings yet</div>
        <p className="text-bone-200/60 font-semibold">Play a match to appear on the leaderboard.</p>
      </div>
    );
  }

  const rows = toLeaderRows(raw);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <>
      {/* Podium */}
      <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-6 items-end">
        {podium[1] ? (
          <PodiumCard row={podium[1]} rank={2} height="h-40 sm:h-52" tone="bg-cyan" />
        ) : (
          <EmptyPodium rank={2} height="h-40 sm:h-52" tone="bg-cyan" />
        )}
        {podium[0] ? (
          <PodiumCard row={podium[0]} rank={1} height="h-52 sm:h-72" tone="bg-lemon" />
        ) : (
          <EmptyPodium rank={1} height="h-52 sm:h-72" tone="bg-lemon" />
        )}
        {podium[2] ? (
          <PodiumCard row={podium[2]} rank={3} height="h-36 sm:h-44" tone="bg-coral" />
        ) : (
          <EmptyPodium rank={3} height="h-36 sm:h-44" tone="bg-coral" />
        )}
      </div>

      {/* Table */}
      {rest.length > 0 && (
        <div className="mt-10 border-[3px] border-black rounded-chunk bg-ink-800 shadow-pop-lg overflow-hidden">
          <div className="hidden sm:grid grid-cols-[60px_1fr_120px_120px_100px] gap-4 px-5 py-3 border-b-2 border-black bg-ink-900 label-cap">
            <div>Rank</div>
            <div>Player</div>
            <div>Tier</div>
            <div className="text-right">Matches</div>
            <div className="text-right">Rating</div>
          </div>
          <ul>
            {rest.map((row) => {
              const t = TIER_STYLES[row.tier];
              return (
                <li
                  key={row.rank}
                  className="grid grid-cols-[40px_1fr_auto] sm:grid-cols-[60px_1fr_120px_120px_100px] gap-3 sm:gap-4 items-center px-4 sm:px-5 py-3 border-b-2 border-black/40 last:border-0 hover:bg-ink-700/50 transition-colors"
                >
                  <div className="font-display text-bone-200/80 text-sm sm:text-base">{row.rank}</div>
                  <div className="flex items-center gap-3 min-w-0">
                    <Placeholder label={row.avatar} size="md" shape="circle" />
                    <div className="min-w-0">
                      <div className="font-bold text-bone-50 truncate">@{row.handle}</div>
                      <div className="text-xs text-bone-200/50 font-semibold sm:hidden">
                        {row.matchesPlayed} matches · {row.rating.toFixed(3)}
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <span className={`chip ${t.bg} ${t.color} border-2`}>{row.tier}</span>
                  </div>
                  <div className="hidden sm:block text-right text-bone-200/70 font-semibold tabular-nums">
                    {row.matchesPlayed}
                  </div>
                  <div className="hidden sm:block text-right font-display text-bone-50 tabular-nums">
                    {row.rating.toFixed(3)}
                  </div>
                  <div className="sm:hidden">
                    <span className={`chip ${t.bg} ${t.color} border-2 text-[10px]`}>{t.mark}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

function PodiumCard({ row, rank, height, tone }: { row: LeaderRow; rank: number; height: string; tone: string }) {
  const crownLabel = rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd";
  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 text-center flex flex-col items-center">
        <Placeholder label={row.avatar} size="2xl" shape="circle" />
        <div className="font-display text-bone-50 truncate max-w-[140px] mt-2 text-sm sm:text-base">
          @{row.handle}
        </div>
        <div className="font-display text-lemon text-lg sm:text-xl tabular-nums">
          {row.rating.toFixed(3)}
        </div>
      </div>
      <div
        className={cn(
          "w-full border-[3px] border-black rounded-chunk shadow-pop-lg flex flex-col items-center justify-end p-3 sm:p-4 relative",
          height,
          tone,
        )}
      >
        <div className="absolute inset-0 bg-stripes opacity-10" />
        <div className="absolute top-2 right-2 chip bg-black text-bone-50 border-bone-50/20 text-[10px]">
          {crownLabel}
        </div>
        <div className="relative font-display text-5xl sm:text-7xl text-black">{rank}</div>
      </div>
    </div>
  );
}

function EmptyPodium({ rank, height, tone }: { rank: number; height: string; tone: string }) {
  const crownLabel = rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd";
  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 text-center flex flex-col items-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[3px] border-dashed border-bone-200/30 flex items-center justify-center text-3xl text-bone-200/30 animate-pulse">
          ?
        </div>
        <div className="font-display text-bone-200/40 mt-2 text-sm">TBD</div>
      </div>
      <div
        className={cn(
          "w-full border-[3px] border-dashed border-black/40 rounded-chunk flex flex-col items-center justify-end p-3 sm:p-4 relative opacity-40",
          height,
          tone,
        )}
      >
        <div className="absolute top-2 right-2 chip bg-black text-bone-50 border-bone-50/20 text-[10px]">
          {crownLabel}
        </div>
        <div className="relative font-display text-5xl sm:text-7xl text-black">{rank}</div>
      </div>
    </div>
  );
}
