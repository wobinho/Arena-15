"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { ACCENT_CLASSES } from "@/lib/games";
import { useAuth } from "@/lib/auth-store";
import { useLeaveRoom } from "@/lib/room-store";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// Mirror server constants
const TARGET_SCORE = 3;
const GRID_SIZE = 25;
const AUTO_ADVANCE_MS = 5_000;

// ─── Types ────────────────────────────────────────────────────────────────────

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

type MinefieldData = {
  openedSafe: number[];
  exploded: boolean;
  explodedAt?: number;
  explodedBy?: Id<"users">;
  currentTurnUserId: Id<"users">;
  turnOrder: Id<"users">[];
  bombIndices?: number[];
  roundWinnerId?: Id<"users">;
  continueVotes?: Id<"users">[];
  ratingDeltas?: Record<string, number>;
};

type BoxState =
  | "unrevealed"
  | "safe"
  | "bomb-hit"
  | "bomb-revealed";

// ─── Main component ───────────────────────────────────────────────────────────

export function MinefieldGame({
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
  const nextRound = useMutation(api.match.nextRound);
  const rematch = useMutation(api.match.rematch);
  const leaveRoom = useLeaveRoom();
  const accent = ACCENT_CLASSES.cyan;

  const me = room.players.find((p) => p.userId === userId);
  const opp = room.players.find((p) => p.userId !== userId);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const pendingRef = useRef<Set<number>>(new Set());

  const phase = (matchState?.phase ?? "waiting") as
    | "waiting"
    | "playing"
    | "round-result"
    | "match-over";
  const phaseStartedAt = matchState?.phaseStartedAt ?? now;
  const data = (matchState?.data as MinefieldData | undefined) ?? null;

  const elapsed = now - phaseStartedAt;

  // Defensive: openedSafe may be undefined if matchState has old-format data.
  const openedSafe: number[] = data?.openedSafe ?? [];
  const isMyTurn = data?.currentTurnUserId === userId;
  // Debug: log turn state to help diagnose isMyTurn=false for both players
  console.log("[Minefield] userId:", userId, "currentTurnUserId:", data?.currentTurnUserId, "isMyTurn:", isMyTurn);
  const youVoted = !!data?.continueVotes?.includes(userId);
  const oppVoted = !!data?.continueVotes?.includes(
    opp?.userId ?? ("" as Id<"users">),
  );

  const autoAdvanceSecondsLeft =
    phase === "round-result"
      ? Math.max(0, Math.ceil((AUTO_ADVANCE_MS - elapsed) / 1000))
      : 0;

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function onOpen(idx: number) {
    if (phase !== "playing") return;
    if (!sessionToken) return;
    if (!isMyTurn) return;
    if (data?.exploded) return;
    if (openedSafe.includes(idx)) return;
    if (pendingRef.current.has(idx)) return;

    pendingRef.current.add(idx);
    setFlashIdx(idx);
    setTimeout(() => setFlashIdx(null), 300);

    try {
      await submitAction({
        sessionToken,
        roomId: room._id,
        action: { type: "open", index: idx },
      });
    } catch (e) {
      console.warn("open failed", e);
    } finally {
      pendingRef.current.delete(idx);
    }
  }

  async function onNextRound() {
    if (!sessionToken) return;
    try {
      await nextRound({ sessionToken, roomId: room._id });
    } catch (e) {
      console.warn("next round failed", e);
    }
  }

  async function onRematch() {
    if (!sessionToken) return;
    try {
      await rematch({ sessionToken, roomId: room._id });
    } catch (e) {
      console.warn("rematch failed", e);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const roundWinnerId = data?.roundWinnerId;
  const iWonRound = roundWinnerId === userId;
  const oppWonRound = roundWinnerId === opp?.userId;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10 relative overflow-hidden">
      <div className="relative w-full max-w-2xl">

        {/* Score cards */}
        <div className="grid grid-cols-2 gap-3 mb-3 text-center">
          <ScoreCard
            who="You"
            handle={`@${me?.handle ?? "you"}`}
            wins={me?.score ?? 0}
            color={accent.text}
          />
          <ScoreCard
            who="Opp"
            handle={`@${opp?.handle ?? "opponent"}`}
            wins={opp?.score ?? 0}
            color="text-blue"
          />
        </div>

        {/* Progress bars */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <ProgressBar value={me?.score ?? 0} max={TARGET_SCORE} tone="bg-cyan" />
          <ProgressBar value={opp?.score ?? 0} max={TARGET_SCORE} tone="bg-blue" />
        </div>

        {/* Round label */}
        <div className="flex items-center justify-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-widest text-bone-200/60">
          <span>Round {matchState?.round ?? 1}</span>
          <span className="opacity-50">·</span>
          <span>First to {TARGET_SCORE} rounds</span>
        </div>

        {/* Main arena */}
        <div className="relative rounded-chunk border-[3px] border-black bg-ink-900 shadow-pop-lg overflow-hidden">
          <div className="absolute inset-0 bg-dots opacity-40" />
          <div className={cn("absolute inset-0 opacity-10", accent.bg)} />

          {phase === "waiting" && (
            <div className="relative flex items-center justify-center py-24 text-bone-200/60 text-sm font-bold uppercase tracking-widest">
              Syncing match…
            </div>
          )}

          {phase === "playing" && data && (
            <PlayingStage
              data={{ ...data, openedSafe }}
              userId={userId}
              isMyTurn={isMyTurn}
              flashIdx={flashIdx}
              myHandle={me?.handle ?? "you"}
              oppHandle={opp?.handle ?? "opponent"}
              accent={accent}
              onOpen={onOpen}
            />
          )}

          {phase === "round-result" && data && (
            <RoundResultStage
              data={data}
              iWonRound={iWonRound}
              oppWonRound={oppWonRound}
              myHandle={me?.handle ?? "you"}
              oppHandle={opp?.handle ?? "opponent"}
              userId={userId}
              yourWins={me?.score ?? 0}
              oppWins={opp?.score ?? 0}
              youVoted={youVoted}
              oppVoted={oppVoted}
              autoAdvanceSecondsLeft={autoAdvanceSecondsLeft}
              accent={accent}
              onNext={onNextRound}
            />
          )}

          {phase === "match-over" && me && data && (
            <MatchOverStage
              youWin={(me.score ?? 0) > (opp?.score ?? 0)}
              yourWins={me.score ?? 0}
              oppWins={opp?.score ?? 0}
              data={data}
              myHandle={me.handle}
              oppHandle={opp?.handle ?? "Opponent"}
              ratingDelta={data?.ratingDeltas?.[userId as string]}
              accent={accent}
              onReset={onRematch}
              onMenu={async () => {
                try { await leaveRoom(room._id); } catch { /* best effort */ }
                router.push("/play");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Playing stage ────────────────────────────────────────────────────────────

function PlayingStage({
  data,
  userId,
  isMyTurn,
  flashIdx,
  myHandle,
  oppHandle,
  accent,
  onOpen,
}: {
  data: MinefieldData;
  userId: Id<"users">;
  isMyTurn: boolean;
  flashIdx: number | null;
  myHandle: string;
  oppHandle: string;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onOpen: (idx: number) => void;
}) {
  const currentHandle = isMyTurn ? myHandle : oppHandle;
  const safeOpened = data.openedSafe.length;
  const safeRemaining = 22 - safeOpened;

  return (
    <div className="relative px-5 pt-5 pb-6">
      {/* Debug: remove once turn bug is diagnosed */}
      <div className="mb-2 p-1 bg-black/60 text-[9px] font-mono text-bone-200/60 rounded break-all">
        <div>me: {userId as string}</div>
        <div>turn: {data.currentTurnUserId as string}</div>
        <div>match: {String(data.currentTurnUserId === userId)}</div>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="label-cap">Minefield</div>
          <div className={cn("font-display text-xl", accent.text)}>
            3 bombs · {safeRemaining} safe left
          </div>
        </div>
        {/* Turn indicator chip */}
        <div
          className={cn(
            "chip border-black font-bold text-xs",
            isMyTurn ? cn(accent.bg, "text-black") : "bg-blue text-black",
          )}
        >
          {isMyTurn ? "Your turn" : `@${currentHandle}'s turn`}
        </div>
      </div>

      {/* Turn banner */}
      <div
        className={cn(
          "mb-4 w-full py-2 rounded-chunk border-[3px] border-black text-center font-display text-base",
          isMyTurn
            ? cn(accent.bg, "text-black")
            : "bg-ink-700 text-bone-200/70",
        )}
      >
        {isMyTurn
          ? "👆 Your turn — pick a box!"
          : `⏳ Waiting for @${oppHandle}…`}
      </div>

      {/* Shared grid */}
      <div className="mb-3">
        <SharedMineGrid
          openedSafe={data.openedSafe}
          exploded={data.exploded}
          explodedAt={data.explodedAt}
          bombIndices={undefined}
          isInteractive={isMyTurn && !data.exploded}
          flashIdx={flashIdx}
          accent={accent}
          onOpen={onOpen}
        />
      </div>

      {/* Opened count */}
      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-bone-200/50">
        <span>{safeOpened} / 22 boxes opened safely</span>
        {data.exploded && (
          <span className="chip border-black bg-coral text-black text-[10px] font-bold ml-2">
            💥 Bomb hit!
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Round result stage ───────────────────────────────────────────────────────

function RoundResultStage({
  data,
  iWonRound,
  oppWonRound,
  myHandle,
  oppHandle,
  userId,
  yourWins,
  oppWins,
  youVoted,
  oppVoted,
  autoAdvanceSecondsLeft,
  accent,
  onNext,
}: {
  data: MinefieldData;
  iWonRound: boolean;
  oppWonRound: boolean;
  myHandle: string;
  oppHandle: string;
  userId: Id<"users">;
  yourWins: number;
  oppWins: number;
  youVoted: boolean;
  oppVoted: boolean;
  autoAdvanceSecondsLeft: number;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onNext: () => void;
}) {
  const isDraw = !iWonRound && !oppWonRound;
  const iHitBomb = data.explodedBy === userId;
  const oppHitBomb = data.exploded && !iHitBomb;

  return (
    <div className="relative px-5 pt-5 pb-6 flex flex-col items-center text-center">
      {/* Outcome banner */}
      <div
        className={cn(
          "px-5 py-2 rounded-chunk border-[3px] border-black font-display text-xl shadow-pop mb-4",
          iWonRound
            ? cn(accent.bg, "text-black")
            : oppWonRound
            ? "bg-blue text-black"
            : "bg-ink-700 text-bone-50",
        )}
      >
        {iWonRound ? "You win the round!" : oppWonRound ? "Opponent wins!" : "Draw!"}
      </div>

      {/* Explosion callout */}
      {iHitBomb && (
        <div className="mb-3 flex items-center gap-2 px-4 py-2 rounded-chunk border-[3px] border-black bg-coral text-black">
          <span className="font-display text-base">
            💥 You hit box #{(data.explodedAt ?? 0) + 1}!
          </span>
        </div>
      )}
      {oppHitBomb && (
        <div className="mb-3 flex items-center gap-2 px-4 py-2 rounded-chunk border-[3px] border-black bg-blue text-black">
          <span className="font-display text-base">
            💥 @{oppHandle} hit box #{(data.explodedAt ?? 0) + 1}!
          </span>
        </div>
      )}

      {/* Revealed shared grid */}
      <div className="w-full mb-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/50 mb-2 text-center">
          Board reveal — {data.openedSafe.length} safe · 3 bombs
        </div>
        <SharedMineGrid
          openedSafe={data.openedSafe}
          exploded={data.exploded}
          explodedAt={data.explodedAt}
          bombIndices={data.bombIndices}
          isInteractive={false}
          flashIdx={null}
          accent={accent}
          onOpen={() => {}}
        />
      </div>

      {/* Score tally */}
      <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/60 mb-4">
        Rounds · {yourWins} – {oppWins}
      </div>

      {/* Continue controls */}
      <div className="flex flex-col items-center gap-1">
        {!youVoted ? (
          <Button onClick={onNext} size="md">
            Continue
          </Button>
        ) : (
          <div className="px-4 py-2 rounded-chunk border-2 border-black bg-ink-700 text-bone-200/60 text-xs font-bold uppercase tracking-widest">
            {oppVoted ? "Starting…" : "Waiting for opponent"}
          </div>
        )}
        <div className="text-[10px] text-bone-200/40 font-bold">
          Auto in {autoAdvanceSecondsLeft}s
        </div>
      </div>
    </div>
  );
}

// ─── Match over stage ─────────────────────────────────────────────────────────

function MatchOverStage({
  youWin,
  yourWins,
  oppWins,
  data,
  myHandle,
  oppHandle,
  ratingDelta,
  accent,
  onReset,
  onMenu,
}: {
  youWin: boolean;
  yourWins: number;
  oppWins: number;
  data: MinefieldData;
  myHandle: string;
  oppHandle: string;
  ratingDelta?: number;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onReset: () => void;
  onMenu: () => void;
}) {
  const deltaSign = ratingDelta !== undefined && ratingDelta >= 0 ? "+" : "";

  return (
    <div className="relative px-6 py-8 flex flex-col items-center justify-center text-center gap-4">
      <div
        className={cn(
          "px-6 py-3 rounded-chunk border-[3px] border-black font-display text-2xl sm:text-3xl shadow-pop-lg",
          youWin ? cn(accent.bg, "text-black") : "bg-blue text-black",
        )}
      >
        {youWin ? "You won the match!" : "Opponent wins the match"}
      </div>

      <div className="font-display text-5xl text-bone-50 tabular-nums mt-1">
        {yourWins}{" "}
        <span className="text-bone-200/40">–</span>{" "}
        {oppWins}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/60">
        Rounds won · first to {TARGET_SCORE}
      </div>

      {/* Final board */}
      <div className="w-full mt-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/50 mb-2 text-center">
          Final board
        </div>
        <SharedMineGrid
          openedSafe={data.openedSafe}
          exploded={data.exploded}
          explodedAt={data.explodedAt}
          bombIndices={data.bombIndices}
          isInteractive={false}
          flashIdx={null}
          accent={accent}
          onOpen={() => {}}
        />
      </div>

      {ratingDelta !== undefined && (
        <div
          className={cn(
            "font-display text-2xl tabular-nums",
            ratingDelta >= 0 ? "text-lemon" : "text-coral",
          )}
        >
          {deltaSign}{ratingDelta.toFixed(3)}
          <span className="text-xs font-bold uppercase tracking-widest ml-1 text-bone-200/60">
            rating
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
        <Button onClick={onReset} size="md">
          Rematch
        </Button>
        <Button onClick={onMenu} size="md" variant="ghost">
          Main menu
        </Button>
      </div>
    </div>
  );
}

// ─── Shared grid ──────────────────────────────────────────────────────────────

function SharedMineGrid({
  openedSafe,
  exploded,
  explodedAt,
  bombIndices,
  isInteractive,
  flashIdx,
  accent,
  onOpen,
}: {
  openedSafe: number[];
  exploded: boolean;
  explodedAt?: number;
  bombIndices: number[] | undefined;
  isInteractive: boolean;
  flashIdx: number | null;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onOpen: (idx: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {Array.from({ length: GRID_SIZE }, (_, idx) => {
        const isSafe = openedSafe.includes(idx);
        const isBombHit = exploded && explodedAt === idx;
        const isBombRevealed = !isBombHit && bombIndices?.includes(idx);
        const isFlashing = flashIdx === idx;

        return (
          <GridCell
            key={idx}
            state={
              isBombHit
                ? "bomb-hit"
                : isBombRevealed
                ? "bomb-revealed"
                : isSafe
                ? "safe"
                : "unrevealed"
            }
            interactive={isInteractive && !isSafe && !isBombHit && !isBombRevealed}
            flashing={isFlashing}
            accent={accent}
            onClick={() => onOpen(idx)}
          />
        );
      })}
    </div>
  );
}

// ─── Individual cells ─────────────────────────────────────────────────────────

function GridCell({
  state,
  interactive,
  flashing,
  accent,
  onClick,
}: {
  state: BoxState;
  interactive: boolean;
  flashing: boolean;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onClick: () => void;
}) {
  return (
    <button
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      className={cn(
        "aspect-square rounded-[6px] border-[2px] border-black font-bold text-base transition-all select-none flex items-center justify-center",
        state === "safe" &&
          cn("border-black text-black text-xs", accent.bg),
        state === "bomb-hit" &&
          "bg-coral text-black border-black animate-pulse",
        state === "bomb-revealed" &&
          "bg-ink-700 text-coral border-black/60",
        state === "unrevealed" &&
          interactive &&
          "bg-ink-700 text-bone-50 hover:bg-ink-600 hover:-translate-y-[1px] hover:shadow-pop-sm active:translate-y-0 cursor-pointer",
        state === "unrevealed" &&
          !interactive &&
          "bg-ink-800 text-bone-200/20 cursor-not-allowed",
        flashing && "scale-95 brightness-150",
      )}
    >
      {state === "safe" && (
        <svg viewBox="0 0 12 12" className="w-3 h-3 fill-black/70">
          <path d="M10 3L5 9 2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {state === "bomb-hit" && <span>💣</span>}
      {state === "bomb-revealed" && <span className="text-xs opacity-70">💣</span>}
    </button>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ScoreCard({
  who,
  handle,
  wins,
  color,
}: {
  who: string;
  handle: string;
  wins: number;
  color: string;
}) {
  return (
    <div className="border-[3px] border-black rounded-chunk bg-ink-800 p-3 text-left">
      <div className="flex items-baseline justify-between gap-2">
        <div className="label-cap">{who}</div>
        <div className="text-[10px] font-bold text-bone-200/50 truncate">{handle}</div>
      </div>
      <div className={cn("font-display text-3xl mt-1 tabular-nums", color)}>
        {wins}
        <span className="text-sm font-bold ml-1 text-bone-200/50">
          / {TARGET_SCORE}
        </span>
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 bg-ink-700 border-2 border-black rounded-full overflow-hidden">
      <div
        className={cn("h-full transition-all duration-500", tone)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
