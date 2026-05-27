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

type PlayerState = {
  openedSafe: number[];
  exploded: boolean;
  explodedAt?: number;
};

type MinefieldData = {
  playerStates: Record<string, PlayerState>;
  bombIndices?: number[]; // Revealed at round end
  roundWinnerId?: Id<"users">;
  continueVotes?: Id<"users">[];
  ratingDeltas?: Record<string, number>;
};

type BoxState =
  | "unrevealed"
  | "safe"
  | "bomb-hit"      // The bomb this player hit
  | "bomb-revealed" // Other bombs shown at round end
  | "opp-safe";     // Opponent's safe open (shown on opp grid)

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

  // Track boxes that are "animating" (shake on wrong click attempt, flash on open)
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

  const myState = data?.playerStates?.[userId as string];
  const oppState = opp ? data?.playerStates?.[opp.userId as string] : undefined;

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
    if (myState?.exploded) return;
    if (myState?.openedSafe?.includes(idx)) return;
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

  // ─── Grid helpers ─────────────────────────────────────────────────────────

  /** Compute per-cell display state for a given player. */
  function getCellState(
    idx: number,
    ps: PlayerState | undefined,
    bombIndices: number[] | undefined,
  ): BoxState {
    if (!ps) return "unrevealed";
    if (ps.openedSafe.includes(idx)) return "safe";
    if (ps.exploded && ps.explodedAt === idx) return "bomb-hit";
    if (bombIndices?.includes(idx)) return "bomb-revealed";
    return "unrevealed";
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

          {phase === "playing" && myState && (
            <PlayingStage
              myState={myState}
              oppState={oppState}
              flashIdx={flashIdx}
              myHandle={me?.handle ?? "you"}
              oppHandle={opp?.handle ?? "opponent"}
              accent={accent}
              onOpen={onOpen}
            />
          )}

          {phase === "round-result" && myState && (
            <RoundResultStage
              myState={myState}
              oppState={oppState}
              bombIndices={data?.bombIndices}
              iWonRound={iWonRound}
              oppWonRound={oppWonRound}
              myHandle={me?.handle ?? "you"}
              oppHandle={opp?.handle ?? "opponent"}
              yourWins={me?.score ?? 0}
              oppWins={opp?.score ?? 0}
              youVoted={youVoted}
              oppVoted={oppVoted}
              autoAdvanceSecondsLeft={autoAdvanceSecondsLeft}
              accent={accent}
              onNext={onNextRound}
            />
          )}

          {phase === "match-over" && me && (
            <MatchOverStage
              youWin={(me.score ?? 0) > (opp?.score ?? 0)}
              yourWins={me.score ?? 0}
              oppWins={opp?.score ?? 0}
              myState={myState}
              oppState={oppState}
              bombIndices={data?.bombIndices}
              myHandle={me.handle}
              oppHandle={opp?.handle ?? "Opponent"}
              ratingDelta={data?.ratingDeltas?.[userId as string]}
              accent={accent}
              onReset={onRematch}
              onLobby={() => router.push(`/play/room/${room.code}`)}
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
  myState,
  oppState,
  flashIdx,
  myHandle,
  oppHandle,
  accent,
  onOpen,
}: {
  myState: PlayerState;
  oppState: PlayerState | undefined;
  flashIdx: number | null;
  myHandle: string;
  oppHandle: string;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onOpen: (idx: number) => void;
}) {
  const myExploded = myState.exploded;
  const oppExploded = oppState?.exploded ?? false;
  const myOpened = myState.openedSafe.length;
  const oppOpened = oppState?.openedSafe.length ?? 0;

  return (
    <div className="relative px-5 pt-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="label-cap">Minefield</div>
          <div className={cn("font-display text-xl", accent.text)}>
            3 bombs · 22 safe
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusChip
            label={`You · ${myOpened} opened`}
            alive={!myExploded}
            accentBg={accent.bg}
          />
          <StatusChip
            label={`Opp · ${oppOpened} opened`}
            alive={!oppExploded}
            accentBg="bg-blue"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/50 mb-2 text-center">
          Your grid — click to open
        </div>
        <MineGrid
          playerState={myState}
          bombIndices={undefined}
          isInteractive={!myExploded}
          flashIdx={flashIdx}
          accent={accent}
          onOpen={onOpen}
        />
      </div>

      {/* Opponent status bar */}
      <div className="mt-4 flex items-center justify-between px-3 py-2 rounded-chunk border-2 border-black bg-ink-800">
        <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/50">
          @{oppHandle}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/60">
            {oppOpened} boxes opened
          </div>
          {oppExploded ? (
            <span className="chip border-black bg-coral text-black text-[10px] font-bold">
              💥 Exploded
            </span>
          ) : (
            <span className="chip border-black bg-ink-700 text-bone-200/60 text-[10px] font-bold animate-pulse">
              Still going…
            </span>
          )}
        </div>
      </div>

      {myExploded && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-chunk border-[3px] border-black bg-coral text-black font-display text-lg shadow-pop animate-bounce">
            💥 You hit a bomb!
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Round result stage ───────────────────────────────────────────────────────

function RoundResultStage({
  myState,
  oppState,
  bombIndices,
  iWonRound,
  oppWonRound,
  myHandle,
  oppHandle,
  yourWins,
  oppWins,
  youVoted,
  oppVoted,
  autoAdvanceSecondsLeft,
  accent,
  onNext,
}: {
  myState: PlayerState;
  oppState: PlayerState | undefined;
  bombIndices: number[] | undefined;
  iWonRound: boolean;
  oppWonRound: boolean;
  myHandle: string;
  oppHandle: string;
  yourWins: number;
  oppWins: number;
  youVoted: boolean;
  oppVoted: boolean;
  autoAdvanceSecondsLeft: number;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onNext: () => void;
}) {
  const isDraw = !iWonRound && !oppWonRound;

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
      {myState.exploded && (
        <div className="mb-3 flex items-center gap-2 px-4 py-2 rounded-chunk border-[3px] border-black bg-coral text-black">
          <span className="font-display text-base">💥 You hit box #{(myState.explodedAt ?? 0) + 1}!</span>
        </div>
      )}
      {oppState?.exploded && !myState.exploded && (
        <div className="mb-3 flex items-center gap-2 px-4 py-2 rounded-chunk border-[3px] border-black bg-blue text-black">
          <span className="font-display text-base">💥 Opponent hit box #{(oppState.explodedAt ?? 0) + 1}!</span>
        </div>
      )}

      {/* Side-by-side grids with bombs revealed */}
      <div className="w-full grid grid-cols-2 gap-4 mb-4">
        <GridReveal
          label="You"
          handle={`@${myHandle}`}
          playerState={myState}
          bombIndices={bombIndices}
          won={iWonRound}
          accentBg={accent.bg}
        />
        <GridReveal
          label="Opp"
          handle={`@${oppHandle}`}
          playerState={oppState}
          bombIndices={bombIndices}
          won={oppWonRound}
          accentBg="bg-blue"
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
  myState,
  oppState,
  bombIndices,
  myHandle,
  oppHandle,
  ratingDelta,
  accent,
  onReset,
  onLobby,
  onMenu,
}: {
  youWin: boolean;
  yourWins: number;
  oppWins: number;
  myState: PlayerState | undefined;
  oppState: PlayerState | undefined;
  bombIndices: number[] | undefined;
  myHandle: string;
  oppHandle: string;
  ratingDelta?: number;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onReset: () => void;
  onLobby: () => void;
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

      {/* Final grids */}
      {(myState || oppState) && (
        <div className="w-full grid grid-cols-2 gap-4 mt-1">
          <GridReveal
            label="You"
            handle={`@${myHandle}`}
            playerState={myState}
            bombIndices={bombIndices}
            won={youWin}
            accentBg={accent.bg}
          />
          <GridReveal
            label="Opp"
            handle={`@${oppHandle}`}
            playerState={oppState}
            bombIndices={bombIndices}
            won={!youWin}
            accentBg="bg-blue"
          />
        </div>
      )}

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
        <Button onClick={onLobby} size="md" variant="ghost">
          Back to room
        </Button>
        <Button onClick={onMenu} size="md" variant="ghost">
          Main menu
        </Button>
      </div>
    </div>
  );
}

// ─── Grid components ──────────────────────────────────────────────────────────

/** Interactive grid (playing phase — only shown for the local player). */
function MineGrid({
  playerState,
  bombIndices,
  isInteractive,
  flashIdx,
  accent,
  onOpen,
}: {
  playerState: PlayerState;
  bombIndices: number[] | undefined;
  isInteractive: boolean;
  flashIdx: number | null;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onOpen: (idx: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {Array.from({ length: GRID_SIZE }, (_, idx) => {
        const isSafe = playerState.openedSafe.includes(idx);
        const isBombHit = playerState.exploded && playerState.explodedAt === idx;
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

/** Compact read-only grid for post-round reveal panels. */
function GridReveal({
  label,
  handle,
  playerState,
  bombIndices,
  won,
  accentBg,
}: {
  label: string;
  handle: string;
  playerState: PlayerState | undefined;
  bombIndices: number[] | undefined;
  won: boolean;
  accentBg: string;
}) {
  const openedSafe = playerState?.openedSafe ?? [];
  const explodedAt = playerState?.explodedAt;
  const exploded = playerState?.exploded ?? false;

  return (
    <div
      className={cn(
        "rounded-chunk border-[3px] border-black p-3 transition-all",
        won ? cn(accentBg, "text-black -translate-y-[2px] shadow-pop") : "bg-ink-800",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between mb-2",
          won ? "text-black/70" : "text-bone-200/60",
        )}
      >
        <div className="text-[10px] font-bold uppercase tracking-widest">
          {label} {won ? "· WIN" : exploded ? "· 💥" : ""}
        </div>
        <div className="text-[9px] font-bold truncate max-w-[60px]">{handle}</div>
      </div>
      <div className="grid grid-cols-5 gap-[3px]">
        {Array.from({ length: GRID_SIZE }, (_, idx) => {
          const isSafe = openedSafe.includes(idx);
          const isBombHit = exploded && explodedAt === idx;
          const isBombRevealed = !isBombHit && bombIndices?.includes(idx);

          return (
            <MiniCell
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
              won={won}
            />
          );
        })}
      </div>
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

function MiniCell({
  state,
  won,
}: {
  state: BoxState;
  won: boolean;
}) {
  return (
    <div
      className={cn(
        "aspect-square rounded-[3px] border border-black/50 flex items-center justify-center text-[8px]",
        state === "safe" &&
          (won ? "bg-black/20" : "bg-ink-600 border-ink-500"),
        state === "bomb-hit" && "bg-coral border-coral",
        state === "bomb-revealed" && "bg-ink-700 border-coral/40",
        state === "unrevealed" &&
          (won ? "bg-black/10 border-black/20" : "bg-ink-800 border-black/30"),
      )}
    >
      {(state === "bomb-hit" || state === "bomb-revealed") && (
        <span>💣</span>
      )}
      {state === "safe" && (
        <span className={won ? "text-black/50" : "text-bone-200/40"}>·</span>
      )}
    </div>
  );
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({
  label,
  alive,
  accentBg,
}: {
  label: string;
  alive: boolean;
  accentBg: string;
}) {
  return (
    <span
      className={cn(
        "chip border-black text-xs font-bold",
        alive ? cn(accentBg, "text-black") : "bg-coral text-black",
      )}
    >
      {alive ? label : `${label} · 💥`}
    </span>
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
