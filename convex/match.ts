import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { userFromSession, DEFAULT_RATING } from "./users";
import * as Timeout from "./games/timeout";
import * as HighLow from "./games/highlow";
import * as NumberTrap from "./games/numbertrap";
import * as Safecracker from "./games/safecracker";
import * as Spotlight from "./games/spotlight";
import * as Minefield from "./games/minefield";
import * as Mimic from "./games/mimic";

// Each game module conforms to this contract.
type GameModule = {
  initialMatchData: (playerIds: Id<"users">[]) => { phase: string; data: unknown };
  nextRoundData: (
    state: Doc<"matchState">,
    players: Doc<"roomPlayers">[],
  ) => { phase: string; data: unknown };
  submit: (
    ctx: MutationCtx,
    state: Doc<"matchState">,
    players: Doc<"roomPlayers">[],
    userId: Id<"users">,
    action: unknown,
  ) => Promise<{
    nextPhase: string;
    nextData: unknown;
    roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
    matchOver?: boolean;
    /** If set, schedule autoPhaseTimeout for nextPhase after this many ms. */
    nextTimeoutMs?: number;
    /** If set, update matchState.round to this value. */
    nextRound?: number;
  }>;
  /** Optional: called by the scheduler after a phase time-limit expires. */
  onTimeout?: (
    ctx: MutationCtx,
    state: Doc<"matchState">,
    players: Doc<"roomPlayers">[],
  ) => Promise<{
    nextPhase: string;
    nextData: unknown;
    roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
    matchOver?: boolean;
  } | null>;
  /** Optional: called after the pregame countdown ends; transitions to playing. */
  onPregameTimeout?: (
    ctx: MutationCtx,
    state: Doc<"matchState">,
    players: Doc<"roomPlayers">[],
  ) => Promise<{
    nextPhase: string;
    nextData: unknown;
    /** If set, schedule autoPhaseTimeout for nextPhase after this many ms. */
    nextTimeoutMs?: number;
  } | null>;
  /**
   * Optional: generic phase-timeout handler used by autoPhaseTimeout.
   * Called when a phase scheduled via nextTimeoutMs expires.
   */
  onPhaseTimeout?: (
    ctx: MutationCtx,
    state: Doc<"matchState">,
    players: Doc<"roomPlayers">[],
    phase: string,
  ) => Promise<{
    nextPhase: string;
    nextData: unknown;
    roundResult?: { winnerUserId?: Id<"users">; payload: unknown };
    matchOver?: boolean;
    nextTimeoutMs?: number;
    nextRound?: number;
  } | null>;
  /** If set, the "pregame" phase transitions to playing after this many ms. */
  pregameTimeoutMs?: number;
  /** If set, the "picking" phase auto-resolves after this many ms. */
  pickingTimeoutMs?: number;
  /** If set, the "playing" phase auto-resolves after this many ms. */
  playingTimeoutMs?: number;
  /** Optional: called after round state is created to write per-round DB records (e.g. bomb positions). */
  initRound?: (
    ctx: MutationCtx,
    roomId: Id<"rooms">,
    round: number,
    playerIds: Id<"users">[],
  ) => Promise<void>;
};

const GAMES: Record<string, GameModule> = {
  timeout: Timeout,
  "high-low": HighLow,
  "number-trap": { ...NumberTrap, pickingTimeoutMs: NumberTrap.PICK_DURATION_MS },
  safecracker: Safecracker,
  spotlight: {
    ...Spotlight,
    pregameTimeoutMs: Spotlight.PREGAME_TIMEOUT_MS,
    playingTimeoutMs: Spotlight.PLAYING_TIMEOUT_MS,
  },
  minefield: Minefield,
  mimic: {
    ...Mimic,
    pregameTimeoutMs: Mimic.PREGAME_TIMEOUT_MS,
  },
};

export function getGameModule(gameId: string): GameModule {
  const g = GAMES[gameId];
  if (!g) throw new Error(`Unknown game: ${gameId}`);
  return g;
}

