import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export type HighLowPhase = "setup" | "playing" | "match-over";

export type GuessEntry = {
  userId: Id<"users">;
  guess: number;
  hint: "higher" | "lower" | "correct";
};

export type HighLowData = {
  secretNumbers: Record<string, number>;
  currentTurnUserId?: Id<"users">;
  guesses: GuessEntry[];
  winnerUserId?: Id<"users">;
};

export function initialMatchData(_playerIds: Id<"users">[]): { phase: string; data: HighLowData } {
  return {
    phase: "setup" satisfies HighLowPhase,
    data: { secretNumbers: {}, guesses: [] },
  };
}

export function nextRoundData(
  _state: Doc<"matchState">,
  _players: Doc<"roomPlayers">[],
): { phase: string; data: HighLowData } {
  return {
    phase: "setup" satisfies HighLowPhase,
    data: { secretNumbers: {}, guesses: [] },
  };
}

export type HighLowAction =
  | { type: "set-number"; number: number }
  | { type: "guess"; number: number };

export async function submit(
  ctx: MutationCtx,
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
  userId: Id<"users">,
  rawAction: unknown,
): Promise<{
  nextPhase: string;
  nextData: HighLowData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
}> {
  const action = rawAction as HighLowAction;
  const data = state.data as HighLowData;
  const phase = state.phase as HighLowPhase;

  if (action.type === "set-number") {
    if (phase !== "setup") throw new Error("Cannot set number outside setup phase");
    const num = Number(action.number);
    if (!Number.isInteger(num) || num < 1 || num > 100) {
      throw new Error("Number must be between 1 and 100");
    }
    // Ignore duplicate submissions
    if (data.secretNumbers[userId as string] !== undefined) {
      return { nextPhase: phase, nextData: data };
    }

    const newSecrets: Record<string, number> = {
      ...data.secretNumbers,
      [userId as string]: num,
    };
    const allSet = players.every((p) => newSecrets[p.userId as string] !== undefined);

    if (!allSet) {
      return {
        nextPhase: "setup",
        nextData: { ...data, secretNumbers: newSecrets },
      };
    }

    // Both submitted — coin flip to decide who goes first
    const firstUserId = players[Math.random() < 0.5 ? 0 : 1].userId;
    return {
      nextPhase: "playing",
      nextData: {
        ...data,
        secretNumbers: newSecrets,
        currentTurnUserId: firstUserId,
      },
    };
  }

  if (action.type === "guess") {
    if (phase !== "playing") throw new Error("Not in playing phase");
    if (data.currentTurnUserId !== userId) throw new Error("Not your turn");

    const guess = Number(action.number);
    if (!Number.isInteger(guess) || guess < 1 || guess > 100) {
      throw new Error("Guess must be between 1 and 100");
    }

    const opponent = players.find((p) => p.userId !== userId)!;
    const targetNumber = data.secretNumbers[opponent.userId as string]!;

    let hint: "higher" | "lower" | "correct";
    if (guess === targetNumber) {
      hint = "correct";
    } else if (targetNumber > guess) {
      hint = "higher";
    } else {
      hint = "lower";
    }

    const newGuesses: GuessEntry[] = [...data.guesses, { userId, guess, hint }];

    if (hint === "correct") {
      const winnerPlayer = players.find((p) => p.userId === userId)!;
      const loserPlayer = players.find((p) => p.userId !== userId)!;
      await ctx.db.patch(winnerPlayer._id, { score: 1, streak: winnerPlayer.streak + 1 });
      await ctx.db.patch(loserPlayer._id, { score: 0, streak: 0 });

      return {
        nextPhase: "match-over",
        nextData: { ...data, guesses: newGuesses, winnerUserId: userId },
        roundResult: {
          winnerUserId: userId,
          payload: { winnerUserId: userId, guesses: newGuesses, secretNumbers: data.secretNumbers },
        },
        matchOver: true,
      };
    }

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
