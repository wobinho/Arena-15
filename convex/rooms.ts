import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { userFromSession, DEFAULT_RATING } from "./users";
import { generateRoomCode } from "./util";
import { startMatch } from "./match";

export type RoomPlayerView = {
  _id: Id<"roomPlayers">;
  userId: Id<"users">;
  handle: string;
  avatar: string;
  isHost: boolean;
  ready: boolean;
  seatIndex: number;
  score: number;
  streak: number;
  rating: number;
};

export type RoomView = {
  _id: Id<"rooms">;
  code: string;
  gameId: string;
  hostId: Id<"users">;
  visibility: "private" | "public";
  status: "lobby" | "in-game" | "finished";
  createdAt: number;
  players: RoomPlayerView[];
};

async function loadRoomView(
  ctx: QueryCtx | MutationCtx,
  room: Doc<"rooms">,
): Promise<RoomView> {
  const players = await ctx.db
    .query("roomPlayers")
    .withIndex("by_room", (q) => q.eq("roomId", room._id))
    .collect();
  players.sort((a, b) => a.seatIndex - b.seatIndex);

  const playerViews = await Promise.all(
    players.map(async (p) => {
      const user = await ctx.db.get(p.userId);
      // Prefer per-game rating so room lobby reflects live rating changes after matches.
      const gameRating = await ctx.db
        .query("userGameRatings")
        .withIndex("by_user_game", (q) => q.eq("userId", p.userId).eq("gameId", room.gameId))
        .unique();
      return {
        _id: p._id,
        userId: p.userId,
        handle: p.handle,
        avatar: p.avatar,
        isHost: p.isHost,
        ready: p.ready,
        seatIndex: p.seatIndex,
        score: p.score,
        streak: p.streak,
        rating: gameRating?.rating ?? user?.rating ?? DEFAULT_RATING,
      };
    }),
  );

  return {
    _id: room._id,
    code: room.code,
    gameId: room.gameId,
    hostId: room.hostId,
    visibility: room.visibility,
    status: room.status,
    createdAt: room.createdAt,
    players: playerViews,
  };
}

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!room) return null;
    return await loadRoomView(ctx, room);
  },
});

export const create = mutation({
  args: {
    sessionToken: v.string(),
    gameId: v.string(),
    visibility: v.union(v.literal("private"), v.literal("public")),
  },
  handler: async (ctx, { sessionToken, gameId, visibility }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) throw new Error("Not signed in");
    if (user.isGuest && visibility === "public") {
      throw new Error("Guest accounts can only create private rooms");
    }

    // Generate a unique code (rare collision, but retry up to 5x)
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateRoomCode();
      const clash = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", candidate))
        .unique();
      if (!clash) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not allocate a room code");

    const now = Date.now();
    const roomId = await ctx.db.insert("rooms", {
      code,
      gameId,
      hostId: user._id,
      visibility,
      status: "lobby",
      createdAt: now,
    });
    await ctx.db.insert("roomPlayers", {
      roomId,
      userId: user._id,
      handle: user.handle,
      avatar: user.avatar,
      isHost: true,
      ready: false,
      seatIndex: 0,
      score: 0,
      streak: 0,
      joinedAt: now,
    });
    const room = await ctx.db.get(roomId);
    return await loadRoomView(ctx, room!);
  },
});

export const join = mutation({
  args: { sessionToken: v.string(), code: v.string() },
  handler: async (ctx, { sessionToken, code }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) throw new Error("Not signed in");

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!room) throw new Error("Room not found");
    if (room.status !== "lobby") throw new Error("Room is not accepting players");
    if (user.isGuest && room.visibility === "public") {
      throw new Error("Guest accounts can only join private rooms");
    }

    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    // If user already in this room, return it (idempotent).
    const existing = players.find((p) => p.userId === user._id);
    if (existing) return await loadRoomView(ctx, room);

    if (players.length >= 2) throw new Error("Room is full");

    const occupiedSeats = new Set(players.map((p) => p.seatIndex));
    const seatIndex = occupiedSeats.has(0) ? 1 : 0;

    await ctx.db.insert("roomPlayers", {
      roomId: room._id,
      userId: user._id,
      handle: user.handle,
      avatar: user.avatar,
      isHost: false,
      ready: false,
      seatIndex,
      score: 0,
      streak: 0,
      joinedAt: Date.now(),
    });
    return await loadRoomView(ctx, room);
  },
});

export const toggleReady = mutation({
  args: { sessionToken: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionToken, roomId }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) throw new Error("Not signed in");
    const player = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", user._id))
      .unique();
    if (!player) throw new Error("Not in room");
    await ctx.db.patch(player._id, { ready: !player.ready });

    const room = await ctx.db.get(roomId);
    if (!room) return null;
    // While in-game, ready toggling has no effect on match start.
    if (room.status === "in-game") return null;
    // After a finished match, a player readying up resets the room to lobby
    // so both players can queue again without needing an explicit rematch call.
    if (room.status === "finished") {
      await ctx.db.patch(roomId, { status: "lobby" });
    }
    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    if (players.length === 2 && players.every((p) => p.ready)) {
      await startMatch(ctx, roomId);
    }
    return null;
  },
});

export const changeGame = mutation({
  args: { sessionToken: v.string(), roomId: v.id("rooms"), gameId: v.string() },
  handler: async (ctx, { sessionToken, roomId, gameId }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) throw new Error("Not signed in");
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== user._id) throw new Error("Only the host can change the game");
    if (room.status !== "lobby") throw new Error("Cannot change game once the match has started");

    await ctx.db.patch(roomId, { gameId });

    // Reset all players' ready state when the game changes
    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    for (const p of players) {
      await ctx.db.patch(p._id, { ready: false });
    }
    return null;
  },
});

export const leave = mutation({
  args: { sessionToken: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionToken, roomId }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) return null;
    const player = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", user._id))
      .unique();
    if (!player) return null;
    await ctx.db.delete(player._id);

    const remaining = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    if (remaining.length === 0) {
      // Tear down room + match state.
      const state = await ctx.db
        .query("matchState")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .unique();
      if (state) await ctx.db.delete(state._id);
      const room = await ctx.db.get(roomId);
      if (room) await ctx.db.delete(room._id);
    } else if (player.isHost) {
      // Promote remaining player to host.
      await ctx.db.patch(remaining[0]._id, { isHost: true });
      const room = await ctx.db.get(roomId);
      if (room) await ctx.db.patch(roomId, { hostId: remaining[0].userId });
    }
    return null;
  },
});
