"use client";

import { useRouter } from "next/navigation";
import { useForfeitMatch } from "@/lib/room-store";
import { getGame, ACCENT_CLASSES, type GameId } from "@/lib/games";
import { Placeholder } from "@/components/ui/Placeholder";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { getRatingTier, TIER_STYLES } from "@/lib/leaderboard";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/lib/auth-store";

const ACCENT_GLOW: Record<string, string> = {
  blue: "from-blue/25",
  lemon: "from-lemon/25",
  magenta: "from-magenta/25",
  cyan: "from-cyan/25",
  lime: "from-lime/25",
  coral: "from-coral/25",
};

export type GameShellRoom = {
  _id: Id<"rooms">;
  code: string;
  gameId: string;
  players: Array<{ userId: Id<"users">; handle: string; avatar: string; rating: number }>;
};

export function GameShell({
  room,
  matchState,
  children,
}: {
  room: GameShellRoom;
  matchState?: { data?: unknown } | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const forfeitMatch = useForfeitMatch();
  const rematchMutation = useMutation(api.match.rematch);
  const { sessionToken, user } = useAuth();
  const game = getGame(room.gameId as GameId);
  if (!game) return null;
  const a = ACCENT_CLASSES[game.accent];

  const data = matchState?.data as Record<string, unknown> | undefined;
  const isForfeit = data?.forfeit === true;
  const forfeitedBy = data?.forfeitedBy as string | undefined;
  const iOpponentForfeited = isForfeit && forfeitedBy && forfeitedBy !== user?.id;

  async function onForfeit() {
    try {
      await forfeitMatch(room._id);
    } catch {
      // best effort
    }
    router.push(`/play/room/${room.code}`);
  }

  async function onRematch() {
    if (!sessionToken) return;
    try {
      await rematchMutation({ sessionToken, roomId: room._id });
    } catch {
      // best effort
    }
  }

  // When opponent forfeits, show a takeover overlay on their game screen.
  if (iOpponentForfeited) {
    const ratingDeltas = data?.ratingDeltas as Record<string, number> | undefined;
    const myDelta = user?.id ? ratingDeltas?.[user.id as string] : undefined;

    return (
      <div className={cn("flex-1 flex flex-col w-full relative")}>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none fixed inset-0 -z-0 bg-gradient-to-b to-transparent opacity-60",
            ACCENT_GLOW[game.accent] ?? "from-lemon/20",
          )}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="border-[3px] border-black rounded-chunk bg-ink-800 p-8 sm:p-12 shadow-pop-lg max-w-md w-full animate-wobble-in">
            <div className="w-20 h-20 mx-auto bg-lime border-[3px] border-black rounded-chunk shadow-pop flex items-center justify-center mb-4">
              <span className="font-display text-4xl text-black">W</span>
            </div>
            <div className="font-display text-3xl sm:text-4xl text-bone-50 mb-2">You win!</div>
            <p className="text-bone-200/70 font-semibold text-sm mb-4">
              Your opponent forfeited the match.
            </p>
            {myDelta !== undefined && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-lime border-2 border-black rounded-chunk shadow-pop-sm mb-6">
                <span className="font-display text-lg text-black">
                  +{myDelta.toFixed(3)} rating
                </span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={onRematch} variant="lime" size="lg">Rematch</Button>
              <Button onClick={() => router.push(`/play/room/${room.code}`)} variant="ghost" size="lg">
                Back to lobby
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 flex flex-col w-full relative")}>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0 -z-0 bg-gradient-to-b to-transparent opacity-60",
          ACCENT_GLOW[game.accent] ?? "from-lemon/20",
        )}
      />

      <div className="relative border-b-2 border-black bg-ink-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-4">
          <button
            onClick={onForfeit}
            className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-bone-200/60 hover:text-magenta shrink-0"
          >
            Forfeit
          </button>
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <span className={cn("chip text-black border-black text-[10px] sm:text-xs px-2 sm:px-2.5", a.bg)}>{game.name}</span>
            <span className="chip bg-ink-800 text-bone-50 text-[10px] sm:text-xs px-2 sm:px-2.5">
              <span className="font-mono">{room.code}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {room.players
              .map((p) => {
                const tier = getRatingTier(p.rating);
                const ts = TIER_STYLES[tier];
                return (
                  <div key={p.userId} className="flex items-center gap-1 sm:gap-1.5">
                    <Placeholder label={p.avatar} size="xs" shape="circle" />
                    <span className="hidden sm:inline text-xs font-bold">{p.handle}</span>
                    <span className={cn("hidden sm:inline chip text-[10px] px-1.5 py-0.5 border", ts.bg, ts.color)}>
                      {p.rating.toFixed(3)}
                    </span>
                  </div>
                );
              })
              .reduce<React.ReactNode[]>((acc, el, i, arr) => {
                acc.push(el);
                if (i < arr.length - 1) acc.push(
                  <span key={`vs-${i}`} className="text-bone-200/40 font-display text-[10px] sm:text-xs">vs</span>,
                );
                return acc;
              }, [])}
          </div>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col">{children}</div>
    </div>
  );
}
