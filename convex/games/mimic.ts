import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// ─── Phase types ──────────────────────────────────────────────────────────────

export type MimicPhase =
  | "pregame"
  | "showing-p1"
  | "input-p1"
  | "showing-p2"
  | "input-p2"
  | "match-over";

// ─── Timing constants (exported for client mirror) ────────────────────────────

export const PREGAME_TIMEOUT_MS = 5_000;
export const STEP_MS = 900;      // 600 ms on + 300 ms dark gap per tile
export const TILE_ON_MS = 600;
export const SHOW_BUFFER_MS = 500;
export const INPUT_BASE_MS = 6_000;
export const INPUT_PER_STEP_MS = 2_000;

// ─── Tile color palette ───────────────────────────────────────────────────────

const TILE_PALETTE = [
  "#E2C400", "#D31E69", "#19BCD0", "#8FD315",
  "#D9651D", "#1E5FE2", "#A855F7", "#EF4444",
  "#10B981", "#F97316", "#6366F1", "#EC4899",
];

// ─── Data type ────────────────────────────────────────────────────────────────

export type MimicData = {
  pattern: number[];           // tile indices 0–11, grows each level
  tileColors: string[];        // 12 hex colors, fixed for the match
  firstPlayerId: string;       // coin-flip result; fixed for whole match
  p1Result?: "success" | "fail"; // outcome of first player's turn this level
  currentInputs: number[];     // clicks so far for the currently active player
  failedBy?: string;           // userId of loser (for match-over display)
  winnerUserId?: Id<"users">;
  ratingDeltas?: Record<string, number>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function showingMs(patternLength: number): number {
  return patternLength * STEP_MS + SHOW_BUFFER_MS;
}

export function inputMs(patternLength: number): number {
  return INPUT_BASE_MS + INPUT_PER_STEP_MS * patternLength;
}

function generatePattern(length: number): number[] {
  const p: number[] = [];
  for (let i = 0; i < length; i++) p.push(Math.floor(Math.random() * 12));
  return p;
}

function shuffledColors(): string[] {
  const c = [...TILE_PALETTE];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

// ─── Game-module contract ─────────────────────────────────────────────────────

export function initialMatchData(
  playerIds: Id<"users">[],
): { phase: string; data: MimicData } {
  const firstPlayerId = playerIds[
    Math.floor(Math.random() * playerIds.length)
  ] as string;

  return {
    phase: "pregame" satisfies MimicPhase,
    data: {
      pattern: generatePattern(3),
      tileColors: shuffledColors(),
      firstPlayerId,
      currentInputs: [],
    },
  };
}

export async function onPregameTimeout(
  _ctx: MutationCtx,
  state: Doc<"matchState">,
  _players: Doc<"roomPlayers">[],
): Promise<{ nextPhase: string; nextData: MimicData; nextTimeoutMs?: number } | null> {
  const data = state.data as MimicData;
  return {
    nextPhase: "showing-p1" satisfies MimicPhase,
    nextData: { ...data, currentInputs: [] },
    nextTimeoutMs: showingMs(data.pattern.length),
  };
}

/**
 * Called by autoPhaseTimeout for all Mimic phases that time out:
 *   showing-p1 → input-p1
 *   input-p1   → showing-p2  (p1 failed by timeout)
 *   showing-p2 → input-p2
 *   input-p2   → match-over or restart
 */
export async function onPhaseTimeout(
  _ctx: MutationCtx,
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
  phase: string,
): Promise<{
  nextPhase: string;
  nextData: MimicData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
  nextTimeoutMs?: number;
  nextRound?: number;
} | null> {
  const data = state.data as MimicData;

  switch (phase as MimicPhase) {
    case "showing-p1":
      return {
        nextPhase: "input-p1" satisfies MimicPhase,
        nextData: { ...data, currentInputs: [] },
        nextTimeoutMs: inputMs(data.pattern.length),
      };

    case "input-p1":
      // P1 timed out → count as fail, let P2 still try
      return {
        nextPhase: "showing-p2" satisfies MimicPhase,
        nextData: { ...data, p1Result: "fail", currentInputs: [] },
        nextTimeoutMs: showingMs(data.pattern.length),
        nextRound: state.round + 1,
      };

    case "showing-p2":
      return {
        nextPhase: "input-p2" satisfies MimicPhase,
        nextData: { ...data, currentInputs: [] },
        nextTimeoutMs: inputMs(data.pattern.length),
      };

    case "input-p2": {
      const firstPlayer = players.find((p) => (p.userId as string) === data.firstPlayerId);
      const secondPlayer = players.find((p) => (p.userId as string) !== data.firstPlayerId);

      if (data.p1Result === "success") {
        // P1 succeeded, P2 timed out → P1 wins
        return {
          nextPhase: "match-over" satisfies MimicPhase,
          nextData: { ...data, winnerUserId: firstPlayer?.userId },
          roundResult: {
            winnerUserId: firstPlayer?.userId,
            payload: { reason: "p2-timeout", patternLength: data.pattern.length },
          },
          matchOver: true,
        };
      } else {
        // Both failed → restart same level
        return {
          nextPhase: "showing-p1" satisfies MimicPhase,
          nextData: {
            ...data,
            p1Result: undefined,
            currentInputs: [],
          },
          nextTimeoutMs: showingMs(data.pattern.length),
          nextRound: state.round + 1,
        };
      }
    }

    default:
      return null;
  }
}

// ─── Action ───────────────────────────────────────────────────────────────────

export type MimicAction = { type: "click"; tile: number };

export async function submit(
  _ctx: MutationCtx,
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
  userId: Id<"users">,
  rawAction: unknown,
): Promise<{
  nextPhase: string;
  nextData: MimicData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
  nextTimeoutMs?: number;
  nextRound?: number;
}> {
  const action = rawAction as MimicAction;
  const data = state.data as MimicData;
  const phase = state.phase as MimicPhase;

  if (!action || action.type !== "click" || typeof action.tile !== "number") {
    return { nextPhase: phase, nextData: data };
  }

  const uid = userId as string;
  const isFirstPlayer = uid === data.firstPlayerId;

  if (phase === "input-p1") {
    if (!isFirstPlayer) return { nextPhase: phase, nextData: data };
    return handleClick(state, data, players, uid, action.tile, "p1");
  }

  if (phase === "input-p2") {
    if (isFirstPlayer) return { nextPhase: phase, nextData: data };
    return handleClick(state, data, players, uid, action.tile, "p2");
  }

  return { nextPhase: phase, nextData: data };
}

function handleClick(
  state: Doc<"matchState">,
  data: MimicData,
  players: Doc<"roomPlayers">[],
  uid: string,
  tile: number,
  turn: "p1" | "p2",
): {
  nextPhase: string;
  nextData: MimicData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
  nextTimeoutMs?: number;
  nextRound?: number;
} {
  const firstPlayer = players.find((p) => (p.userId as string) === data.firstPlayerId);
  const secondPlayer = players.find((p) => (p.userId as string) !== data.firstPlayerId);
  const expected = data.pattern[data.currentInputs.length];

  if (tile !== expected) {
    // Wrong tile
    if (turn === "p1") {
      // P1 failed → go to P2's showing phase (P2 still gets to try)
      return {
        nextPhase: "showing-p2" satisfies MimicPhase,
        nextData: { ...data, p1Result: "fail", currentInputs: [] },
        nextTimeoutMs: showingMs(data.pattern.length),
        nextRound: state.round + 1,
      };
    } else {
      if (data.p1Result === "success") {
        // P1 succeeded, P2 failed → P1 wins
        return {
          nextPhase: "match-over" satisfies MimicPhase,
          nextData: { ...data, failedBy: uid, winnerUserId: firstPlayer?.userId },
          roundResult: {
            winnerUserId: firstPlayer?.userId,
            payload: { failedBy: uid, patternLength: data.pattern.length },
          },
          matchOver: true,
        };
      } else {
        // Both failed → restart same level
        return {
          nextPhase: "showing-p1" satisfies MimicPhase,
          nextData: { ...data, p1Result: undefined, currentInputs: [] },
          nextTimeoutMs: showingMs(data.pattern.length),
          nextRound: state.round + 1,
        };
      }
    }
  }

  // Correct tile
  const newInputs = [...data.currentInputs, tile];
  const patternComplete = newInputs.length === data.pattern.length;

  if (!patternComplete) {
    return {
      nextPhase: state.phase,
      nextData: { ...data, currentInputs: newInputs },
    };
  }

  // Player completed the pattern
  if (turn === "p1") {
    // P1 succeeded → P2 gets their turn
    return {
      nextPhase: "showing-p2" satisfies MimicPhase,
      nextData: { ...data, p1Result: "success", currentInputs: [] },
      nextTimeoutMs: showingMs(data.pattern.length),
      nextRound: state.round + 1,
    };
  } else {
    if (data.p1Result === "fail") {
      // P1 failed, P2 succeeded → P2 wins
      return {
        nextPhase: "match-over" satisfies MimicPhase,
        nextData: {
          ...data,
          failedBy: firstPlayer?.userId as string | undefined,
          winnerUserId: secondPlayer?.userId,
        },
        roundResult: {
          winnerUserId: secondPlayer?.userId,
          payload: {
            failedBy: firstPlayer?.userId as string | undefined,
            patternLength: data.pattern.length,
          },
        },
        matchOver: true,
      };
    } else {
      // Both succeeded → grow pattern, start next level
      const newPattern = [...data.pattern, Math.floor(Math.random() * 12)];
      return {
        nextPhase: "showing-p1" satisfies MimicPhase,
        nextData: {
          ...data,
          pattern: newPattern,
          p1Result: undefined,
          currentInputs: [],
        },
        nextTimeoutMs: showingMs(newPattern.length),
        nextRound: state.round + 1,
      };
    }
  }
}

export function nextRoundData(
  _state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
): { phase: string; data: MimicData } {
  return initialMatchData(players.map((p) => p.userId));
}
