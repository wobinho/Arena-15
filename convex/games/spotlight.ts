import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// ─── Phase types ──────────────────────────────────────────────────────────────

export type SpotlightPhase = "playing" | "match-over";

// ─── Constants ────────────────────────────────────────────────────────────────

export const GAME_DURATION_MS = 30_000; // 30-second match
const MIN_ZONE_MS = 2_000;
const MAX_ZONE_MS = 5_000;

// ─── Data types ───────────────────────────────────────────────────────────────

export type ZoneSegment = {
  color: "green" | "red";
  durationMs: number;
};

export type SpotlightData = {
  zones: ZoneSegment[];
  scores: Record<string, number>; // userId → current tap score
  winnerUserId?: Id<"users">;
};

// ─── Zone helpers ─────────────────────────────────────────────────────────────

/**
 * Pre-generate a zone schedule that fills exactly GAME_DURATION_MS.
 * Zones alternate green → red → green … with random durations.
 * Always starts green.
 */
function generateZones(): ZoneSegment[] {
  const zones: ZoneSegment[] = [];
  let remaining = GAME_DURATION_MS;
  let color: "green" | "red" = "green";

  while (remaining > 0) {
    const duration =
      remaining <= MIN_ZONE_MS
        ? remaining
        : MIN_ZONE_MS +
          Math.floor(Math.random() * (MAX_ZONE_MS - MIN_ZONE_MS + 1));

    const actual = Math.min(duration, remaining);
    zones.push({ color, durationMs: actual });
    remaining -= actual;
    color = color === "green" ? "red" : "green";
  }

  return zones;
}

/**
 * Determine which zone color is active at `elapsedMs` after game start.
 * Returns "ended" when the full schedule has elapsed.
 */
export function getZoneAtMs(
  zones: ZoneSegment[],
  elapsedMs: number,
): "green" | "red" | "ended" {
  let cumulative = 0;
  for (const zone of zones) {
    cumulative += zone.durationMs;
    if (elapsedMs < cumulative) return zone.color;
  }
  return "ended";
}

// ─── Game-module contract ─────────────────────────────────────────────────────

export function initialMatchData(
  playerIds: Id<"users">[],
): { phase: string; data: SpotlightData } {
  const scores: Record<string, number> = {};
  for (const id of playerIds) {
    scores[id as string] = 0;
  }

  return {
    phase: "playing" satisfies SpotlightPhase,
    data: { zones: generateZones(), scores },
  };
}

export function nextRoundData(
  _state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
): { phase: string; data: SpotlightData } {
  // Spotlight is a single-round match; this is only called defensively.
  return initialMatchData(players.map((p) => p.userId));
}

// ─── Action ───────────────────────────────────────────────────────────────────

export type SpotlightAction = { type: "tap" };

/**
 * Each tap arrives as `{ type: "tap" }`.
 * The server checks its own wall clock to determine which zone is active,
 * making it impossible for clients to falsify zone state.
 */
export async function submit(
  _ctx: MutationCtx,
  state: Doc<"matchState">,
  _players: Doc<"roomPlayers">[],
  userId: Id<"users">,
  rawAction: unknown,
): Promise<{
  nextPhase: string;
  nextData: SpotlightData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
}> {
  const action = rawAction as SpotlightAction;
  if (!action || action.type !== "tap") throw new Error("Invalid action");

  const data = state.data as SpotlightData;
  const phase = state.phase as SpotlightPhase;

  // Silently ignore taps outside the active phase.
  if (phase !== "playing") {
    return { nextPhase: phase, nextData: data };
  }

  const now = Date.now();
  const elapsedMs = now - state.phaseStartedAt;

  // Ignore taps that arrive after the scheduled timeout.
  if (elapsedMs >= GAME_DURATION_MS) {
    return { nextPhase: phase, nextData: data };
  }

  const zoneColor = getZoneAtMs(data.zones, elapsedMs);
  if (zoneColor === "ended") {
    return { nextPhase: phase, nextData: data };
  }

  const delta = zoneColor === "green" ? 1 : -1;
  const current = data.scores[userId as string] ?? 0;
  const newScores: Record<string, number> = {
    ...data.scores,
    [userId as string]: current + delta,
  };

  return {
    nextPhase: phase,
    nextData: { ...data, scores: newScores },
  };
}

// ─── Timeout (game end) ───────────────────────────────────────────────────────

/**
 * Called automatically by `autoPlayingTimeout` after GAME_DURATION_MS.
 * Finalises scores, determines the winner, and ends the match.
 */
export async function onTimeout(
  ctx: MutationCtx,
  state: Doc<"matchState">,
  players: Doc<"roomPlayers">[],
): Promise<{
  nextPhase: string;
  nextData: SpotlightData;
  roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
  matchOver?: boolean;
} | null> {
  if (players.length < 2) return null;

  const data = state.data as SpotlightData;
  const p0 = players[0];
  const p1 = players[1];

  const s0 = data.scores[p0.userId as string] ?? 0;
  const s1 = data.scores[p1.userId as string] ?? 0;

  const winnerUserId =
    s0 > s1 ? p0.userId : s1 > s0 ? p1.userId : undefined;

  // Persist final tap-scores into roomPlayers.score for record-keeping.
  await ctx.db.patch(p0._id, { score: s0 });
  await ctx.db.patch(p1._id, { score: s1 });

  const finalData: SpotlightData = { ...data, winnerUserId };

  return {
    nextPhase: "match-over" satisfies SpotlightPhase,
    nextData: finalData,
    roundResult: {
      winnerUserId,
      payload: { scores: data.scores, winnerUserId },
    },
    matchOver: true,
  };
}

// Exported so match.ts can schedule the playing-phase timeout.
export const PLAYING_TIMEOUT_MS = GAME_DURATION_MS;
