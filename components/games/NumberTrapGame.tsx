"use client";

import { useEffect, useRef, useState } from "react";
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
const PICK_DURATION_MS = 15_000;
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

type PickEntry = {
  userId: Id<"users">;
  pick: number;
  timedOut: boolean;
};

type RoundResult = {
  round: number;
  picks: PickEntry[];
  sum: number;
  trapTriggered: boolean;
  winnerUserId?: Id<"users">;
};

type MatchData = {
  picks: Record<string, number>;
  lastRound?: RoundResult;
  continueVotes?: Id<"users">[];
  ratingDeltas?: Record<string, number>;
};

// ─── Main component ───────────────────────────────────────────────────────────

export function NumberTrapGame({
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
  const accent = ACCENT_CLASSES.coral;

  const me = room.players.find((p) => p.userId === userId);
  const opp = room.players.find((p) => p.userId !== userId);

  // Live clock — ticks every 100 ms for smooth countdown
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const phase = (matchState?.phase ?? "waiting") as
    | "waiting"
    | "picking"
    | "round-result"
    | "match-over";
  const phaseStartedAt = matchState?.phaseStartedAt ?? now;
  const data = (matchState?.data as MatchData | undefined) ?? null;

  // Countdown state
  const elapsed = now - phaseStartedAt;
  const msLeft = Math.max(0, PICK_DURATION_MS - elapsed);
  const secsLeft = Math.ceil(msLeft / 1000);
  const timerDanger = secsLeft <= 5;

  // Per-player state
  const myPick = data?.picks?.[userId as string];
  const hasPickedRef = useRef(false);
  useEffect(() => {
    if (myPick !== undefined) hasPickedRef.current = true;
    if (phase !== "picking") hasPickedRef.current = false;
  }, [myPick, phase]);

  const oppHasPicked =
    opp && data?.picks?.[opp.userId as string] !== undefined;

  const youVoted = !!data?.continueVotes?.includes(userId);
  const oppVoted = !!data?.continueVotes?.includes(
    opp?.userId ?? ("" as Id<"users">),
  );

  const autoAdvanceSecondsLeft =
    phase === "round-result"
      ? Math.max(0, Math.ceil((AUTO_ADVANCE_MS - elapsed) / 1000))
      : 0;

  const lastRound = data?.lastRound;

  // Fallback opp score from lastRound when they've disconnected
  const oppFinalScore: number = opp?.score ?? 0;

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function onPick(num: number) {
    if (phase !== "picking" || myPick !== undefined || !sessionToken) return;
    try {
      await submitAction({
        sessionToken,
        roomId: room._id,
        action: { type: "pick", number: num },
      });
    } catch (e) {
      console.warn("pick failed", e);
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

  return (
    <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 py-3 sm:py-8 relative overflow-y-auto">
      <div className="relative w-full max-w-xl">
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
          <ProgressBar value={me?.score ?? 0} max={TARGET_SCORE} tone="bg-coral" />
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

          {phase === "picking" && (
            <PickingStage
              myPick={myPick}
              oppHasPicked={!!oppHasPicked}
              secsLeft={secsLeft}
              timerDanger={timerDanger}
              accent={accent}
              onPick={onPick}
            />
          )}

          {phase === "round-result" && lastRound && me && (
            <RoundResultStage
              result={lastRound}
              userId={userId}
              oppUserId={opp?.userId}
              myHandle={me.handle}
              oppHandle={opp?.handle ?? "Opponent"}
              yourWins={me.score}
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
              youWin={
                lastRound
                  ? lastRound.picks.some(
                      (p) => p.userId === userId,
                    ) &&
                    (me.score > (opp?.score ?? 0))
                  : me.score > (opp?.score ?? 0)
              }
              yourWins={me.score}
              oppWins={opp?.score ?? (oppFinalScore as number) ?? 0}
              ratingDelta={data?.ratingDeltas?.[userId as string]}
              lastRound={lastRound ?? undefined}
              userId={userId}
              oppUserId={opp?.userId}
              myHandle={me.handle}
              oppHandle={opp?.handle ?? "Opponent"}
              accent={accent}
              onReset={onRematch}
              onLobby={() => router.push(`/play/room/${room.code}`)}
              onMenu={async () => {
                try {
                  await leaveRoom(room._id);
                } catch {
                  /* best effort */
                }
                router.push("/play");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Picking stage ────────────────────────────────────────────────────────────

function PickingStage({
  myPick,
  oppHasPicked,
  secsLeft,
  timerDanger,
  accent,
  onPick,
}: {
  myPick: number | undefined;
  oppHasPicked: boolean;
  secsLeft: number;
  timerDanger: boolean;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onPick: (n: number) => void;
}) {
  const locked = myPick !== undefined;

  return (
    <div className="relative px-3 sm:px-5 pt-4 sm:pt-5 pb-4 sm:pb-6">
      {/* Header row: title + timer */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="label-cap">Pick your number</div>
          <div className={cn("font-display text-2xl", accent.text)}>1 – 20</div>
        </div>
        <Timer secsLeft={secsLeft} danger={timerDanger} />
      </div>

      {/* Status chips */}
      <div className="flex gap-2 mb-4">
        <span
          className={cn(
            "chip border-black text-xs font-bold",
            locked ? cn(accent.bg, "text-black") : "bg-ink-700 text-bone-200/60",
          )}
        >
          You {locked ? `· ${myPick}` : "· choosing…"}
        </span>
        <span
          className={cn(
            "chip border-black text-xs font-bold",
            oppHasPicked
              ? "bg-blue text-black"
              : "bg-ink-700 text-bone-200/60",
          )}
        >
          Opp {oppHasPicked ? "· locked" : "· choosing…"}
        </span>
      </div>

      {/* Number grid: 4 rows × 5 columns */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
          <NumberButton
            key={n}
            n={n}
            selected={myPick === n}
            disabled={locked}
            accent={accent}
            onClick={() => onPick(n)}
          />
        ))}
      </div>

      {locked && (
        <div className="mt-4 text-center text-[11px] font-bold uppercase tracking-widest text-bone-200/60 animate-pulse">
          {oppHasPicked ? "Both locked in — resolving…" : "Waiting for opponent…"}
        </div>
      )}
    </div>
  );
}

function NumberButton({
  n,
  selected,
  disabled,
  accent,
  onClick,
}: {
  n: number;
  selected: boolean;
  disabled: boolean;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative aspect-square rounded-chunk border-[3px] border-black font-display text-lg transition-all select-none",
        selected
          ? cn(accent.bg, "text-black shadow-pop -translate-y-[2px]")
          : disabled
          ? "bg-ink-800 text-bone-200/30 cursor-not-allowed"
          : "bg-ink-800 text-bone-50 hover:bg-ink-700 hover:-translate-y-[1px] hover:shadow-pop-sm active:translate-y-0",
      )}
    >
      {n}
      {/* Subtle trap indicator for numbers that could cause a trap with 1 */}
    </button>
  );
}

function Timer({
  secsLeft,
  danger,
}: {
  secsLeft: number;
  danger: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-16 h-16 rounded-chunk border-[3px] border-black font-display text-3xl transition-colors",
        danger ? "bg-coral text-black animate-pulse" : "bg-ink-800 text-bone-50",
      )}
    >
      {secsLeft}
      <div className="text-[8px] font-bold uppercase tracking-widest opacity-60 -mt-1">
        sec
      </div>
    </div>
  );
}

// ─── Round result stage ───────────────────────────────────────────────────────

function RoundResultStage({
  result,
  userId,
  oppUserId,
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
  result: RoundResult;
  userId: Id<"users">;
  oppUserId?: Id<"users">;
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
  const myEntry = result.picks.find((p) => p.userId === userId);
  const oppEntry = result.picks.find(
    (p) => p.userId === (oppUserId ?? ("" as Id<"users">)),
  );
  const iWon = result.winnerUserId === userId;
  const oppWon = result.winnerUserId === oppUserId;
  const isDraw = !result.winnerUserId;

  return (
    <div className="relative px-3 sm:px-5 pt-4 sm:pt-5 pb-4 sm:pb-6 flex flex-col items-center text-center">
      {/* Round outcome banner */}
      <div
        className={cn(
          "px-5 py-2 rounded-chunk border-[3px] border-black font-display text-xl shadow-pop mb-4",
          iWon
            ? cn(accent.bg, "text-black")
            : oppWon
            ? "bg-blue text-black"
            : "bg-ink-700 text-bone-50",
        )}
      >
        {iWon ? "You win the round!" : oppWon ? "Opponent wins!" : "Draw!"}
      </div>

      {/* The trap callout */}
      {result.trapTriggered && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2 rounded-chunk border-[3px] border-black bg-coral text-black">
          <span className="font-display text-lg">⚠ TRAP!</span>
          <span className="text-xs font-bold uppercase tracking-widest">
            Sum was {result.sum} &gt; 20 · lower wins
          </span>
        </div>
      )}

      {!result.trapTriggered && (
        <div className="mb-4 text-[11px] font-bold uppercase tracking-widest text-bone-200/50">
          Sum: {result.sum} · safe zone
        </div>
      )}

      {/* Pick cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-4">
        <PickCard
          label="You"
          handle={`@${myHandle}`}
          entry={myEntry}
          winner={iWon}
          accentBg={accent.bg}
        />
        <PickCard
          label="Opp"
          handle={`@${oppHandle}`}
          entry={oppEntry}
          winner={oppWon}
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

function PickCard({
  label,
  handle,
  entry,
  winner,
  accentBg,
}: {
  label: string;
  handle: string;
  entry?: PickEntry;
  winner: boolean;
  accentBg: string;
}) {
  return (
    <div
      className={cn(
        "rounded-chunk border-[3px] border-black p-4 text-center transition-all",
        winner
          ? cn(accentBg, "text-black -translate-y-[2px] shadow-pop")
          : "bg-ink-800 text-bone-50",
      )}
    >
      <div
        className={cn(
          "text-[10px] font-bold uppercase tracking-widest mb-1",
          winner ? "text-black/70" : "text-bone-200/60",
        )}
      >
        {label} {winner && "· WIN"}
      </div>
      <div className="font-display text-5xl tabular-nums">
        {entry?.timedOut ? (
          <span className="text-2xl text-bone-200/40">–</span>
        ) : (
          entry?.pick ?? "?"
        )}
      </div>
      <div
        className={cn(
          "text-[10px] font-bold mt-1 truncate",
          winner ? "text-black/60" : "text-bone-200/50",
        )}
      >
        {entry?.timedOut ? "timed out" : handle}
      </div>
    </div>
  );
}

// ─── Match over stage ─────────────────────────────────────────────────────────

function MatchOverStage({
  youWin,
  yourWins,
  oppWins,
  ratingDelta,
  lastRound,
  userId,
  oppUserId,
  myHandle,
  oppHandle,
  accent,
  onReset,
  onLobby,
  onMenu,
}: {
  youWin: boolean;
  yourWins: number;
  oppWins: number;
  ratingDelta?: number;
  lastRound?: RoundResult;
  userId: Id<"users">;
  oppUserId?: Id<"users">;
  myHandle: string;
  oppHandle: string;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onReset: () => void;
  onLobby: () => void;
  onMenu: () => void;
}) {
  const deltaSign = ratingDelta !== undefined && ratingDelta >= 0 ? "+" : "";

  const myEntry = lastRound?.picks.find((p) => p.userId === userId);
  const oppEntry = lastRound?.picks.find(
    (p) => p.userId === (oppUserId ?? ("" as Id<"users">)),
  );
  const myPickWon = lastRound?.winnerUserId === userId;
  const oppPickWon = lastRound?.winnerUserId === oppUserId;

  return (
    <div className="relative px-4 sm:px-6 py-5 sm:py-8 flex flex-col items-center justify-center text-center gap-3 sm:gap-4">
      <div
        className={cn(
          "px-6 py-3 rounded-chunk border-[3px] border-black font-display text-2xl sm:text-3xl shadow-pop-lg",
          youWin ? cn(accent.bg, "text-black") : "bg-blue text-black",
        )}
      >
        {youWin ? "You won the match!" : "Opponent wins the match"}
      </div>

      <div className="font-display text-5xl text-bone-50 tabular-nums mt-2">
        {yourWins}{" "}
        <span className="text-bone-200/40">–</span>{" "}
        {oppWins}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/60">
        Rounds won · first to {TARGET_SCORE}
      </div>

      {/* Final round pick reveal */}
      {lastRound && (
        <div className="w-full max-w-sm mt-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/50 mb-2">
            Deciding round
          </div>
          {lastRound.trapTriggered && (
            <div className="mb-2 flex items-center justify-center gap-2 px-4 py-2 rounded-chunk border-[3px] border-black bg-coral text-black">
              <span className="font-display text-base">⚠ TRAP!</span>
              <span className="text-xs font-bold uppercase tracking-widest">
                Sum {lastRound.sum} &gt; 20 · lower wins
              </span>
            </div>
          )}
          {!lastRound.trapTriggered && (
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-bone-200/50">
              Sum: {lastRound.sum} · safe zone
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <PickCard
              label="You"
              handle={`@${myHandle}`}
              entry={myEntry}
              winner={myPickWon}
              accentBg={accent.bg}
            />
            <PickCard
              label="Opp"
              handle={`@${oppHandle}`}
              entry={oppEntry}
              winner={oppPickWon}
              accentBg="bg-blue"
            />
          </div>
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

      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 mt-2 w-full px-2">
        <Button onClick={onReset} size="md" className="w-full sm:w-auto">
          Rematch
        </Button>
        <Button onClick={onLobby} size="md" variant="ghost" className="w-full sm:w-auto">
          Back to room
        </Button>
        <Button onClick={onMenu} size="md" variant="ghost" className="w-full sm:w-auto">
          Main menu
        </Button>
      </div>
    </div>
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
    <div className="border-[3px] border-black rounded-chunk bg-ink-800 p-2 sm:p-3 text-left">
      <div className="flex items-baseline justify-between gap-1">
        <div className="label-cap">{who}</div>
        <div className="text-[9px] sm:text-[10px] font-bold text-bone-200/50 truncate">{handle}</div>
      </div>
      <div className={cn("font-display text-2xl sm:text-3xl mt-0.5 tabular-nums", color)}>
        {wins}
        <span className="text-xs sm:text-sm font-bold ml-1 text-bone-200/50">
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
