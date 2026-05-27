"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/ui/Placeholder";
import { ACCENT_CLASSES } from "@/lib/games";
import { useAuth } from "@/lib/auth-store";
import { useLeaveRoom } from "@/lib/room-store";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// Mirror constants from convex/games/timeout.ts so the client renders the same phase windows.
const TARGET_SCORE = 3; // First to 3 round wins
const AUTO_ADVANCE_MS = 5000; // Auto-advance to next round after 5 seconds
const REVEAL_MS = 2200;
const COUNTDOWN_MS = 2700;
const TIMING_STARTS_AT_MS = REVEAL_MS + COUNTDOWN_MS;

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

type Submission = { userId: Id<"users">; elapsedMs: number };
type RoundResult = {
  round: number;
  target: number;
  perPlayer: Array<{
    userId: Id<"users">;
    elapsedMs: number;
    gain: number;      // 1 for round winner, 0 for loser/tie
    newScore: number;  // rounds won (0–3)
    newStreak: number;
  }>;
  winnerUserId?: Id<"users">;
};
type MatchData = {
  target: number;
  submissions: Submission[];
  lastRound?: RoundResult;
  continueVotes?: Id<"users">[];
  ratingDeltas?: Record<string, number>;
};

type ClientPhase = "waiting" | "reveal" | "countdown" | "timing" | "round-result" | "match-over";