/** Upsert a row in userGameRatings, returning the updated doc. */
async function getOrCreateGameRating(
  ctx: MutationCtx,
  userId: Id<"users">,
  gameId: string,
) {
  const existing = await ctx.db
    .query("userGameRatings")
    .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("gameId", gameId))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("userGameRatings", {
    userId,
    gameId,
    rating: DEFAULT_RATING,
    matchesPlayed: 0,
    wins: 0,
  });
  return (await ctx.db.get(id))!;
}

async function finalizeMatchStats(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  players: Doc<"roomPlayers">[],
): Promise<Record<string, number>> {
  const deltas: Record<string, number> = {};
  if (players.length !== 2) return deltas;

  const room = await ctx.db.get(roomId);
  if (!room) return deltas;
  const { gameId } = room;

  const roundResults = await ctx.db
    .query("roundResults")
    .withIndex("by_room_round", (q) => q.eq("roomId", roomId))
    .take(10);

  const roundWins: Record<string, number> = {};
  for (const rr of roundResults) {
    if (rr.winnerUserId) {
      roundWins[rr.winnerUserId] = (roundWins[rr.winnerUserId] ?? 0) + 1;
    }
  }

  const [p0, p1] = players;
  const user0 = await ctx.db.get(p0.userId);
  const user1 = await ctx.db.get(p1.userId);
  if (!user0 || !user1) return deltas;

  const w0 = roundWins[p0.userId] ?? 0;
  const w1 = roundWins[p1.userId] ?? 0;
  const p0Won = w0 > w1;
  const p1Won = w1 > w0;

  // Track global matchesPlayed and wins for registered accounts.
  if (!user0.isGuest) {
    await ctx.db.patch(user0._id, {
      matchesPlayed: user0.matchesPlayed + 1,
      wins: p0Won ? (user0.wins ?? 0) + 1 : (user0.wins ?? 0),
    });
  }
  if (!user1.isGuest) {
    await ctx.db.patch(user1._id, {
      matchesPlayed: user1.matchesPlayed + 1,
      wins: p1Won ? (user1.wins ?? 0) + 1 : (user1.wins ?? 0),
    });
  }

  // Update per-game ratings when both are registered.
  if (!user0.isGuest && !user1.isGuest) {
    const gr0 = await getOrCreateGameRating(ctx, user0._id, gameId);
    const gr1 = await getOrCreateGameRating(ctx, user1._id, gameId);

    // Update per-game matchesPlayed and wins.
    await ctx.db.patch(gr0._id, {
      matchesPlayed: gr0.matchesPlayed + 1,
      wins: p0Won ? gr0.wins + 1 : gr0.wins,
    });
    await ctx.db.patch(gr1._id, {
      matchesPlayed: gr1.matchesPlayed + 1,
      wins: p1Won ? gr1.wins + 1 : gr1.wins,
    });

    // Apply rating delta when there is a clear winner.
    if (p0Won || p1Won) {
      const [winnerGR, loserGR] = p0Won
        ? [gr0, gr1]
        : [gr1, gr0];

      const winnerRating = winnerGR.rating;
      const loserRating = loserGR.rating;

      // Per-game rating formulas:
      //   Timeout:      delta = 0.15 * (loserRating / winnerRating)
      //   High-Low:     delta = 0.20 * (loserRating / winnerRating)
      //   Number Trap:  delta = 0.25 * (loserRating / winnerRating)
      //   Spotlight:    delta = 0.15 * (loserRating / winnerRating)
      const factor =
        gameId === "safecracker" ? 0.5 :
        gameId === "mimic" ? 0.4 :
        gameId === "number-trap" ? 0.25 :
        gameId === "high-low" ? 0.2 :
        gameId === "minefield" ? 0.3 :
        gameId === "spotlight" ? 0.15 : 0.15;
      const delta = Math.round(factor * (loserRating / Math.max(0.01, winnerRating)) * 1000) / 1000;

      await ctx.db.patch(winnerGR._id, { rating: winnerRating + delta });
      await ctx.db.patch(loserGR._id, { rating: Math.max(0.01, loserRating - delta) });

      deltas[winnerGR.userId as string] = delta;
      deltas[loserGR.userId as string] = -delta;
    }
  }

  return deltas;
}

