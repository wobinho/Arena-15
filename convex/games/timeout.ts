import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Phases visible to the client.
// "playing": round is in progress (client renders reveal → countdown → timing)
// "round-result": both players submitted, scores visible
// "match-over": someone hit the target score
export type TimeoutPhase = "playing" | "round-result" | "match-over";

export const TARGET_SCORE = 3; // First to 3 round wins
export const MAX_TIME_S = 60;
export const REVEAL_MS = 2200;
export const COUNTDOWN_MS = 2700; // 3 ticks @ ~900ms
export const TIMING_STARTS_AT_MS = REVEAL_MS + COUNTDOWN_MS;
const SUBMIT_TOLERANCE_MS = 500;

export type Submission = { userId: Id<"users">; elapsedMs: number; serverReceivedAt: number };

export type TimeoutData = {
  target: number; // seconds, to 2 decimals
  submissions: Submission[];
  lastRound?: TimeoutRoundResult;
  continueVotes?: Id<"users">[];
};

export type TimeoutRoundResult = {
  round: number;
  target: number;
  perPlayer: Array<{
    userId: Id<"users">;
    elapsedMs: number;
    gain: number;   // 1 for round winner, 0 for loser/tie
    newScore: number; // rounds won (0–3)
    newStreak: number;
  }>;
  winnerUserId?: Id<"users">;
};

function pickTarget(): number {
  // 5.00 to 25.00, rounded to 0.5
  return Math.round((5 + Math.random() * 20) * 2) / 2;
}


export function initialMatchData(_playerIds: Id<"users">[]): { phase: string; data: TimeoutData } {
  return {
    phase: "playing" satisfies TimeoutPhase,
    data: { target: pickTarget(), submissions: [] },
  };
}

export function nextRoundData(
  _state: Doc<"matchState">,
  _players: Doc<"roomPlayers">[],
): { phase: string; data: TimeoutData } {
  return {
    phase: "playing" satisfies TimeoutPhase,
    data: { target: pickTarget(), submissions: [] },
  };
}

export type TimeoutAction = { type: "stop"; elapsedMs: number };

export async function submit(
  ctx: MutationCtx,
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
  userId: Id<"users">,
  rawAction: unknown,
): Promise<{
  nextPhase: string;
  nextData: TimeoutData;
  roundResult?: { winnerUserId?: Id<"users">; payload: TimeoutRoundResult };
  matchOver?: boolean;
}> {
  const action = rawAction as TimeoutAction;
  if (!action || action.type !== "stop") throw new Error("Invalid action");

  const data = state.data as TimeoutData;
  const phase = state.phase as TimeoutPhase;

  if (phase !== "playing") throw new Error("Round is not accepting submissions");

  // Validate elapsed time against server wall clock.
  const now = Date.now();
  const wallElapsedMs = now - state.phaseStartedAt - TIMING_STARTS_AT_MS;
  const claimedMs = Number(action.elapsedMs);
  if (!Number.isFinite(claimedMs) || claimedMs <= 0) {
    throw new Error("Invalid elapsed time");
  }
  if (claimedMs > MAX_TIME_S * 1000) {
    throw new Error("Elapsed time exceeds maximum");
  }
  if (claimedMs > wallElapsedMs + SUBMIT_TOLERANCE_MS) {
    // Client claims more time elapsed than server's wall clock allows.
    throw new Error("Submission arrived too late for claimed time");
  }
  if (claimedMs < 0) throw new Error("Invalid elapsed time");

  // Reject duplicate submissions from the same player in this round.
  if (data.submissions.some((s) => s.userId === userId)) {
    return { nextPhase: phase, nextData: data };
  }

  const submissions = [
    ...data.submissions,
    { userId, elapsedMs: claimedMs, serverReceivedAt: now },
  ];

  if (submissions.length < 2) {
    return {
      nextPhase: phase,
      nextData: { ...data, submissions },
    };
  }

  // Both submitted — score the round.
  const target = data.target;
  const perPlayer = players.map((p) => {
    const sub = submissions.find((s) => s.userId === p.userId)!;
    return { player: p, userId: p.userId, elapsedMs: sub.elapsedMs };
  });

  // Determine winner by smallest absolute error.
  const errors = perPlayer.map((x) => ({
    userId: x.userId,
    err: Math.abs(target - x.elapsedMs / 1000),
  }));
  errors.sort((a, b) => a.err - b.err);
  const winnerUserId = errors[0].err === errors[1].err ? undefined : errors[0].userId;

  // Update player round-win counts + streaks.
  const updated = [];
  for (const x of perPlayer) {
    const isWinner = winnerUserId === x.userId;
    const isLoser = winnerUserId !== undefined && !isWinner;
    const gain = isWinner ? 1 : 0;
    const newStreak = isWinner ? x.player.streak + 1 : isLoser ? 0 : x.player.streak;
    const newScore = x.player.score + gain;
    await ctx.db.patch(x.player._id, { score: newScore, streak: newStreak });
    updated.push({
      userId: x.userId,
      elapsedMs: x.elapsedMs,
      gain,
      newScore,
      newStreak,
    });
  }

  const matchOver = updated.some((u) => u.newScore >= TARGET_SCORE);
  const finalWinnerId = matchOver
    ? updated.reduce((best, cur) => (cur.newScore > best.newScore ? cur : best)).userId
    : undefined;

  const roundResult: TimeoutRoundResult = {
    round: state.round,
    target,
    perPlayer: updated,
    winnerUserId,
  };

  return {
    nextPhase: matchOver ? "match-over" : "round-result",
    nextData: {
      target,
      submissions,
      lastRound: roundResult,
    },
    roundResult: { winnerUserId: finalWinnerId, payload: roundResult },
    matchOver,
  };
}
