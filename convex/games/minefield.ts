import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export const TARGET_SCORE = 3; // First to 3 round wins

const GRID_SIZE = 25; // 5×5
const BOMB_COUNT = 3; // 3 bombs hidden in the grid
const SAFE_COUNT = GRID_SIZE - BOMB_COUNT; // 22 safe boxes

// Phases:
//  "playing"      – players take turns opening shared boxes
//  "round-result" – a player hit a bomb (or all safe boxes opened); result shown
//  "match-over"   – someone reached TARGET_SCORE
export type MinefieldPhase = "playing" | "round-result" | "match-over";

/**
 * Shape of matchState.data for Minefield (shared-board, turn-based).
 *
 * IMPORTANT: bomb positions are intentionally ABSENT during the "playing" phase.
 * They live only in the server-side `minefieldSecrets` table and are revealed
 * in `bombIndices` only once the round is over (phase = "round-result" or
 * "match-over"), so clients can show the full board reveal.
 */
export type MinefieldData = {
  /** All safely-opened box indices (shared between both players). */
  openedSafe: number[];
  /** Whether the current round has ended by a bomb hit. */
  exploded: boolean;
  /** Grid index of the bomb that was hit. */
  explodedAt?: number;
  /** UserId of the player who hit the bomb. */
  explodedBy?: Id<"users">;
  /** The player whose turn it is to open a box. */
  currentTurnUserId: Id<"users">;
  /** Turn rotation order (rotated each round so the loser goes first). */
  turnOrder: Id<"users">[];
  /** Populated at round end — safe to expose because bombs are already triggered. */
  bombIndices?: number[];
  /** The winner of the most recent round (undefined = draw). */
  roundWinnerId?: Id<"users">;
  continueVotes?: Id<"users">[];
  ratingDeltas?: Record<string, number>;
};

export type MinefieldAction = { type: "open"; index: number };

// ─── Bomb generation ──────────────────────────────────────────────────────────

function generateBombs(): number[] {
  const indices = Array.from({ length: GRID_SIZE }, (_, i) => i);
  const randomBuf = new Uint32Array(GRID_SIZE);
  crypto.getRandomValues(randomBuf);
  for (let i = GRID_SIZE - 1; i > 0; i--) {
    const j = randomBuf[i] % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, BOMB_COUNT).sort((a, b) => a - b);
}

// ─── Module contract ──────────────────────────────────────────────────────────

export function initialMatchData(
  playerIds: Id<"users">[],
): { phase: string; data: MinefieldData } {
  // Randomly pick who goes first using crypto for fairness.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const startIdx = buf[0] % playerIds.length;
  const turnOrder = [
    ...playerIds.slice(startIdx),
    ...playerIds.slice(0, startIdx),
  ] as Id<"users">[];

  return {
    phase: "playing" satisfies MinefieldPhase,
    data: {
      openedSafe: [],
      exploded: false,
      currentTurnUserId: turnOrder[0],
      turnOrder,
    },
  };
}