/** Schedule a pregame countdown for games that have one (e.g. Spotlight). */
async function maybeSchedulePregameTimeout(
  ctx: MutationCtx,
  gameId: string,
  roomId: Id<"rooms">,
  round: number,
  phase: string,
) {
  const mod = GAMES[gameId];
  if (!mod?.pregameTimeoutMs || phase !== "pregame") return;
  await ctx.scheduler.runAfter(
    mod.pregameTimeoutMs + 500,
    internal.match.autoPregameTimeout,
    { roomId, round },
  );
}

/** Schedule a picking-phase timeout for games that have one (e.g. Number Trap). */
async function maybeSchedulePickingTimeout(
  ctx: MutationCtx,
  gameId: string,
  roomId: Id<"rooms">,
  round: number,
  phase: string,
) {
  const mod = GAMES[gameId];
  if (!mod?.pickingTimeoutMs || phase !== "picking") return;
  // Add a small buffer (1 s) so the server resolves after the client timer expires.
  await ctx.scheduler.runAfter(
    mod.pickingTimeoutMs + 1000,
    internal.match.autoPickingTimeout,
    { roomId, round },
  );
}

/** Schedule a playing-phase timeout for games that have a fixed duration (e.g. Spotlight). */
async function maybeSchedulePlayingTimeout(
  ctx: MutationCtx,
  gameId: string,
  roomId: Id<"rooms">,
  round: number,
  phase: string,
) {
  const mod = GAMES[gameId];
  if (!mod?.playingTimeoutMs || phase !== "playing") return;
  // Add a small buffer (1 s) so the server resolves after the client timer expires.
  await ctx.scheduler.runAfter(
    mod.playingTimeoutMs + 1000,
    internal.match.autoPlayingTimeout,
    { roomId, round },
  );
}

// Internal helper called from rooms.toggleReady when both players ready up.
export async function startMatch(ctx: MutationCtx, roomId: Id<"rooms">) {
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("Room not found");
  if (room.status !== "lobby") return;

  const players = await ctx.db
    .query("roomPlayers")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  if (players.length !== 2) throw new Error("Need exactly 2 players to start");

  const mod = getGameModule(room.gameId);
  const initial = mod.initialMatchData(players.map((p) => p.userId));

  await ctx.db.patch(roomId, { status: "in-game" });

  const existing = await ctx.db
    .query("matchState")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .unique();
  if (existing) await ctx.db.delete(existing._id);

  await ctx.db.insert("matchState", {
    roomId,
    gameId: room.gameId,
    round: 1,
    phase: initial.phase,
    phaseStartedAt: Date.now(),
    data: initial.data,
  });

  // Reset per-player scores for the new match.
  for (const p of players) {
    await ctx.db.patch(p._id, { score: 0, streak: 0, ready: false });
  }

  if (mod.initRound) {
    await mod.initRound(ctx, roomId, 1, players.map((p) => p.userId));
  }
  await maybeSchedulePregameTimeout(ctx, room.gameId, roomId, 1, initial.phase);
  await maybeSchedulePickingTimeout(ctx, room.gameId, roomId, 1, initial.phase);
  await maybeSchedulePlayingTimeout(ctx, room.gameId, roomId, 1, initial.phase);
}

export const getMatchState = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();
    if (!state) return null;
    return state;
  },
});

