import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Phases:
//  "setup"     – both players enter their secret 4-digit code
//  "playing"   – alternating guesses; each turn one player guesses opponent's code
//  "match-over"– a player cracked the opponent's code
export type SafecrackerPhase = "setup" | "playing" | "match-over";

export type DigitFeedback = "correct" | "wrong";

export type GuessEntry = {
  userId: Id<"users">;
  guess: string; // 4-char string, e.g. "1234"
  feedback: DigitFeedback[]; // 4 elements – one per digit position
};

/**
 * Shape of matchState.data for Safecracker.
 *
 * IMPORTANT: secret codes are intentionally ABSENT here.
 * They live only in the server-side `safecrackerSecrets` table and are
 * never returned by any public query. The frontend uses `codesSet` (boolean
 * flags) to show lock status, and `revealedCodes` (populated only when
 * phase === "match-over") for the post-game reveal.
 */
export type SafecrackerData = {
  /** True for each userId that has already submitted their code. */
  codesSet: Record<string, boolean>;
  currentTurnUserId?: Id<"users">;
  guesses: GuessEntry[];
  winnerUserId?: Id<"users">;
  /** Only populated at match-over — safe to expose because the game is finished. */
  revealedCodes?: Record<string, string>;
  ratingDeltas?: Record<string, number>;
};

export type SafecrackerAction =
  | { type: "set-code"; code: string }
  | { type: "guess"; code: string };

// ─── Module contract ──────────────────────────────────────────────────────────

export function initialMatchData(
  _playerIds: Id<"users">[],
): { phase: string; data: SafecrackerData } {
  return {
    phase: "setup" satisfies SafecrackerPhase,
    data: { codesSet: {}, guesses: [] },
  };
}

export function nextRoundData(
  _state: Doc<"matchState">,
  _players: Doc<"roomPlayers">[],
): { phase: string; data: SafecrackerData } {
  // Safecracker is a single-match game — resets on rematch.
  return {
    phase: "setup" satisfies SafecrackerPhase,
    data: { codesSet: {}, guesses: [] },
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
  nextData: SafecrackerData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
}> {
  const action = rawAction as SafecrackerAction;
  const data = state.data as SafecrackerData;
  const phase = state.phase as SafecrackerPhase;

  // ── set-code ───────────────────────────────────────────────────────────────
  if (action.type === "set-code") {
    if (phase !== "setup") throw new Error("Cannot set code outside setup phase");

    const code = String(action.code).trim();
    if (!/^\d{4}$/.test(code)) throw new Error("Code must be exactly 4 digits (0–9)");

    // Ignore duplicate submissions from the same player
    if (data.codesSet[userId as string]) {
      return { nextPhase: phase, nextData: data };
    }

    // Persist the secret server-side — never written into matchState.data
    await ctx.db.insert("safecrackerSecrets", {
      roomId: state.roomId,
      userId,
      code,
    });

    const newCodesSet: Record<string, boolean> = {
      ...data.codesSet,
      [userId as string]: true,
    };

    const allSet = players.every((p) => newCodesSet[p.userId as string] === true);

    if (!allSet) {
      return {
        nextPhase: "setup",
        nextData: { ...data, codesSet: newCodesSet },
      };
    }

    // Both codes locked — coin flip to decide who guesses first
    const firstUserId = players[Math.random() < 0.5 ? 0 : 1].userId;
    return {
      nextPhase: "playing",
      nextData: {
        ...data,
        codesSet: newCodesSet,
        currentTurnUserId: firstUserId,
      },
    };
  }

  // ── guess ──────────────────────────────────────────────────────────────────
  if (action.type === "guess") {
    if (phase !== "playing") throw new Error("Not in the playing phase");
    if (data.currentTurnUserId !== userId) throw new Error("Not your turn");

    const guess = String(action.code).trim();
    if (!/^\d{4}$/.test(guess)) throw new Error("Guess must be exactly 4 digits (0–9)");

    const opponent = players.find((p) => p.userId !== userId);
    if (!opponent) throw new Error("Opponent not found");

    // Look up the opponent's code from the server-only secrets table
    const secretRow = await ctx.db
      .query("safecrackerSecrets")
      .withIndex("by_room_user", (q) =>
        q.eq("roomId", state.roomId).eq("userId", opponent.userId),
      )
      .unique();
    if (!secretRow) throw new Error("Opponent secret not found");

    const targetCode = secretRow.code;

    // Compute per-position feedback
    const feedback: DigitFeedback[] = Array.from({ length: 4 }, (_, i) =>
      guess[i] === targetCode[i] ? "correct" : "wrong",
    );

    const cracked = feedback.every((f) => f === "correct");

    const newGuesses: GuessEntry[] = [
      ...data.guesses,
      { userId, guess, feedback },
    ];

    if (cracked) {
      // Retrieve both codes for the post-game reveal (safe to expose now)
      const mySecretRow = await ctx.db
        .query("safecrackerSecrets")
        .withIndex("by_room_user", (q) =>
          q.eq("roomId", state.roomId).eq("userId", userId),
        )
        .unique();

      const revealedCodes: Record<string, string> = {
        [opponent.userId as string]: targetCode,
        ...(mySecretRow ? { [userId as string]: mySecretRow.code } : {}),
      };

      return {
        nextPhase: "match-over",
        nextData: {
          ...data,
          guesses: newGuesses,
          winnerUserId: userId,
          revealedCodes,
        },
        roundResult: {
          winnerUserId: userId,
          payload: {
            winnerUserId: userId,
            guesses: newGuesses,
            revealedCodes,
          },
        },
        matchOver: true,
      };
    }

    // Not cracked — pass turn to opponent
    return {
      nextPhase: "playing",
      nextData: {
        ...data,
        guesses: newGuesses,
        currentTurnUserId: opponent.userId,
      },
    };
  }

  throw new Error(`Unknown action type: ${(action as { type: string }).type}`);
}