export function nextRoundData(
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
): { phase: string; data: MinefieldData } {
  // Rotate turn order so the previous first player goes last (loser leads next round).
  const prevData = state.data as MinefieldData;
  const prevOrder: Id<"users">[] =
    prevData.turnOrder ?? players.map((p) => p.userId);
  const rotated: Id<"users">[] = [...prevOrder.slice(1), prevOrder[0]];

  return {
    phase: "playing" satisfies MinefieldPhase,
    data: {
      openedSafe: [],
      exploded: false,
      currentTurnUserId: rotated[0],
      turnOrder: rotated,
    },
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
  nextData: MinefieldData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
}> {
  const action = rawAction as MinefieldAction;
  const data = state.data as MinefieldData;
  const phase = state.phase as MinefieldPhase;

  if (phase !== "playing") throw new Error("Not in the playing phase");
  if (action.type !== "open") {
    throw new Error(`Unknown action type: ${(action as { type: string }).type}`);
  }

  const idx = Number(action.index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= GRID_SIZE) {
    throw new Error("Invalid box index");
  }

  // Only the player whose turn it is can open a box.
  if (data.currentTurnUserId !== userId) {
    return { nextPhase: phase, nextData: data };
  }

  // Idempotent guards
  if (data.exploded) return { nextPhase: phase, nextData: data };
  if (data.openedSafe.includes(idx)) return { nextPhase: phase, nextData: data };

  // ── Get or lazily generate bomb positions ─────────────────────────────────
  const existingSecret = await ctx.db
    .query("minefieldSecrets")
    .withIndex("by_room_round", (q) =>
      q.eq("roomId", state.roomId).eq("round", state.round),
    )
    .unique();

  let bombIndices: number[];
  if (!existingSecret) {
    bombIndices = generateBombs();
    await ctx.db.insert("minefieldSecrets", {
      roomId: state.roomId,
      round: state.round,
      bombIndices,
    });
  } else {
    bombIndices = existingSecret.bombIndices;
  }

  // ── Apply the open ────────────────────────────────────────────────────────
  const isBomb = bombIndices.includes(idx);

  if (isBomb) {
    // The player who hit the bomb loses; the other player wins.
    const newData: MinefieldData = {
      ...data,
      exploded: true,
      explodedAt: idx,
      explodedBy: userId,
    };
    const survivor = players.find((p) => p.userId !== userId);
    return resolveRound(ctx, state, players, newData, bombIndices, survivor?.userId);
  }

  // Safe — add to shared list and switch turns.
  const newOpenedSafe = [...data.openedSafe, idx];

  const currentIdx = data.turnOrder.findIndex((id) => id === data.currentTurnUserId);
  const nextIdx = (currentIdx + 1) % data.turnOrder.length;
  const nextTurnUserId = data.turnOrder[nextIdx];

  const newData: MinefieldData = {
    ...data,
    openedSafe: newOpenedSafe,
    currentTurnUserId: nextTurnUserId,
  };

  // Edge-case: every safe box opened — current player wins by opening the last one.
  if (newOpenedSafe.length >= SAFE_COUNT) {
    return resolveRound(ctx, state, players, newData, bombIndices, userId);
  }

  return {
    nextPhase: "playing",
    nextData: newData,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function resolveRound(
  ctx: MutationCtx,
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
  newData: MinefieldData,
  bombIndices: number[],
  roundWinnerId: Id<"users"> | undefined,
): Promise<{
  nextPhase: string;
  nextData: MinefieldData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
}> {
  const newScores: Record<string, number> = {};
  for (const p of players) {
    const isWinner = roundWinnerId === p.userId;
    const isLoser = roundWinnerId !== undefined && !isWinner;
    const gain = isWinner ? 1 : 0;
    const newStreak = isWinner ? p.streak + 1 : isLoser ? 0 : p.streak;
    const newScore = p.score + gain;
    await ctx.db.patch(p._id, { score: newScore, streak: newStreak });
    newScores[p.userId as string] = newScore;
  }

  const matchOver = Object.values(newScores).some((s) => s >= TARGET_SCORE);

  const overallWinnerEntry = matchOver
    ? Object.entries(newScores).reduce<[string, number] | null>(
        (best, cur) => (!best || cur[1] > best[1] ? cur : best),
        null,
      )
    : null;
  const overallWinnerUserId = overallWinnerEntry
    ? (overallWinnerEntry[0] as Id<"users">)
    : undefined;

  const finalData: MinefieldData = {
    ...newData,
    bombIndices,
    roundWinnerId,
  };

  return {
    nextPhase: matchOver ? "match-over" : "round-result",
    nextData: finalData,
    roundResult: {
      winnerUserId: matchOver ? overallWinnerUserId : roundWinnerId,
      payload: {
        roundWinnerId: roundWinnerId ?? null,
        openedSafe: newData.openedSafe,
        exploded: newData.exploded,
        explodedAt: newData.explodedAt,
        explodedBy: newData.explodedBy,
        bombIndices,
      },
    },
    matchOver,
  };
}