export const submitAction = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    action: v.any(),
  },
  handler: async (ctx, { sessionToken, roomId, action }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) throw new Error("Not signed in");

    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();
    if (!state) throw new Error("Match not active");

    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    if (!players.some((p) => p.userId === user._id)) {
      throw new Error("Not in this match");
    }

    const mod = getGameModule(state.gameId);
    const result = await mod.submit(ctx, state, players, user._id, action);

    const patch: { data: unknown; phase?: string; phaseStartedAt?: number; round?: number } = {
      data: result.nextData,
    };
    if (result.nextPhase !== state.phase) {
      patch.phase = result.nextPhase;
      patch.phaseStartedAt = Date.now();
    }
    if (result.nextRound !== undefined) {
      patch.round = result.nextRound;
    }
    await ctx.db.patch(state._id, patch);

    if (result.roundResult) {
      await ctx.db.insert("roundResults", {
        roomId,
        round: state.round,
        winnerUserId: result.roundResult.winnerUserId,
        payload: result.roundResult.payload,
        createdAt: Date.now(),
      });
    }

    if (result.matchOver) {
      const room = await ctx.db.get(roomId);
      if (room) await ctx.db.patch(roomId, { status: "finished" });

      const ratingDeltas = await finalizeMatchStats(ctx, roomId, players);
      if (Object.keys(ratingDeltas).length > 0) {
        await ctx.db.patch(state._id, {
          data: { ...(result.nextData as Record<string, unknown>), ratingDeltas },
        });
      }
    } else if (result.nextTimeoutMs !== undefined) {
      const scheduledRound = result.nextRound ?? state.round;
      await ctx.scheduler.runAfter(
        result.nextTimeoutMs + 500,
        internal.match.autoPhaseTimeout,
        { roomId, round: scheduledRound, phase: result.nextPhase },
      );
    } else if (result.nextPhase === "round-result" && result.nextPhase !== state.phase) {
      // Schedule auto-advance to next round after 5 seconds if players haven't both clicked yet.
      await ctx.scheduler.runAfter(5000, internal.match.autoNextRound, {
        roomId,
        round: state.round,
      });
    }
    return null;
  },
});

export const nextRound = mutation({
  args: { sessionToken: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionToken, roomId }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) throw new Error("Not signed in");

    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();
    if (!state) throw new Error("Match not active");
    if (state.phase !== "round-result") return null;

    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    if (!players.some((p) => p.userId === user._id)) {
      throw new Error("Not in this match");
    }

    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "in-game") return null;

    const data = state.data as Record<string, unknown>;
    const currentVotes = (data.continueVotes as Id<"users">[] | undefined) ?? [];
    if (currentVotes.includes(user._id)) return null; // already voted

    const newVotes = [...currentVotes, user._id];

    if (newVotes.length >= players.length) {
      // Both players voted — advance immediately.
      const mod = getGameModule(state.gameId);
      const next = mod.nextRoundData(state, players);
      const nextRoundNum = state.round + 1;
      await ctx.db.patch(state._id, {
        round: nextRoundNum,
        phase: next.phase,
        phaseStartedAt: Date.now(),
        data: next.data,
      });
      if (mod.initRound) {
        await mod.initRound(ctx, roomId, nextRoundNum, players.map((p) => p.userId));
      }
      await maybeSchedulePickingTimeout(ctx, state.gameId, roomId, nextRoundNum, next.phase);
    } else {
      // Record vote, wait for the other player or the 5-second auto-advance.
      await ctx.db.patch(state._id, {
        data: { ...data, continueVotes: newVotes },
      });
    }
    return null;
  },
});

export const autoNextRound = internalMutation({
  args: { roomId: v.id("rooms"), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();
    // No-op if the phase already moved on (both players clicked early).
    if (!state || state.phase !== "round-result" || state.round !== round) return null;

    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "in-game") return null;

    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const mod = getGameModule(state.gameId);
    const next = mod.nextRoundData(state, players);
    const nextRoundNum = state.round + 1;
    await ctx.db.patch(state._id, {
      round: nextRoundNum,
      phase: next.phase,
      phaseStartedAt: Date.now(),
      data: next.data,
    });
    if (mod.initRound) {
      await mod.initRound(ctx, roomId, nextRoundNum, players.map((p) => p.userId));
    }
    await maybeSchedulePickingTimeout(ctx, state.gameId, roomId, nextRoundNum, next.phase);
    return null;
  },
});

export const autoPregameTimeout = internalMutation({
  args: { roomId: v.id("rooms"), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();
    if (!state || state.phase !== "pregame" || state.round !== round) return null;

    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "in-game") return null;

    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const mod = getGameModule(state.gameId);
    if (!mod.onPregameTimeout) return null;

    const result = await mod.onPregameTimeout(ctx, state, players);
    if (!result) return null;

    await ctx.db.patch(state._id, {
      phase: result.nextPhase,
      phaseStartedAt: Date.now(),
      data: result.nextData,
    });

    // After pregame ends, schedule the playing-phase timeout (e.g. for Spotlight).
    await maybeSchedulePlayingTimeout(ctx, state.gameId, roomId, round, result.nextPhase);

    // For games that drive their own phase timeouts via nextTimeoutMs (e.g. Mimic).
    if (result.nextTimeoutMs !== undefined) {
      await ctx.scheduler.runAfter(
        result.nextTimeoutMs + 500,
        internal.match.autoPhaseTimeout,
        { roomId, round, phase: result.nextPhase },
      );
    }
    return null;
  },
});