export function TimeoutGame({
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
  const accent = ACCENT_CLASSES.blue;

  const me = room.players.find((p) => p.userId === userId);
  const opp = room.players.find((p) => p.userId !== userId);

  // Map server phase + elapsed-since-phaseStart → client phase.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const serverPhase = matchState?.phase ?? "waiting";
  const phaseStartedAt = matchState?.phaseStartedAt ?? now;
  const elapsed = now - phaseStartedAt;
  const data = (matchState?.data as MatchData | undefined) ?? null;

  let clientPhase: ClientPhase = "waiting";
  if (serverPhase === "playing") {
    if (elapsed < REVEAL_MS) clientPhase = "reveal";
    else if (elapsed < TIMING_STARTS_AT_MS) clientPhase = "countdown";
    else clientPhase = "timing";
  } else if (serverPhase === "round-result") clientPhase = "round-result";
  else if (serverPhase === "match-over") clientPhase = "match-over";

  // Latch the moment timing started, so the client measures elapsed locally
  // and only submits the same number of ms it has actually waited.
  const timingStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (clientPhase === "timing" && timingStartRef.current === null) {
      // Offset by time already elapsed in the timing phase so a page reload
      // doesn't reset the local clock back to zero.
      const alreadyElapsed = Math.max(0, elapsed - TIMING_STARTS_AT_MS);
      timingStartRef.current = performance.now() - alreadyElapsed;
    }
    if (clientPhase !== "timing") {
      timingStartRef.current = null;
    }
  }, [clientPhase, elapsed]);

  // Fallback opponent score from last round data when opp has left the room.
  const oppFinalScore =
    opp?.score ??
    data?.lastRound?.perPlayer.find((p) => p.userId !== userId)?.newScore ??
    0;

  const youSubmitted = !!data?.submissions.some((s) => s.userId === userId);
  const oppSubmitted = !!data?.submissions.some((s) => opp && s.userId === opp.userId);
  const youVoted = !!data?.continueVotes?.includes(userId);
  const oppVoted = !!data?.continueVotes?.includes(opp?.userId ?? ("" as Id<"users">));
  const autoAdvanceSecondsLeft =
    clientPhase === "round-result"
      ? Math.max(0, Math.ceil((AUTO_ADVANCE_MS - elapsed) / 1000))
      : 0;

  const countdownN = (() => {
    if (clientPhase !== "countdown") return 0;
    const into = elapsed - REVEAL_MS;
    const slot = COUNTDOWN_MS / 3;
    const idx = Math.floor(into / slot);
    return Math.max(0, 3 - idx);
  })();

  async function onStop() {
    if (clientPhase !== "timing" || youSubmitted || !sessionToken) return;
    const start = timingStartRef.current;
    if (start === null) return;
    const elapsedMs = Math.round(performance.now() - start);
    try {
      await submitAction({
        sessionToken,
        roomId: room._id,
        action: { type: "stop", elapsedMs },
      });
    } catch (e) {
      // Likely server clock disagreement or duplicate submission — log silently for hobby use.
      console.warn("submit failed", e);
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

  const lastRound = data?.lastRound;
  const youWon =
    clientPhase === "match-over" &&
    me &&
    (me.score > oppFinalScore);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 relative overflow-hidden">
      <div className="relative w-full max-w-xl">
        <div className="grid grid-cols-2 gap-3 mb-3 text-center">
          <ScoreCard
            who="You"
            handle={`@${me?.handle ?? "you"}`}
            wins={me?.score ?? 0}
            streak={me?.streak ?? 0}
            color="text-blue"
          />
          <ScoreCard
            who="Opp"
            handle={`@${opp?.handle ?? "opponent"}`}
            wins={opp?.score ?? 0}
            streak={opp?.streak ?? 0}
            color="text-magenta"
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <ProgressBar value={me?.score ?? 0} max={TARGET_SCORE} tone="bg-blue" />
          <ProgressBar value={opp?.score ?? 0} max={TARGET_SCORE} tone="bg-magenta" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-widest text-bone-200/60">
          <span>Round {matchState?.round ?? 1}</span>
          <span className="opacity-50">·</span>
          <span>First to {TARGET_SCORE} rounds</span>
        </div>

        <div className="relative aspect-[5/4] rounded-chunk border-[3px] border-black bg-ink-900 shadow-pop-lg overflow-hidden">
          <div className="absolute inset-0 bg-dots opacity-40" />
          <div className={cn("absolute inset-0 opacity-10", accent.bg)} />

          {clientPhase === "waiting" && (
            <div className="absolute inset-0 flex items-center justify-center text-bone-200/60 text-sm font-bold uppercase tracking-widest">
              Syncing match…
            </div>
          )}

          {clientPhase === "reveal" && data && (
            <RevealStage
              round={matchState?.round ?? 1}
              target={data.target}
              accentText={accent.text}
              accentBg={accent.bg}
            />
          )}

          {clientPhase === "countdown" && (
            <CountdownStage n={countdownN} accentText={accent.text} />
          )}

          {clientPhase === "timing" && (
            <TimingStage
              youLocked={youSubmitted}
              oppLocked={oppSubmitted}
              onStop={onStop}
              accentBg={accent.bg}
            />
          )}

          {clientPhase === "round-result" && lastRound && me && opp && (
            <ResultStage
              log={lastRound}
              userId={userId}
              oppUserId={opp.userId}
              accentBg={accent.bg}
              accentText={accent.text}
              yourWins={me.score}
              oppWins={opp.score}
              youVoted={youVoted}
              oppVoted={oppVoted}
              autoAdvanceSecondsLeft={autoAdvanceSecondsLeft}
              onNext={onNextRound}
            />
          )}

          {clientPhase === "match-over" && me && (
            <MatchOverStage
              youWin={!!youWon}
              yourWins={me.score}
              oppWins={oppFinalScore}
              ratingDelta={data?.ratingDeltas?.[userId as string]}
              accentBg={accent.bg}
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

function ScoreCard({
  who, handle, wins, streak, color,
}: {
  who: string;
  handle: string;
  wins: number;
  streak: number;
  color: string;
}) {
  return (
    <div className="border-[3px] border-black rounded-chunk bg-ink-800 p-3 text-left">
      <div className="flex items-baseline justify-between gap-2">
        <div className="label-cap">{who}</div>
        <div className="text-[10px] font-bold text-bone-200/50 truncate">{handle}</div>
      </div>
      <div className={cn("font-display text-3xl mt-1 tabular-nums", color)}>
        {wins}<span className="text-sm font-bold ml-1 text-bone-200/50">/ {TARGET_SCORE}</span>
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-bone-200/60">
        Streak {streak}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 bg-ink-700 border-2 border-black rounded-full overflow-hidden">
      <div className={cn("h-full transition-all duration-500", tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function RevealStage({
  round, target, accentText, accentBg,
}: { round: number; target: number; accentText: string; accentBg: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
      <div className="label-cap mb-2">Round {round} · Target</div>
      <div className="relative">
        <div className={cn("absolute -inset-6 rounded-full opacity-30 animate-pulse-ring", accentBg)} />
        <div className="relative font-display text-7xl sm:text-8xl text-bone-50 tabular-nums">
          {target.toFixed(2)}<span className="text-3xl sm:text-4xl text-bone-200/60">s</span>
        </div>
      </div>
      <div className="mt-4 text-xs font-bold uppercase tracking-widest text-bone-200/70">
        Memorize it. <span className={accentText}>Both players see the same target.</span>
      </div>
    </div>
  );
}

function CountdownStage({ n, accentText }: { n: number; accentText: string }) {
  const display = n > 0 ? String(n) : "GO";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <div className={cn("font-display text-9xl tabular-nums", n > 0 ? "text-bone-50" : accentText)}>
        {display}
      </div>
      <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-bone-200/70">
        Timer is hidden the instant you see GO
      </div>
    </div>
  );
}

function TimingStage({
  youLocked, oppLocked, onStop, accentBg,
}: { youLocked: boolean; oppLocked: boolean; onStop: () => void; accentBg: string }) {
  return (
    <button
      onClick={onStop}
      disabled={youLocked}
      className={cn(
        "absolute inset-0 w-full h-full flex flex-col items-center justify-center select-none transition-all",
        youLocked ? "bg-ink-800 cursor-default" : cn(accentBg, "hover:brightness-110 active:brightness-90"),
      )}
    >
      <div
        className={cn(
          "absolute -inset-10 rounded-full border-[3px] border-dashed pointer-events-none animate-spin-slow",
          youLocked ? "border-bone-50/20" : "border-black/40",
        )}
      />
      {!youLocked && (
        <>
          <div className="font-display text-6xl sm:text-8xl text-black tracking-wide">STOP</div>
          <div className="mt-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-black/70">
            Tap when you think you've hit the target
          </div>
        </>
      )}
      {youLocked && !oppLocked && (
        <>
          <div className="font-display text-4xl sm:text-5xl text-bone-50">Locked in</div>
          <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-bone-200/60">
            Waiting on opponent…
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 px-4">
            <span className={cn("chip border-black text-black", accentBg)}>You · stopped</span>
            <span className="chip bg-ink-700 text-bone-200/70 border-bone-200/20">Opp · timing</span>
          </div>
        </>
      )}
      {youLocked && oppLocked && (
        <div className="font-display text-3xl text-bone-50 animate-pulse">Scoring…</div>
      )}
    </button>
  );
}

function ResultStage({
  log, userId, oppUserId, accentBg, accentText, yourWins, oppWins,
  youVoted, oppVoted, autoAdvanceSecondsLeft, onNext,
}: {
  log: RoundResult;
  userId: Id<"users">;
  oppUserId: Id<"users">;
  accentBg: string;
  accentText: string;
  yourWins: number;
  oppWins: number;
  youVoted: boolean;
  oppVoted: boolean;
  autoAdvanceSecondsLeft: number;
  onNext: () => void;
}) {
  const youRow = log.perPlayer.find((p) => p.userId === userId);
  const oppRow = log.perPlayer.find((p) => p.userId === oppUserId);
  const winner = log.winnerUserId;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-4">
      <div className="label-cap">Round {log.round} · target {log.target.toFixed(2)}s</div>

      <div className="mt-3 grid grid-cols-2 gap-3 w-full max-w-md">
        {youRow && (
          <RoundResultCard
            label="You"
            row={youRow}
            target={log.target}
            highlight={winner === userId}
            highlightBg={accentBg}
            mutedText={accentText}
          />
        )}
        {oppRow && (
          <RoundResultCard
            label="Opp"
            row={oppRow}
            target={log.target}
            highlight={winner === oppUserId}
            highlightBg="bg-magenta"
            mutedText="text-magenta"
          />
        )}
      </div>

      <div className="mt-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
        {winner === userId && <span className={accentText}>You took the round</span>}
        {winner === oppUserId && <span className="text-magenta">Opponent took it</span>}
        {!winner && <span className="text-bone-200/70">Dead heat — streaks held</span>}
      </div>

      <div className="mt-1 text-[10px] text-bone-200/60 font-bold">
        Rounds · {yourWins} – {oppWins}
      </div>

      <div className="mt-3 flex flex-col items-center gap-1">
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

function RoundResultCard({
  label, row, target, highlight, highlightBg, mutedText,
}: {
  label: string;
  row: RoundResult["perPlayer"][number];
  target: number;
  highlight: boolean;
  highlightBg: string;
  mutedText: string;
}) {
  const seconds = row.elapsedMs / 1000;
  const drift = seconds - target;
  const sign = drift >= 0 ? "+" : "−";
  return (
    <div
      className={cn(
        "rounded-chunk border-[3px] border-black p-3 text-left transition-all",
        highlight ? cn(highlightBg, "text-black -translate-y-[2px] shadow-pop") : "bg-ink-800 text-bone-50",
      )}
    >
      <div className={cn("text-[10px] font-bold uppercase tracking-widest", highlight ? "text-black/70" : "text-bone-200/60")}>
        {label}{highlight && " · win"}
      </div>
      <div className="font-display text-2xl tabular-nums mt-1">{seconds.toFixed(3)}s</div>
      <div className={cn("text-[11px] font-bold mt-1", highlight ? "text-black/80" : "text-bone-200/70")}>
        Drift {sign}{Math.abs(drift).toFixed(3)}s
      </div>
      {row.gain > 0 && (
        <div className={cn("mt-2 text-[11px] font-bold", highlight ? "text-black/80" : mutedText)}>
          <span className="font-display text-base">+1 round</span>
        </div>
      )}
    </div>
  );
}

function MatchOverStage({
  youWin, yourWins, oppWins, ratingDelta, accentBg, onReset, onLobby, onMenu,
}: {
  youWin: boolean;
  yourWins: number;
  oppWins: number;
  ratingDelta?: number;
  accentBg: string;
  onReset: () => void;
  onLobby: () => void;
  onMenu: () => void;
}) {
  const deltaSign = ratingDelta !== undefined && ratingDelta >= 0 ? "+" : "";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
      <div
        className={cn(
          "px-6 py-3 rounded-chunk border-[3px] border-black font-display text-xl sm:text-3xl shadow-pop-lg",
          youWin ? cn(accentBg, "text-black") : "bg-magenta text-black",
        )}
      >
        {youWin ? "You took the match" : "Opponent took the match"}
      </div>
      <div className="mt-6 font-display text-5xl text-bone-50 tabular-nums">
        {yourWins} <span className="text-bone-200/40">–</span> {oppWins}
      </div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-bone-200/60">
        Rounds won · first to {TARGET_SCORE}
      </div>
      {ratingDelta !== undefined && (
        <div className={cn(
          "mt-3 font-display text-2xl tabular-nums",
          ratingDelta >= 0 ? "text-lemon" : "text-coral",
        )}>
          {deltaSign}{ratingDelta.toFixed(3)}
          <span className="text-xs font-bold uppercase tracking-widest ml-1 text-bone-200/60">rating</span>
        </div>
      )}
      <div className="mt-4 flex gap-3">
        <Placeholder label="trophy" size="lg" />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
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
