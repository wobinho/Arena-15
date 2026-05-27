import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { userFromSession, DEFAULT_RATING } from "./users";
import * as Timeout from "./games/timeout";
import * as HighLow from "./games/highlow";

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
  }>;
};

const GAMES: Record<string, GameModule> = {
  timeout: Timeout,
  "high-low": HighLow,
};

export function getGameModule(gameId: string): GameModule {
  const g = GAMES[gameId];
  if (!g) throw new Error(`Unknown game: ${gameId}`);
  return g;
}

async function finalizeMatchStats(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  players: Doc<"roomPlayers">[],
): Promise<Record<string, number>> {
  const deltas: Record<string, number> = {};
  if (players.length !== 2) return deltas;

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

  // Track matchesPlayed and wins for registered accounts.
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

  // Apply rating when both are registered and there is a clear winner.
  if (!user0.isGuest && !user1.isGuest && (p0Won || p1Won)) {
    const [winnerUser, loserUser, winnerWins, loserWins] = p0Won
      ? [user0, user1, w0, w1]
      : [user1, user0, w1, w0];

    const winnerRating = winnerUser.rating ?? DEFAULT_RATING;
    const loserRating = loserUser.rating ?? DEFAULT_RATING;

    // baseGain: 0.05 per round won minus 0.05 per round the opponent won.
    // multiplier: winner_rating / loser_rating (higher-rated winner gains more).
    const baseGain = winnerWins * 0.05 - loserWins * 0.05;
    const multiplier = winnerRating / Math.max(0.01, loserRating);
    const delta = Math.round(baseGain * multiplier * 1000) / 1000;

    await ctx.db.patch(winnerUser._id, { rating: winnerRating + delta });
    await ctx.db.patch(loserUser._id, { rating: Math.max(0.01, loserRating - delta) });

    deltas[winnerUser._id as string] = delta;
    deltas[loserUser._id as string] = -delta;
  }

  return deltas;
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
      const room = await ctx.db.get(roomId);
      if (room) await ctx.db.patch(roomId, { status: "finished" });

      const ratingDeltas = await finalizeMatchStats(ctx, roomId, players);
      if (Object.keys(ratingDeltas).length > 0) {
        await ctx.db.patch(state._id, {
          data: { ...(result.nextData as Record<string, unknown>), ratingDeltas },
        });
      }
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
      await ctx.db.patch(state._id, {
        round: state.round + 1,
        phase: next.phase,
        phaseStartedAt: Date.now(),
        data: next.data,
      });
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
    await ctx.db.patch(state._id, {
      round: state.round + 1,
      phase: next.phase,
      phaseStartedAt: Date.now(),
      data: next.data,
    });
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
