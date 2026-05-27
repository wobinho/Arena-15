import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export const PICK_DURATION_MS = 15_000;
export const TARGET_SCORE = 3; // First to 3 round wins

// Phases:
//  "picking"      – both players are choosing a number (15-second window)
//  "round-result" – both have submitted (or timed out); result is shown
//  "match-over"   – someone reached TARGET_SCORE
export type NumberTrapPhase = "picking" | "round-result" | "match-over";

export type PickEntry = {
  userId: Id<"users">;
  pick: number;
  timedOut: boolean;
};

export type NumberTrapRoundResult = {
  round: number;
  picks: PickEntry[];
  sum: number;
  trapTriggered: boolean; // sum > 20 → lower number wins
  winnerUserId?: Id<"users">;
};

export type NumberTrapData = {
  picks: Record<string, number>; // userId -> chosen number (only present after submission)
  lastRound?: NumberTrapRoundResult;
  continueVotes?: Id<"users">[];
  ratingDeltas?: Record<string, number>;
};

export type NumberTrapAction = { type: "pick"; number: number };

// ─── Module contract ─────────────────────────────────────────────────────────

export function initialMatchData(
  _playerIds: Id<"users">[],
): { phase: string; data: NumberTrapData } {
  return {
    phase: "picking" satisfies NumberTrapPhase,
    data: { picks: {} },
  };
}

export function nextRoundData(
  _state: Doc<"matchState">,
  _players: Doc<"roomPlayers">[],
): { phase: string; data: NumberTrapData } {
  return {
    phase: "picking" satisfies NumberTrapPhase,
    data: { picks: {} },
  };
}

export async function submit(
  ctx: MutationCtx,
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
  userId: Id<"users">,
  rawAction: unknown,
): Promise<{
  nextPhase: string;
  nextData: NumberTrapData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
}> {
  const action = rawAction as NumberTrapAction;
  const data = state.data as NumberTrapData;
  const phase = state.phase as NumberTrapPhase;

  if (action.type !== "pick") {
    throw new Error(`Unknown action type: ${(action as { type: string }).type}`);
  }
  if (phase !== "picking") {
    throw new Error("Not in the picking phase");
  }

  const pick = Number(action.number);
  if (!Number.isInteger(pick) || pick < 1 || pick > 20) {
    throw new Error("Pick must be between 1 and 20");
  }

  // Ignore duplicate submissions from the same player
  if (data.picks[userId as string] !== undefined) {
    return { nextPhase: phase, nextData: data };
  }

  const newPicks: Record<string, number> = { ...data.picks, [userId as string]: pick };
  const allPicked = players.every((p) => newPicks[p.userId as string] !== undefined);

  if (!allPicked) {
    // Still waiting for the other player
    return {
      nextPhase: "picking",
      nextData: { ...data, picks: newPicks },
    };
  }

  // Both picked → resolve the round immediately
  return resolveRound(ctx, state, players, newPicks, []);
}

/** Called by the scheduler after PICK_DURATION_MS if both haven't picked yet. */
export async function onTimeout(
  ctx: MutationCtx,
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
): Promise<{
  nextPhase: string;
  nextData: NumberTrapData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
} | null> {
  const data = state.data as NumberTrapData;
  const phase = state.phase as NumberTrapPhase;

  if (phase !== "picking") return null; // Already resolved

  const timedOut = players
    .filter((p) => data.picks[p.userId as string] === undefined)
    .map((p) => p.userId);

  if (timedOut.length === 0) return null; // Both already picked — race condition, no-op

  return resolveRound(ctx, state, players, data.picks, timedOut);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function resolveRound(
  ctx: MutationCtx,
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
  picks: Record<string, number>,
  timedOutIds: Id<"users">[],
): Promise<{
  nextPhase: string;
  nextData: NumberTrapData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
}> {
  if (players.length !== 2) throw new Error("Number Trap requires exactly 2 players");

  const [p0, p1] = players;
  const to0 = timedOutIds.some((id) => id === p0.userId);
  const to1 = timedOutIds.some((id) => id === p1.userId);
  const pick0 = picks[p0.userId as string] ?? 0;
  const pick1 = picks[p1.userId as string] ?? 0;

  const sum = pick0 + pick1;
  // Trap fires when sum EXCEEDS 20 (sum of exactly 20 is safe → higher still wins)
  const trapTriggered = sum > 20;

  let winnerUserId: Id<"users"> | undefined;

  if (to0 && to1) {
    // Both timed out — draw
    winnerUserId = undefined;
  } else if (to0) {
    // p0 timed out — p1 wins by default
    winnerUserId = p1.userId;
  } else if (to1) {
    // p1 timed out — p0 wins by default
    winnerUserId = p0.userId;
  } else if (pick0 === pick1) {
    // Exact tie — draw
    winnerUserId = undefined;
  } else if (trapTriggered) {
    // Trap: lower number wins
    winnerUserId = pick0 < pick1 ? p0.userId : p1.userId;
  } else {
    // Normal: higher number wins
    winnerUserId = pick0 > pick1 ? p0.userId : p1.userId;
  }

  // Update DB scores / streaks and track new scores for match-over detection
  const newScores: Record<string, number> = {};
  for (const p of players) {
    const isWinner = winnerUserId === p.userId;
    const isLoser = winnerUserId !== undefined && !isWinner;
    const gain = isWinner ? 1 : 0;
    const newStreak = isWinner ? p.streak + 1 : isLoser ? 0 : p.streak;
    const newScore = p.score + gain;
    await ctx.db.patch(p._id, { score: newScore, streak: newStreak });
    newScores[p.userId as string] = newScore;
  }

  const matchOver = Object.values(newScores).some((s) => s >= TARGET_SCORE);

  // In a match-over, determine the overall winner (highest round-win score)
  const overallWinnerEntry = matchOver
    ? Object.entries(newScores).reduce<[string, number] | null>(
        (best, cur) => (!best || cur[1] > best[1] ? cur : best),
        null,
      )
    : null;
  const overallWinnerUserId = overallWinnerEntry
    ? (overallWinnerEntry[0] as Id<"users">)
    : undefined;

  const pickEntries: PickEntry[] = players.map((p) => ({
    userId: p.userId,
    pick: picks[p.userId as string] ?? 0,
    timedOut: timedOutIds.some((id) => id === p.userId),
  }));

  const roundResult: NumberTrapRoundResult = {
    round: state.round,
    picks: pickEntries,
    sum,
    trapTriggered,
    winnerUserId,
  };

  return {
    nextPhase: matchOver ? "match-over" : "round-result",
    nextData: { picks, lastRound: roundResult },
    roundResult: {
      winnerUserId: matchOver ? overallWinnerUserId : winnerUserId,
      payload: roundResult,
    },
    matchOver,
  };
}
