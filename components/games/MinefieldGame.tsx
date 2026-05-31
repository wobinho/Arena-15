"use client";

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
const BOARD_SIZE = 25;
const BOMB_COUNT = 3;
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

type MinefieldRoundResult = {
  round: number;
  bombs: number[];
  opened: number[];
  bombHit: number;
  loserUserId: Id<"users">;
  winnerUserId?: Id<"users">;
};

type MatchData = {
  opened: number[];
  currentTurn: Id<"users">;
  lastRound?: MinefieldRoundResult;
  continueVotes?: Id<"users">[];
  ratingDeltas?: Record<string, number>;
};

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

  const phase = (matchState?.phase ?? "waiting") as
    | "waiting"
    | "playing"
    | "round-result"
    | "match-over";
  const phaseStartedAt = matchState?.phaseStartedAt ?? Date.now();
  const data = (matchState?.data as MatchData | undefined) ?? null;

  const isMyTurn = data?.currentTurn !== undefined &&
    (data.currentTurn as string) === (userId as string);

  const autoAdvanceSecondsLeft =
    phase === "round-result"
      ? Math.max(0, Math.ceil((AUTO_ADVANCE_MS - (Date.now() - phaseStartedAt)) / 1000))
      : 0;

  const youVoted = !!data?.continueVotes?.includes(userId);
  const oppVoted = !!data?.continueVotes?.includes(opp?.userId ?? ("" as Id<"users">));

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function onOpenBox(idx: number) {
    if (phase !== "playing" || !isMyTurn || !sessionToken) return;
    if (data?.opened.includes(idx)) return;
    try {
      await submitAction({
        sessionToken,
        roomId: room._id,
        action: { type: "open", boxIndex: idx },
      });
    } catch (e) {
      console.warn("open failed", e);
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
          <ProgressBar value={me?.score ?? 0} max={TARGET_SCORE} tone="bg-cyan" />
          <ProgressBar value={opp?.score ?? 0} max={TARGET_SCORE} tone="bg-blue" />
        </div>

        {/* Round label */}
        <div className="flex items-center justify-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-widest text-bone-200/60">
          <span>Round {matchState?.round ?? 1}</span>
          <span className="opacity-50">·</span>
          <span>First to {TARGET_SCORE} rounds</span>
          <span className="opacity-50">·</span>
          <span>{BOMB_COUNT} bombs in {BOARD_SIZE} boxes</span>
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
              opened={data.opened}
              isMyTurn={isMyTurn}
              myHandle={me?.handle ?? "you"}
              oppHandle={opp?.handle ?? "opponent"}
              currentTurnUserId={data.currentTurn}
              userId={userId}
              accent={accent}
              onOpenBox={onOpenBox}
            />
          )}

          {phase === "round-result" && data?.lastRound && (
            <RoundResultStage
              result={data.lastRound}
              userId={userId}
              oppUserId={opp?.userId}
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
              youWin={me.score > (opp?.score ?? 0)}
              yourWins={me.score}
              oppWins={opp?.score ?? 0}
              ratingDelta={data?.ratingDeltas?.[userId as string]}
              lastRound={data?.lastRound}
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

// ─── Playing stage ────────────────────────────────────────────────────────────

function PlayingStage({
  opened,
  isMyTurn,
  myHandle,
  oppHandle,
  currentTurnUserId,
  userId,
  accent,
  onOpenBox,
}: {
  opened: number[];
  isMyTurn: boolean;
  myHandle: string;
  oppHandle: string;
  currentTurnUserId: Id<"users">;
  userId: Id<"users">;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onOpenBox: (idx: number) => void;
}) {
  const turnName = (currentTurnUserId as string) === (userId as string) ? myHandle : oppHandle;

  return (
    <div className="relative px-3 sm:px-5 pt-4 sm:pt-5 pb-4 sm:pb-6">
      {/* Turn indicator */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="label-cap">Current turn</div>
          <div
            className={cn(
              "font-display text-xl",
              isMyTurn ? accent.text : "text-blue",
            )}
          >
            {isMyTurn ? "Your turn" : `@${turnName}'s turn`}
          </div>
        </div>
        <div className="flex gap-2">
          <span
            className={cn(
              "chip border-black text-xs font-bold",
              isMyTurn ? cn(accent.bg, "text-black") : "bg-ink-700 text-bone-200/50",
            )}
          >
            You
          </span>
          <span
            className={cn(
              "chip border-black text-xs font-bold",
              !isMyTurn ? "bg-blue text-black" : "bg-ink-700 text-bone-200/50",
            )}
          >
            Opp
          </span>
        </div>
      </div>

      {/* Hint bar */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-chunk border-[2px] border-black bg-ink-800">
        <span className="text-[10px] font-bold uppercase tracking-widest text-bone-200/50">
          {BOMB_COUNT} bombs hidden ·
        </span>
        <span className={cn("font-display text-sm", accent.text)}>
          {opened.length} / {BOARD_SIZE - BOMB_COUNT} safe boxes found
        </span>
      </div>

      {/* 5×5 grid */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {Array.from({ length: BOARD_SIZE }, (_, i) => {
          const isOpened = opened.includes(i);
          return (
            <BoxButton
              key={i}
              index={i}
              isOpened={isOpened}
              canClick={isMyTurn && !isOpened}
              accent={accent}
              onClick={() => onOpenBox(i)}
            />
          );
        })}
      </div>

      {!isMyTurn && (
        <div className="mt-4 text-center text-[11px] font-bold uppercase tracking-widest text-bone-200/50 animate-pulse">
          Waiting for opponent to open a box…
        </div>
      )}
    </div>
  );
}

function BoxButton({
  index,
  isOpened,
  canClick,
  accent,
  onClick,
}: {
  index: number;
  isOpened: boolean;
  canClick: boolean;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onClick: () => void;
}) {
  if (isOpened) {
    return (
      <div className="aspect-square rounded-chunk border-[3px] border-black bg-ink-700 flex items-center justify-center">
        <span className="text-lime font-display text-lg">✓</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={!canClick}
      className={cn(
        "relative aspect-square rounded-chunk border-[3px] border-black font-display text-sm transition-all select-none",
        canClick
          ? cn(
              "bg-ink-800 text-bone-200/60",
              "hover:bg-ink-700 hover:-translate-y-[2px] hover:shadow-pop active:translate-y-0",
              accent.text,
            )
          : "bg-ink-800 text-bone-200/20 cursor-not-allowed",
      )}
    >
      {index + 1}
    </button>
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
  result: MinefieldRoundResult;
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
  const iWon = (result.winnerUserId as string) === (userId as string);
  const oppWon = (result.winnerUserId as string) === (oppUserId as string);

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
        {iWon ? "You win the round!" : oppWon ? "Opponent wins!" : "Round over"}
      </div>

      {/* Who hit the bomb */}
      <div className="mb-4 flex items-center gap-2 px-4 py-2 rounded-chunk border-[3px] border-black bg-coral/20 border-coral text-coral">
        <span className="font-display text-base">💣</span>
        <span className="text-xs font-bold uppercase tracking-widest">
          Box {result.bombHit + 1} was a bomb!
          {" "}
          {(result.loserUserId as string) === (userId as string) ? "You" : `@${oppHandle}`} hit it.
        </span>
      </div>

      {/* Board reveal — 5×5 with bomb and safe indicators */}
      <div className="mb-4 w-full">
        <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/50 mb-2">
          Board reveal
        </div>
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          {Array.from({ length: BOARD_SIZE }, (_, i) => {
            const isBomb = result.bombs.includes(i);
            const wasOpened = result.opened.includes(i);
            const wasBombHit = i === result.bombHit;

            return (
              <RevealedBox
                key={i}
                index={i}
                isBomb={isBomb}
                wasOpened={wasOpened}
                wasBombHit={wasBombHit}
              />
            );
          })}
        </div>
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

function RevealedBox({
  index,
  isBomb,
  wasOpened,
  wasBombHit,
}: {
  index: number;
  isBomb: boolean;
  wasOpened: boolean;
  wasBombHit: boolean;
}) {
  if (wasBombHit) {
    return (
      <div className="aspect-square rounded-chunk border-[3px] border-black bg-coral flex items-center justify-center shadow-pop">
        <span className="text-sm sm:text-base">💣</span>
      </div>
    );
  }
  if (isBomb) {
    return (
      <div className="aspect-square rounded-chunk border-[3px] border-black bg-coral/30 flex items-center justify-center">
        <span className="text-sm sm:text-base">💣</span>
      </div>
    );
  }
  if (wasOpened) {
    return (
      <div className="aspect-square rounded-chunk border-[3px] border-black bg-ink-700 flex items-center justify-center">
        <span className="text-lime font-display text-sm">✓</span>
      </div>
    );
  }
  return (
    <div className="aspect-square rounded-chunk border-[2px] border-black bg-ink-800 flex items-center justify-center">
      <span className="text-[10px] font-bold text-bone-200/30">{index + 1}</span>
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
  lastRound?: MinefieldRoundResult;
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

      {/* Final round board reveal */}
      {lastRound && (
        <div className="w-full mt-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/50 mb-2">
            Deciding round — board
          </div>
          <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-bone-200/50">
            <span className="text-coral">
              💣 Box {lastRound.bombHit + 1} was the bomb ·{" "}
              {(lastRound.loserUserId as string) === (userId as string) ? "You" : `@${oppHandle}`} hit it
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5 max-w-xs mx-auto">
            {Array.from({ length: BOARD_SIZE }, (_, i) => (
              <RevealedBox
                key={i}
                index={i}
                isBomb={lastRound.bombs.includes(i)}
                wasOpened={lastRound.opened.includes(i)}
                wasBombHit={i === lastRound.bombHit}
              />
            ))}
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
