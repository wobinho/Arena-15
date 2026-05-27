import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export const TARGET_SCORE = 3; // First to 3 round wins

const GRID_SIZE = 25; // 5×5
const BOMB_COUNT = 3; // 3 bombs hidden in the grid
const SAFE_COUNT = GRID_SIZE - BOMB_COUNT; // 22 safe boxes

// Phases:
//  "playing"      – both players are simultaneously opening boxes
//  "round-result" – a player hit a bomb (or all safe boxes opened); result shown
//  "match-over"   – someone reached TARGET_SCORE
export type MinefieldPhase = "playing" | "round-result" | "match-over";

export type PlayerState = {
  openedSafe: number[]; // indices of safely-opened boxes
  exploded: boolean;
  explodedAt?: number; // grid index of the bomb that was hit
};

/**
 * Shape of matchState.data for Minefield.
 *
 * IMPORTANT: bomb positions are intentionally ABSENT during the "playing" phase.
 * They live only in the server-side `minefieldSecrets` table and are revealed
 * in `bombIndices` only once the round is over (phase = "round-result" or
 * "match-over"), so clients can show the full board reveal.
 */
export type MinefieldData = {
  playerStates: Record<string, PlayerState>; // userId → state
  /** Populated at round end — safe to expose because bombs are already triggered. */
  bombIndices?: number[];
  /** The winner of the most recent round (undefined = draw). */
  roundWinnerId?: Id<"users">;
  continueVotes?: Id<"users">[];
  ratingDeltas?: Record<string, number>;
};

export type MinefieldAction = { type: "open"; index: number };

// ─── Bomb generation ──────────────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle using crypto.getRandomValues() → pick the first
 * BOMB_COUNT indices.
 *
 * We use the Web Crypto API (available in Convex's default V8 runtime) instead
 * of Math.random() so that bomb positions cannot be predicted by an attacker
 * who reverse-engineers the PRNG seed.
 */
function generateBombs(): number[] {
  const indices = Array.from({ length: GRID_SIZE }, (_, i) => i);
  // Generate one Uint32 per position so we only call getRandomValues once.
  const randomBuf = new Uint32Array(GRID_SIZE);
  crypto.getRandomValues(randomBuf);
  for (let i = GRID_SIZE - 1; i > 0; i--) {
    // randomBuf[i] % (i + 1) has negligible modulo bias for GRID_SIZE = 25.
    const j = randomBuf[i] % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, BOMB_COUNT).sort((a, b) => a - b);
}

// ─── Module contract ──────────────────────────────────────────────────────────

export function initialMatchData(
  playerIds: Id<"users">[],
): { phase: string; data: MinefieldData } {
  const playerStates: Record<string, PlayerState> = {};
  for (const id of playerIds) {
    playerStates[id as string] = { openedSafe: [], exploded: false };
  }
  return {
    phase: "playing" satisfies MinefieldPhase,
    data: { playerStates },
  };
}

export function nextRoundData(
  _state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
): { phase: string; data: MinefieldData } {
  const playerStates: Record<string, PlayerState> = {};
  for (const p of players) {
    playerStates[p.userId as string] = { openedSafe: [], exploded: false };
  }
  return {
    phase: "playing" satisfies MinefieldPhase,
    data: { playerStates },
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

  const myState = data.playerStates[userId as string];
  if (!myState) throw new Error("Player state not found");

  // Idempotent: ignore if player already exploded or already opened this box safely
  if (myState.exploded) return { nextPhase: phase, nextData: data };
  if (myState.openedSafe.includes(idx)) return { nextPhase: phase, nextData: data };

  // ── Get or lazily generate bomb positions ─────────────────────────────────
  // Convex mutations are serialised transactions, so even if two players
  // open their first box simultaneously, only one mutation will insert the
  // secret — the second will find the row already there.
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
  const newPlayerStates: Record<string, PlayerState> = { ...data.playerStates };

  if (isBomb) {
    newPlayerStates[userId as string] = {
      ...myState,
      exploded: true,
      explodedAt: idx,
    };
  } else {
    const newOpenedSafe = [...myState.openedSafe, idx];
    newPlayerStates[userId as string] = {
      ...myState,
      openedSafe: newOpenedSafe,
    };

    // Edge-case: player opened every safe box — they win the round
    if (newOpenedSafe.length >= SAFE_COUNT) {
      return resolveRound(ctx, state, players, newPlayerStates, bombIndices, userId);
    }
  }

  // ── Check if anyone has exploded ──────────────────────────────────────────
  const anyExploded = players.some(
    (p) => newPlayerStates[p.userId as string]?.exploded,
  );

  if (!anyExploded) {
    // Round still ongoing
    return {
      nextPhase: "playing",
      nextData: { ...data, playerStates: newPlayerStates },
    };
  }

  // Survivor wins; if both exploded simultaneously it's a draw (undefined)
  const survivor = players.find(
    (p) => !newPlayerStates[p.userId as string]?.exploded,
  );

  return resolveRound(
    ctx,
    state,
    players,
    newPlayerStates,
    bombIndices,
    survivor?.userId,
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function resolveRound(
  ctx: MutationCtx,
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
  newPlayerStates: Record<string, PlayerState>,
  bombIndices: number[],
  roundWinnerId: Id<"users"> | undefined,
): Promise<{
  nextPhase: string;
  nextData: MinefieldData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
}> {
  // Update per-player DB scores and streaks
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

  // When the match is over, find the overall winner (highest round-win count)
  const overallWinnerEntry = matchOver
    ? Object.entries(newScores).reduce<[string, number] | null>(
        (best, cur) => (!best || cur[1] > best[1] ? cur : best),
        null,
      )
    : null;
  const overallWinnerUserId = overallWinnerEntry
    ? (overallWinnerEntry[0] as Id<"users">)
    : undefined;

  return {
    nextPhase: matchOver ? "match-over" : "round-result",
    nextData: {
      playerStates: newPlayerStates,
      bombIndices, // Reveal bombs now that the round is over
      roundWinnerId,
    },
    roundResult: {
      winnerUserId: matchOver ? overallWinnerUserId : roundWinnerId,
      payload: {
        roundWinnerId: roundWinnerId ?? null,
        playerStates: newPlayerStates,
        bombIndices,
      },
    },
    matchOver,
  };
}
