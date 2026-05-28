import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PREGAME_TIMEOUT_MS = 3_000;
export const STEP_DURATION_MS = 700;
export const STEP_GAP_MS = 300;
export const STEP_TOTAL_MS = STEP_DURATION_MS + STEP_GAP_MS; // 1 000 ms per step
export const SHOWING_LEAD_MS = 600;
export const SHOWING_TRAIL_MS = 500;

const INITIAL_PATTERN_LENGTH = 3;
const GRID_SIZE = 12; // 3 wide × 4 tall

const TILE_COLORS = [
  "#FF4C4C",
  "#FF9F45",
  "#FFE545",
  "#4CFF7A",
  "#45C4FF",
  "#9B45FF",
  "#FF45D9",
  "#FF7045",
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type MimicPhase = "pregame" | "showing" | "input" | "match-over";

export type MimicStep = {
  tileIndex: number;
  color: string;
};

export type MimicData = {
  pattern: MimicStep[];
  patternLength: number;
  showingDurationMs: number;
  playerProgress: Record<string, number>;  // userId → next expected step index
  playerDone: Record<string, boolean>;     // userId → completed this round
  playerFailed: Record<string, boolean>;   // userId → failed (clicked wrong tile)
  winnerUserId?: Id<"users">;
  ratingDeltas?: Record<string, number>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function generatePattern(length: number): MimicStep[] {
  const steps: MimicStep[] = [];
  for (let i = 0; i < length; i++) {
    steps.push({
      tileIndex: randInt(GRID_SIZE),
      color: TILE_COLORS[randInt(TILE_COLORS.length)],
    });
  }
  return steps;
}

export function computeShowingDuration(patternLength: number): number {
  return SHOWING_LEAD_MS + patternLength * STEP_TOTAL_MS + SHOWING_TRAIL_MS;
}

function makePlayerMaps(playerIds: Id<"users">[]): Pick<
  MimicData,
  "playerProgress" | "playerDone" | "playerFailed"
> {
  const playerProgress: Record<string, number> = {};
  const playerDone: Record<string, boolean> = {};
  const playerFailed: Record<string, boolean> = {};
  for (const id of playerIds) {
    playerProgress[id as string] = 0;
    playerDone[id as string] = false;
    playerFailed[id as string] = false;
  }
  return { playerProgress, playerDone, playerFailed };
}

// ─── Game-module contract ─────────────────────────────────────────────────────

export function initialMatchData(
  playerIds: Id<"users">[],
): { phase: string; data: MimicData } {
  const patternLength = INITIAL_PATTERN_LENGTH;
  const pattern = generatePattern(patternLength);
  const maps = makePlayerMaps(playerIds);
  return {
    phase: "pregame" satisfies MimicPhase,
    data: {
      pattern,
      patternLength,
      showingDurationMs: computeShowingDuration(patternLength),
      ...maps,
    },
  };
}

export async function onPregameTimeout(
  _ctx: MutationCtx,
  state: Doc<"matchState">,
  _players: Doc<"roomPlayers">[],
): Promise<{ nextPhase: string; nextData: MimicData } | null> {
  const data = state.data as MimicData;
  return {
    nextPhase: "showing" satisfies MimicPhase,
    nextData: data,
  };
}

export function nextRoundData(
  _state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
): { phase: string; data: MimicData } {
  return initialMatchData(players.map((p) => p.userId));
}

// ─── Action ───────────────────────────────────────────────────────────────────

export type MimicAction = { type: "tileClick"; tileIndex: number };

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
}> {
  const action = rawAction as MimicAction;
  if (!action || action.type !== "tileClick") throw new Error("Invalid action");

  const data = state.data as MimicData;
  const phase = state.phase as MimicPhase;

  // Ignore clicks outside input phase
  if (phase !== "input") {
    return { nextPhase: phase, nextData: data };
  }

  // Ignore if already finished or failed
  if (data.playerDone[userId as string] || data.playerFailed[userId as string]) {
    return { nextPhase: phase, nextData: data };
  }

  const currentStep = data.playerProgress[userId as string] ?? 0;
  const expectedTile = data.pattern[currentStep]?.tileIndex;

  if (action.tileIndex !== expectedTile) {
    // Player clicked wrong tile — they lose
    const newFailed: Record<string, boolean> = { ...data.playerFailed, [userId as string]: true };
    const other = players.find((p) => p.userId !== userId);
    const winnerUserId = other?.userId;

    return {
      nextPhase: "match-over" satisfies MimicPhase,
      nextData: { ...data, playerFailed: newFailed, winnerUserId },
      roundResult: {
        winnerUserId,
        payload: { loserUserId: userId, patternLength: data.patternLength, winnerUserId },
      },
      matchOver: true,
    };
  }

  // Correct click
  const newStep = currentStep + 1;
  const newProgress: Record<string, number> = { ...data.playerProgress, [userId as string]: newStep };

  if (newStep >= data.patternLength) {
    // Player completed this round's pattern
    const newDone: Record<string, boolean> = { ...data.playerDone, [userId as string]: true };
    const allDone = players.every((p) => newDone[p.userId as string]);

    if (allDone) {
      // Both done — advance pattern length and loop back to showing
      const nextLen = data.patternLength + 1;
      const maps = makePlayerMaps(players.map((p) => p.userId));
      return {
        nextPhase: "showing" satisfies MimicPhase,
        nextData: {
          pattern: generatePattern(nextLen),
          patternLength: nextLen,
          showingDurationMs: computeShowingDuration(nextLen),
          ...maps,
        },
      };
    }

    return {
      nextPhase: phase,
      nextData: { ...data, playerProgress: newProgress, playerDone: newDone },
    };
  }

  return {
    nextPhase: phase,
    nextData: { ...data, playerProgress: newProgress },
  };
}

// ─── Showing-phase auto-timeout ───────────────────────────────────────────────

/** Transitions showing → input once the animation has finished. */
export async function onShowingTimeout(
  _ctx: MutationCtx,
  state: Doc<"matchState">,
  _players: Doc<"roomPlayers">[],
): Promise<{ nextPhase: string; nextData: MimicData } | null> {
  if (state.phase !== "showing") return null;
  const data = state.data as MimicData;
  return {
    nextPhase: "input" satisfies MimicPhase,
    nextData: data,
  };
}
