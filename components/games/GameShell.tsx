"use client";

import { useRouter } from "next/navigation";
import { useLeaveRoom } from "@/lib/room-store";
import { getGame, ACCENT_CLASSES, type GameId } from "@/lib/games";
import { Placeholder } from "@/components/ui/Placeholder";
import { cn } from "@/lib/cn";
import { getRatingTier, TIER_STYLES } from "@/lib/leaderboard";
import type { Id } from "@/convex/_generated/dataModel";

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
  children,
}: {
  room: GameShellRoom;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const leaveRoom = useLeaveRoom();
  const game = getGame(room.gameId as GameId);
  if (!game) return null;
  const a = ACCENT_CLASSES[game.accent];

  async function onForfeit() {
    try {
      await leaveRoom(room._id);
    } catch {
      // best effort
    }
    router.push("/play");
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