export const autoPickingTimeout = internalMutation({
  args: { roomId: v.id("rooms"), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();
    // No-op if already resolved (different phase, different round, or no state)
    if (!state || state.phase !== "picking" || state.round !== round) return null;

    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "in-game") return null;

    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const mod = getGameModule(state.gameId);
    if (!mod.onTimeout) return null;

    const result = await mod.onTimeout(ctx, state, players);
    if (!result) return null;

    const patch: { data: unknown; phase?: string; phaseStartedAt?: number } = {
      data: result.nextData,
    };
    if (result.nextPhase !== state.phase) {
      patch.phase = result.nextPhase;
      patch.phaseStartedAt = Date.now();
    }
    await ctx.db.patch(state._id, patch);

    if (result.roundResult) {
      await ctx.db.insert("roundResults", {
        roomId,
        round: state.round,
        winnerUserId: result.roundResult.winnerUserId,
        payload: result.roundResult.payload,
        createdAt: Date.now(),
      });
    }

    if (result.matchOver) {
      await ctx.db.patch(roomId, { status: "finished" });
      const ratingDeltas = await finalizeMatchStats(ctx, roomId, players);
      if (Object.keys(ratingDeltas).length > 0) {
        await ctx.db.patch(state._id, {
          data: { ...(result.nextData as Record<string, unknown>), ratingDeltas },
        });
      }
    } else if (result.nextPhase === "round-result") {
      await ctx.scheduler.runAfter(5000, internal.match.autoNextRound, {
        roomId,
        round: state.round,
      });
    }

    return null;
  },
});

export const autoPlayingTimeout = internalMutation({
  args: { roomId: v.id("rooms"), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();
    // No-op if already resolved (different phase, different round, or no state)
    if (!state || state.phase !== "playing" || state.round !== round) return null;

    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "in-game") return null;

    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const mod = getGameModule(state.gameId);
    if (!mod.onTimeout) return null;

    const result = await mod.onTimeout(ctx, state, players);
    if (!result) return null;

    const patch: { data: unknown; phase?: string; phaseStartedAt?: number } = {
      data: result.nextData,
    };
    if (result.nextPhase !== state.phase) {
      patch.phase = result.nextPhase;
      patch.phaseStartedAt = Date.now();
    }
    await ctx.db.patch(state._id, patch);

    if (result.roundResult) {
      await ctx.db.insert("roundResults", {
        roomId,
        round: state.round,
        winnerUserId: result.roundResult.winnerUserId,
        payload: result.roundResult.payload,
        createdAt: Date.now(),
      });
    }

    if (result.matchOver) {
      await ctx.db.patch(roomId, { status: "finished" });
      const ratingDeltas = await finalizeMatchStats(ctx, roomId, players);
      if (Object.keys(ratingDeltas).length > 0) {
        await ctx.db.patch(state._id, {
          data: { ...(result.nextData as Record<string, unknown>), ratingDeltas },
        });
      }
    }

    return null;
  },
});

/**
 * Generic phase-timeout handler for games that use the nextTimeoutMs mechanism
 * (e.g. Mimic). Fires when the scheduled phase expires; calls mod.onPhaseTimeout.
 */
