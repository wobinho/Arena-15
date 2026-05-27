"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/ui/Placeholder";
import { useAuth } from "@/lib/auth-store";
import {
  useRoomByCode,
  useToggleReady,
  useLeaveRoom,
  useJoinRoom,
} from "@/lib/room-store";
import { getGame, ACCENT_CLASSES } from "@/lib/games";
import { getRatingTier, TIER_STYLES } from "@/lib/leaderboard";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/cn";

export default function RoomLobbyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const room = useRoomByCode(code);
  const toggleReady = useToggleReady();
  const leaveRoom = useLeaveRoom();
  const joinRoom = useJoinRoom();
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);

  // Auto-join if user lands on a room URL but isn't in the room yet.
  useEffect(() => {
    if (!hydrated || !user || !room || autoJoinAttempted) return;
    const inRoom = room.players.some((p) => p.userId === user.id);
    if (inRoom) return;
    setAutoJoinAttempted(true);
    if (room.status !== "lobby") {
      toast({ title: "Match already started", tone: "warning" });
      router.replace("/play");
      return;
    }
    if (room.players.length >= 2) {
      toast({ title: "Room is full", tone: "error" });
      router.replace("/play");
      return;
    }
    joinRoom(room.code).catch((e) => {
      toast({ title: "Couldn't join", body: errorMessage(e), tone: "error" });
      router.replace("/play");
    });
  }, [hydrated, user, room, autoJoinAttempted, joinRoom, router]);

  // When the match starts, navigate to the game screen.
  useEffect(() => {
    if (room && room.status === "in-game") {
      router.push(`/play/room/${room.code}/game`);
    }
  }, [room, router]);

  if (room === undefined || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-bone-200/60">Loading lobby…</div>
      </div>
    );
  }
  if (room === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <div className="font-display text-2xl text-bone-50">Room not found</div>
        <Button onClick={() => router.replace("/play")} size="md">Back to play</Button>
      </div>
    );
  }

  const game = getGame(room.gameId as "timeout" | "high-low");
  const a = game ? ACCENT_CLASSES[game.accent] : ACCENT_CLASSES.lemon;
  const me = room.players.find((p) => p.userId === user.id);

  async function onToggleReady() {
    if (!me) return;
    try {
      await toggleReady(room!._id);
    } catch (e) {
      toast({ title: "Couldn't toggle ready", body: errorMessage(e), tone: "error" });
    }
  }

  async function onLeave() {
    try {
      await leaveRoom(room!._id);
    } catch {
      // best effort
    }
    router.push("/play");
  }

  function copyCode() {
    navigator.clipboard.writeText(room!.code).then(() => {
      toast({ title: "Code copied!", body: "Send it to your friend.", tone: "success" });
    });
  }

  function copyLink() {
    const url = `${window.location.origin}/play/room/${room!.code}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied!", tone: "success" });
    });
  }

  const bothReady =
    room.players.length === 2 && room.players.every((p) => p.ready);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
      <button
        onClick={onLeave}
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-bone-200/60 hover:text-magenta"
      >
        Leave lobby
      </button>

      <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="label-cap mb-2">Lobby</div>
          <h1 className="font-display text-4xl sm:text-5xl text-bone-50">
            Room <span className={a.text}>{room.code}</span>
          </h1>
          <p className="mt-2 text-bone-200/60 font-semibold">
            Playing <span className="text-bone-50 font-bold">{game?.name}</span> · {game?.players}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={copyCode} className="chip bg-bone-50 text-black border-black">
            {room.code}
          </button>
          <button onClick={copyLink} className="chip bg-ink-800 text-bone-50">
            Copy link
          </button>
        </div>
      </div>

      <div className={cn("mt-8 relative border-[3px] border-black rounded-chunk bg-ink-800 shadow-pop-lg overflow-hidden")}>
        <div className={cn("absolute inset-0 opacity-15", a.bg)} />
        <div className="absolute inset-0 bg-dots opacity-30" />
        <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 p-6 sm:p-8 items-center">
          {room.players[0] ? (
            <PlayerSlot player={room.players[0]} isMe={room.players[0].userId === user.id} accent={a} />
          ) : (
            <EmptySlot />
          )}
          <div className="flex md:flex-col items-center justify-center gap-3 py-2">
            <div className="font-display text-3xl sm:text-5xl text-bone-50 px-4 py-2 bg-black border-[3px] border-bone-50/20 rounded-chunk shadow-pop">
              VS
            </div>
          </div>
          {room.players[1] ? (
            <PlayerSlot player={room.players[1]} isMe={room.players[1].userId === user.id} accent={a} />
          ) : (
            <EmptySlot />
          )}
        </div>

        {bothReady && (
          <div className={cn("relative border-t-[3px] border-black p-6 text-center", a.bg)}>
            <div className="text-xs font-bold uppercase tracking-widest text-black">Starting match…</div>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border-[3px] border-black rounded-chunk bg-ink-900 p-5">
          <div className="label-cap mb-2">Your status</div>
          <div className="flex items-center justify-between gap-4">
            <div className="text-bone-50 font-bold">
              {!me
                ? "Joining…"
                : me.ready
                  ? "Locked in. Waiting on opponent…"
                  : "Tap when you're ready."}
            </div>
            <Button
              variant={me?.ready ? "ghost" : "lime"}
              onClick={onToggleReady}
              disabled={!me || room.players.length < 2}
            >
              {me?.ready ? "Unready" : "Ready up"}
            </Button>
          </div>
        </div>
        <div className="border-[3px] border-black rounded-chunk bg-ink-900 p-5">
          <div className="label-cap mb-2">Rules quick-look</div>
          <ul className="space-y-1.5 text-sm text-bone-200/80 font-semibold">
            {game?.rules.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className={cn("font-display", a.text)}>{i + 1}.</span> {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PlayerSlot({
  player,
  isMe,
  accent,
}: {
  player: { handle: string; avatar: string; ready: boolean; isHost: boolean; rating: number };
  isMe: boolean;
  accent: { bg: string; text: string };
}) {
  const tier = getRatingTier(player.rating);
  const tierStyle = TIER_STYLES[tier];
  return (
    <div className={cn(
      "relative flex flex-col items-center p-6 rounded-chunk border-[3px] border-black bg-ink-900 shadow-pop",
      isMe && "ring-4 ring-lemon"
    )}>
      {player.isHost && (
        <div className="absolute top-3 left-3 chip bg-lemon text-black border-black">Host</div>
      )}
      {isMe && (
        <div className="absolute top-3 right-3 chip bg-cyan text-black border-black">YOU</div>
      )}
      <div className={cn("w-24 h-24 rounded-chunk border-[3px] border-black flex items-center justify-center shadow-pop-sm", accent.bg)}>
        <Placeholder label={player.avatar} size="xl" tone="light" />
      </div>
      <div className="mt-3 font-display text-xl text-bone-50">@{player.handle}</div>
      <div className={cn("mt-1 chip border-2 text-xs", tierStyle.bg, tierStyle.color)}>
        {player.rating.toFixed(3)} · {tier}
      </div>
      <div className={cn(
        "mt-2 chip border-black",
        player.ready ? "bg-lime text-black" : "bg-ink-800 text-bone-200/60"
      )}>
        <span className={cn("w-1.5 h-1.5 rounded-full", player.ready ? "bg-black" : "bg-bone-200/40")} />
        {player.ready ? "Ready" : "Not ready"}
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="flex flex-col items-center p-6 rounded-chunk border-[3px] border-dashed border-black/50 bg-ink-900/40 min-h-[220px] justify-center">
      <div className="w-24 h-24 rounded-chunk border-[3px] border-dashed border-bone-200/30 flex items-center justify-center text-4xl text-bone-200/30 animate-pulse">
        ?
      </div>
      <div className="mt-3 font-display text-lg text-bone-200/50">Waiting for opponent…</div>
      <p className="mt-1 text-xs text-bone-200/40 font-semibold">Share the room code above</p>
    </div>
  );
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    const m = e.message.match(/Uncaught Error: (.+)$/);
    if (m) return m[1];
    return e.message;
  }
  return "Something went wrong";
}
