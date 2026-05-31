import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export const TARGET_SCORE = 3;
export const BOARD_SIZE = 25; // 5×5
export const BOMB_COUNT = 3;

// Phases:
//  "playing"      – players alternate opening boxes
//  "round-result" – someone hit a bomb; result is shown
//  "match-over"   – someone reached TARGET_SCORE wins
export type MinefieldPhase = "playing" | "round-result" | "match-over";

export type MinefieldRoundResult = {
  round: number;
  bombs: number[];          // revealed after round ends
  opened: number[];         // boxes safely opened during the round
  bombHit: number;          // the index that triggered the loss
  loserUserId: Id<"users">;
  winnerUserId?: Id<"users">;
};

export type MinefieldData = {
  opened: number[];           // safely opened box indices (shared board)
  currentTurn: Id<"users">; // whose turn it is
  lastRound?: MinefieldRoundResult;
  continueVotes?: Id<"users">[];
  ratingDeltas?: Record<string, number>;
};

export type MinefieldAction = { type: "open"; boxIndex: number };

function generateBombs(): number[] {
  const positions = Array.from({ length: BOARD_SIZE }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, BOMB_COUNT).sort((a, b) => a - b);
}

// ─── Module contract ─────────────────────────────────────────────────────────

export function initialMatchData(
  playerIds: Id<"users">[],
): { phase: string; data: MinefieldData } {
  const firstPlayer = playerIds[Math.floor(Math.random() * playerIds.length)];
  return {
    phase: "playing" satisfies MinefieldPhase,
    data: { opened: [], currentTurn: firstPlayer },
  };
}

/** Called after the matchState document is created so bombs can be written to the DB. */
export async function initRound(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  round: number,
  _playerIds: Id<"users">[],
): Promise<void> {
  // Clean up any stale record for this round (e.g. on rematch).
  const existing = await ctx.db
    .query("minefieldBombs")
    .withIndex("by_room_round", (q) => q.eq("roomId", roomId).eq("round", round))
    .unique();
  if (existing) await ctx.db.delete(existing._id);

  await ctx.db.insert("minefieldBombs", {
    roomId,
    round,
    bombs: generateBombs(),
  });
}

export function nextRoundData(
  state: Doc<"matchState">,
  _players: Doc<"roomPlayers">[],
): { phase: string; data: MinefieldData } {
  const data = state.data as MinefieldData;
  // Loser of last round goes first — gives them the next turn advantage.
  const nextFirst = data.lastRound?.loserUserId ?? data.currentTurn;
  return {
    phase: "playing" satisfies MinefieldPhase,
    data: { opened: [], currentTurn: nextFirst },
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

  if (action.type !== "open") {
    throw new Error(`Unknown action: ${(action as { type: string }).type}`);
  }
  if (phase !== "playing") {
    throw new Error("Not in the playing phase");
  }
  if ((data.currentTurn as string) !== (userId as string)) {
    throw new Error("Not your turn");
  }

  const idx = Number(action.boxIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= BOARD_SIZE) {
    throw new Error("Invalid box index");
  }
  if (data.opened.includes(idx)) {
    throw new Error("Box already opened");
  }

  const bombRecord = await ctx.db
    .query("minefieldBombs")
    .withIndex("by_room_round", (q) =>
      q.eq("roomId", state.roomId).eq("round", state.round),
    )
    .unique();
  if (!bombRecord) throw new Error("Bomb data not found");

  const bombs = bombRecord.bombs;
  const isBomb = bombs.includes(idx);
  const opponent = players.find((p) => (p.userId as string) !== (userId as string));
  if (!opponent) throw new Error("Opponent not found");

  if (!isBomb) {
    // Safe — add to opened board and switch turns.
    return {
      nextPhase: "playing",
      nextData: {
        ...data,
        opened: [...data.opened, idx],
        currentTurn: opponent.userId,
      },
    };
  }

  // Bomb hit — player who opened it loses the round.
  const winnerUserId = opponent.userId;
  const loserUserId = userId;

  const newScores: Record<string, number> = {};
  for (const p of players) {
    const isWinner = (p.userId as string) === (winnerUserId as string);
    const gain = isWinner ? 1 : 0;
    const newStreak = isWinner ? p.streak + 1 : 0;
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

  const roundResult: MinefieldRoundResult = {
    round: state.round,
    bombs,
    opened: data.opened,
    bombHit: idx,
    loserUserId,
    winnerUserId,
  };

  return {
    nextPhase: matchOver ? "match-over" : "round-result",
    nextData: { ...data, lastRound: roundResult },
    roundResult: {
      winnerUserId: matchOver ? overallWinnerUserId : winnerUserId,
      payload: roundResult,
    },
    matchOver,
  };
}