export const autoPhaseTimeout = internalMutation({
  args: { roomId: v.id("rooms"), round: v.number(), phase: v.string() },
  handler: async (ctx, { roomId, round, phase }) => {
    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();
    if (!state || state.phase !== phase || state.round !== round) return null;

    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "in-game") return null;

    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const mod = getGameModule(state.gameId);
    if (!mod.onPhaseTimeout) return null;

    const result = await mod.onPhaseTimeout(ctx, state, players, phase);
    if (!result) return null;

    const newRound = result.nextRound ?? round;
    const patch: { data: unknown; phase?: string; phaseStartedAt?: number; round?: number } = {
      data: result.nextData,
    };
    if (result.nextPhase !== state.phase) {
      patch.phase = result.nextPhase;
      patch.phaseStartedAt = Date.now();
    }
    if (result.nextRound !== undefined) {
      patch.round = result.nextRound;
    }
    await ctx.db.patch(state._id, patch);

    if (result.roundResult) {
      await ctx.db.insert("roundResults", {
        roomId,
        round: state.round,
        winnerUserId: result.roundResult.winnerUserId,
        payload: result.roundResult.payload,
        createdAt: Date.now(),
      });
    }

    if (result.matchOver) {
      await ctx.db.patch(roomId, { status: "finished" });
      const ratingDeltas = await finalizeMatchStats(ctx, roomId, players);
      if (Object.keys(ratingDeltas).length > 0) {
        await ctx.db.patch(state._id, {
          data: { ...(result.nextData as Record<string, unknown>), ratingDeltas },
        });
      }
    } else if (result.nextTimeoutMs !== undefined) {
      await ctx.scheduler.runAfter(
        result.nextTimeoutMs + 500,
        internal.match.autoPhaseTimeout,
        { roomId, round: newRound, phase: result.nextPhase },
      );
    }

    return null;
  },
});

export const forfeit = mutation({
  args: { sessionToken: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionToken, roomId }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) throw new Error("Not signed in");

    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "in-game") return null;

    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    if (!players.some((p) => p.userId === user._id)) throw new Error("Not in this match");

    const forfeiter = players.find((p) => p.userId === user._id)!;
    const winner = players.find((p) => p.userId !== user._id);

    // Mark room finished with forfeit data.
    await ctx.db.patch(roomId, { status: "finished" });

    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();

    // Apply rating delta for forfeit (same formula as a normal loss).
    let ratingDeltas: Record<string, number> = {};
    if (winner && !user.isGuest) {
      const winnerUser = await ctx.db.get(winner.userId);
      if (winnerUser && !winnerUser.isGuest) {
        const { gameId } = room;
        const gr0 = await getOrCreateGameRating(ctx, winnerUser._id, gameId);
        const gr1 = await getOrCreateGameRating(ctx, user._id, gameId);

        const factor =
          gameId === "safecracker" ? 0.5 :
          gameId === "mimic" ? 0.4 :
          gameId === "number-trap" ? 0.25 :
          gameId === "high-low" ? 0.2 :
          gameId === "minefield" ? 0.3 :
          gameId === "spotlight" ? 0.15 : 0.15;
        const delta = Math.round(factor * (gr1.rating / Math.max(0.01, gr0.rating)) * 1000) / 1000;

        await ctx.db.patch(gr0._id, { rating: gr0.rating + delta, matchesPlayed: gr0.matchesPlayed + 1, wins: gr0.wins + 1 });
        await ctx.db.patch(gr1._id, { rating: Math.max(0.01, gr1.rating - delta), matchesPlayed: gr1.matchesPlayed + 1 });

        await ctx.db.patch(winnerUser._id, {
          matchesPlayed: winnerUser.matchesPlayed + 1,
          wins: (winnerUser.wins ?? 0) + 1,
        });
        await ctx.db.patch(user._id, {
          matchesPlayed: user.matchesPlayed + 1,
        });

        ratingDeltas[winnerUser._id as string] = delta;
        ratingDeltas[user._id as string] = -delta;
      }
    }

    // Store forfeit info in matchState so the other player is notified.
    if (state) {
      const existingData = (state.data ?? {}) as Record<string, unknown>;
      await ctx.db.patch(state._id, {
        data: {
          ...existingData,
          forfeit: true,
          forfeitedBy: user._id,
          ratingDeltas,
        },
      });
    }

    return null;
  },
});

export const rematch = mutation({
  args: { sessionToken: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionToken, roomId }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) throw new Error("Not signed in");
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    await ctx.db.patch(roomId, { status: "lobby" });
    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    for (const p of players) {
      await ctx.db.patch(p._id, { ready: false, score: 0, streak: 0 });
    }
    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();
    if (state) await ctx.db.delete(state._id);
    return null;
  },
});
