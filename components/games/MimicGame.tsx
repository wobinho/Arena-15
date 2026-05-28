"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-store";
import { useLeaveRoom } from "@/lib/room-store";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// ─── Constants (mirror server) ────────────────────────────────────────────────

const PREGAME_DURATION_MS = 3_000;
const STEP_DURATION_MS = 700;
const STEP_TOTAL_MS = 1_000;
const SHOWING_LEAD_MS = 600;

// Random colors for input-phase tap feedback
const FEEDBACK_COLORS = [
  "#FF4C4C", "#FF9F45", "#FFE545", "#4CFF7A",
  "#45C4FF", "#9B45FF", "#FF45D9", "#FF7045",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type MimicPhase = "pregame" | "showing" | "input" | "match-over";

type MimicStep = {
  tileIndex: number;
  color: string;
};

type MimicData = {
  pattern: MimicStep[];
  patternLength: number;
  showingDurationMs: number;
  playerProgress: Record<string, number>;
  playerDone: Record<string, boolean>;
  playerFailed: Record<string, boolean>;
  winnerUserId?: Id<"users">;
  ratingDeltas?: Record<string, number>;
};

type RoomView = {
  _id: Id<"rooms">;
  code: string;
  gameId: string;
  status: string;
  players: Array<{
    _id: Id<"roomPlayers">;
    userId: Id<"users">;
    handle: string;
    avatar: string;
    isHost: boolean;
    ready: boolean;
    seatIndex: number;
    score: number;
    streak: number;
  }>;
};

type TileFlash = { tileIndex: number; color: string; id: number };

// ─── Helper ───────────────────────────────────────────────────────────────────

function getActiveShowStep(elapsed: number, patternLength: number): number | null {
  for (let i = 0; i < patternLength; i++) {
    const start = SHOWING_LEAD_MS + i * STEP_TOTAL_MS;
    const end = start + STEP_DURATION_MS;
    if (elapsed >= start && elapsed < end) return i;
  }
  return null;
}

function randColor(): string {
  return FEEDBACK_COLORS[Math.floor(Math.random() * FEEDBACK_COLORS.length)];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MimicGame({
  room,
  matchState,
  userId,
}: {
  room: RoomView;
  matchState: Doc<"matchState"> | null;
  userId: Id<"users">;
}) {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const submitAction = useMutation(api.match.submitAction);
  const rematch = useMutation(api.match.rematch);
  const leaveRoom = useLeaveRoom();

  const me = room.players.find((p) => p.userId === userId);
  const opp = room.players.find((p) => p.userId !== userId);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);

  const phase = (matchState?.phase ?? "waiting") as MimicPhase | "waiting";
  const phaseStartedAt = matchState?.phaseStartedAt ?? now;
  const data = (matchState?.data as MimicData | undefined) ?? null;
  const elapsed = now - phaseStartedAt;

  // Pregame countdown
  const pregameSecsLeft = Math.max(0, Math.ceil((PREGAME_DURATION_MS - elapsed) / 1000));

  // Tile flash state (input-phase visual feedback)
  const [tileFlashes, setTileFlashes] = useState<TileFlash[]>([]);
  const flashIdRef = useRef(0);

  // Prevent double-submitting the same step
  const pendingRef = useRef(false);

  function addFlash(tileIndex: number, color: string) {
    const id = flashIdRef.current++;
    setTileFlashes((prev) => [...prev, { tileIndex, color, id }]);
    setTimeout(() => setTileFlashes((prev) => prev.filter((f) => f.id !== id)), 300);
  }

  // ─── Tile click handler ──────────────────────────────────────────────────

  const handleTileClick = useCallback(
    async (tileIndex: number) => {
      if (phase !== "input" || !sessionToken || pendingRef.current) return;
      if (!data) return;

      const myFailed = data.playerFailed[userId as string];
      const myDone = data.playerDone[userId as string];
      if (myFailed || myDone) return;

      // Show random color flash immediately for feedback
      addFlash(tileIndex, randColor());

      pendingRef.current = true;
      try {
        await submitAction({
          sessionToken,
          roomId: room._id,
          action: { type: "tileClick", tileIndex },
        });
      } catch {
        // ignore
      } finally {
        pendingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, sessionToken, room._id, data, userId],
  );

  async function onRematch() {
    if (!sessionToken) return;
    try {
      await rematch({ sessionToken, roomId: room._id });
    } catch (e) {
      console.warn("rematch failed", e);
    }
  }

  // ─── Compute per-tile state ──────────────────────────────────────────────

  function getTileColor(tileIndex: number): string | null {
    if (!data) return null;

    // During showing — highlight active step tile
    if (phase === "showing") {
      const step = getActiveShowStep(elapsed, data.patternLength);
      if (step !== null && data.pattern[step].tileIndex === tileIndex) {
        return data.pattern[step].color;
      }
      return null;
    }

    // During input — show tap flash
    if (phase === "input") {
      const flash = tileFlashes.findLast((f) => f.tileIndex === tileIndex);
      if (flash) return flash.color;
      return null;
    }

    return null;
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const myProgress = data?.playerProgress[userId as string] ?? 0;
  const oppProgress = opp ? (data?.playerProgress[opp.userId as string] ?? 0) : 0;
  const myDone = data?.playerDone[userId as string] ?? false;

  return (
    <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 py-3 sm:py-8 relative overflow-y-auto">
      <div className="relative w-full max-w-md flex flex-col gap-2 sm:gap-3">

        {/* Player chips */}
        <div className="grid grid-cols-2 gap-3">
          <PlayerChip
            who="You"
            handle={`@${me?.handle ?? "you"}`}
            progress={myProgress}
            patternLength={data?.patternLength ?? 3}
            done={myDone}
            highlight="text-lime"
          />
          <PlayerChip
            who="Opp"
            handle={`@${opp?.handle ?? "opponent"}`}
            progress={oppProgress}
            patternLength={data?.patternLength ?? 3}
            done={data?.playerDone[opp?.userId as string ?? ""] ?? false}
            highlight="text-blue"
          />
        </div>

        {/* Main arena */}
        <div className="relative rounded-chunk border-[3px] border-black overflow-hidden shadow-pop-lg">

          {(phase === "waiting" as string) && <WaitingStage />}

          {phase === "pregame" && (
            <PregameStage secsLeft={pregameSecsLeft} />
          )}

          {(phase === "showing" || phase === "input") && data && (
            <PlayStage
              phase={phase}
              data={data}
              getTileColor={getTileColor}
              onTileClick={handleTileClick}
              myDone={myDone}
            />
          )}

          {phase === "match-over" && data && me && (
            <MatchOverStage
              youWin={data.winnerUserId === userId}
              patternLength={data.patternLength}
              myHandle={me.handle}
              oppHandle={opp?.handle ?? "Opponent"}
              ratingDelta={data.ratingDeltas?.[userId as string]}
              onReset={onRematch}
              onLobby={() => router.push(`/play/room/${room.code}`)}
              onMenu={async () => {
                try { await leaveRoom(room._id); } catch { /* best effort */ }
                router.push("/play");
              }}
            />
          )}
        </div>

        {/* Pattern length label */}
        {(phase === "showing" || phase === "input") && data && (
          <div className="text-center text-[10px] font-bold uppercase tracking-widest text-bone-200/50">
            Pattern length: {data.patternLength}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Waiting ──────────────────────────────────────────────────────────────────

function WaitingStage() {
  return (
    <div className="flex items-center justify-center py-24 bg-ink-900">
      <div className="text-bone-200/60 text-sm font-bold uppercase tracking-widest animate-pulse">
        Syncing match…
      </div>
    </div>
  );
}

// ─── Pregame countdown ────────────────────────────────────────────────────────

function PregameStage({ secsLeft }: { secsLeft: number }) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[clamp(320px,50vh,480px)] bg-ink-900 select-none">
      <div className="absolute inset-0 bg-dots opacity-25 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bone-200/50">
          Get ready
        </div>
        <div
          className={cn(
            "font-display leading-none tabular-nums transition-all duration-200",
            secsLeft <= 1
              ? "text-lime text-9xl sm:text-[10rem]"
              : "text-bone-50 text-8xl sm:text-9xl",
          )}
        >
          {secsLeft > 0 ? secsLeft : "GO!"}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bone-200/40">
          memorise the pattern
        </div>
      </div>
    </div>
  );
}

// ─── Play stage (showing + input) ─────────────────────────────────────────────

function PlayStage({
  phase,
  data,
  getTileColor,
  onTileClick,
  myDone,
}: {
  phase: "showing" | "input";
  data: MimicData;
  getTileColor: (tileIndex: number) => string | null;
  onTileClick: (tileIndex: number) => void;
  myDone: boolean;
}) {
  const isShowing = phase === "showing";

  return (
    <div className="bg-ink-900 px-4 py-5 flex flex-col items-center gap-4 select-none">
      {/* Phase label */}
      <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bone-200/60">
        {isShowing ? "Watch the pattern…" : myDone ? "Waiting for opponent…" : "Mimic the pattern!"}
      </div>

      {/* 3×4 tile grid */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(3, 1fr)", width: "100%", maxWidth: 280 }}
      >
        {Array.from({ length: 12 }, (_, i) => {
          const color = getTileColor(i);
          const isLit = color !== null;
          return (
            <button
              key={i}
              onClick={() => !isShowing && onTileClick(i)}
              disabled={isShowing || myDone}
              className={cn(
                "aspect-square rounded-lg border-[3px] border-black transition-all duration-100",
                isShowing
                  ? "cursor-default"
                  : myDone
                  ? "cursor-default opacity-50"
                  : "cursor-pointer active:scale-95",
                isLit ? "shadow-pop" : "bg-white",
              )}
              style={isLit ? { backgroundColor: color! } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Match over ───────────────────────────────────────────────────────────────

function MatchOverStage({
  youWin,
  patternLength,
  myHandle,
  oppHandle,
  ratingDelta,
  onReset,
  onLobby,
  onMenu,
}: {
  youWin: boolean;
  patternLength: number;
  myHandle: string;
  oppHandle: string;
  ratingDelta?: number;
  onReset: () => void;
  onLobby: () => void;
  onMenu: () => void;
}) {
  const deltaSign = ratingDelta !== undefined && ratingDelta >= 0 ? "+" : "";

  return (
    <div className="relative bg-ink-900 px-6 py-10 flex flex-col items-center justify-center text-center gap-4">
      <div className="absolute inset-0 bg-dots opacity-30 pointer-events-none" />

      {/* Outcome banner */}
      <div
        className={cn(
          "relative px-6 py-3 rounded-chunk border-[3px] border-black font-display text-2xl sm:text-3xl shadow-pop-lg",
          youWin ? "bg-lime text-black" : "bg-[#D9281E] text-white",
        )}
      >
        {youWin ? "You win!" : "You lost"}
      </div>

      {/* Pattern info */}
      <div className="relative text-bone-200/70 text-sm">
        Made it to pattern length <span className="font-display text-lemon text-lg">{patternLength}</span>
      </div>

      {/* Player labels */}
      <div className="relative grid grid-cols-2 gap-3 w-full max-w-xs">
        <div
          className={cn(
            "rounded-chunk border-[3px] border-black p-3 text-center",
            youWin ? "bg-lime text-black -translate-y-[2px] shadow-pop" : "bg-ink-800 text-bone-50",
          )}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">
            You {youWin && "· WIN"}
          </div>
          <div className="text-xs font-bold truncate opacity-60">@{myHandle}</div>
        </div>
        <div
          className={cn(
            "rounded-chunk border-[3px] border-black p-3 text-center",
            !youWin ? "bg-[#D9281E] text-white -translate-y-[2px] shadow-pop" : "bg-ink-800 text-bone-50",
          )}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">
            Opp {!youWin && "· WIN"}
          </div>
          <div className="text-xs font-bold truncate opacity-60">@{oppHandle}</div>
        </div>
      </div>

      {/* Rating delta */}
      {ratingDelta !== undefined && (
        <div
          className={cn(
            "relative font-display text-2xl tabular-nums",
            ratingDelta >= 0 ? "text-lemon" : "text-coral",
          )}
        >
          {deltaSign}{ratingDelta.toFixed(3)}
          <span className="text-xs font-bold uppercase tracking-widest ml-1 text-bone-200/60">
            rating
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="relative flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 mt-2 w-full px-2">
        <Button onClick={onReset} size="md" className="w-full sm:w-auto">Rematch</Button>
        <Button onClick={onLobby} size="md" variant="ghost" className="w-full sm:w-auto">Back to room</Button>
        <Button onClick={onMenu} size="md" variant="ghost" className="w-full sm:w-auto">Main menu</Button>
      </div>
    </div>
  );
}

// ─── Player progress chip ─────────────────────────────────────────────────────

function PlayerChip({
  who,
  handle,
  progress,
  patternLength,
  done,
  highlight,
}: {
  who: string;
  handle: string;
  progress: number;
  patternLength: number;
  done: boolean;
  highlight: string;
}) {
  return (
    <div className="border-[3px] border-black rounded-chunk bg-ink-800 p-2 sm:p-3 text-left">
      <div className="flex items-baseline justify-between gap-1">
        <div className="label-cap">{who}</div>
        <div className="text-[9px] sm:text-[10px] font-bold text-bone-200/50 truncate">{handle}</div>
      </div>
      <div className="flex gap-1 mt-1.5 flex-wrap">
        {Array.from({ length: patternLength }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-2.5 h-2.5 rounded-full border border-black",
              done || i < progress
                ? highlight === "text-lime"
                  ? "bg-lime"
                  : "bg-blue"
                : "bg-ink-600",
            )}
          />
        ))}
      </div>
    </div>
  );
}
