import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { userFromSession, DEFAULT_RATING } from "./users";
import { hashPassword, generateSessionToken } from "./util";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function adminFromSession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
) {
  const user = await userFromSession(ctx, sessionToken);
  if (!user || !user.isAdmin) return null;
  return user;
}

// ─── Admin sign-in ────────────────────────────────────────────────────────────

/**
 * Sign in as an admin. Returns the session token on success.
 * The account must have `isAdmin: true` in the users table.
 * To bootstrap the first admin, set isAdmin=true on the desired user via
 * the Convex dashboard.
 */
export const adminSignIn = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const emailLower = email.trim().toLowerCase();
    const candidate = await ctx.db
      .query("users")
      .withIndex("by_email_lower", (q) => q.eq("emailLower", emailLower))
      .unique();

    if (!candidate || !candidate.passwordHash || !candidate.passwordSalt) {
      throw new Error("Invalid credentials");
    }
    if (!candidate.isAdmin) {
      throw new Error("Not authorized as admin");
    }

    const { hash } = await hashPassword(password, candidate.passwordSalt);
    if (hash !== candidate.passwordHash) throw new Error("Invalid credentials");

    const now = Date.now();
    const token = generateSessionToken();
    await ctx.db.insert("sessions", {
      token,
      userId: candidate._id,
      createdAt: now,
      lastSeenAt: now,
    });
    return { sessionToken: token, handle: candidate.handle };
  },
});

// ─── Verify admin session (used by the admin layout) ─────────────────────────

export const verifyAdminSession = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await adminFromSession(ctx, sessionToken);
    if (!user) return null;
    return { _id: user._id, handle: user.handle };
  },
});

// ─── List all users ───────────────────────────────────────────────────────────

export const listUsers = query({
  args: {
    sessionToken: v.string(),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, search, limit: _limit }) => {
    if (!(await adminFromSession(ctx, sessionToken))) throw new Error("Unauthorized");

    const page = await ctx.db.query("users").order("desc").take(500);

    const filtered = search
      ? page.filter((u) =>
          u.handle.toLowerCase().includes(search.toLowerCase()) ||
          (u.email ?? "").toLowerCase().includes(search.toLowerCase()),
        )
      : page;

    return filtered.map((u) => ({
      _id: u._id,
      _creationTime: u._creationTime,
      handle: u.handle,
      email: u.email ?? null,
      avatar: u.avatar,
      isGuest: u.isGuest,
      isAdmin: u.isAdmin ?? false,
      xp: u.xp,
      matchesPlayed: u.matchesPlayed,
      wins: u.wins ?? 0,
      rating: u.rating ?? 1.0,
      createdAt: u.createdAt,
    }));
  },
});

// ─── Update a user ────────────────────────────────────────────────────────────

export const updateUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    handle: v.optional(v.string()),
    email: v.optional(v.union(v.string(), v.null())),
    xp: v.optional(v.number()),
    wins: v.optional(v.number()),
    matchesPlayed: v.optional(v.number()),
    rating: v.optional(v.number()),
    isGuest: v.optional(v.boolean()),
    isAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionToken, userId, ...fields }) => {
    if (!(await adminFromSession(ctx, sessionToken))) throw new Error("Unauthorized");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const patch: {
      handle?: string;
      handleLower?: string;
      email?: string;
      emailLower?: string;
      xp?: number;
      wins?: number;
      matchesPlayed?: number;
      rating?: number;
      isGuest?: boolean;
      isAdmin?: boolean;
    } = {};

    if (fields.handle !== undefined) {
      const trimmed = fields.handle.trim();
      if (trimmed.length < 3) throw new Error("Handle must be ≥ 3 chars");
      patch.handle = trimmed;
      patch.handleLower = trimmed.toLowerCase();
    }
    if (fields.email !== undefined) {
      patch.email = fields.email ?? undefined;
      patch.emailLower = fields.email ? fields.email.toLowerCase() : undefined;
    }
    if (fields.xp !== undefined) patch.xp = fields.xp;
    if (fields.wins !== undefined) patch.wins = fields.wins;
    if (fields.matchesPlayed !== undefined) patch.matchesPlayed = fields.matchesPlayed;
    if (fields.rating !== undefined) patch.rating = fields.rating;
    if (fields.isGuest !== undefined) patch.isGuest = fields.isGuest;
    if (fields.isAdmin !== undefined) patch.isAdmin = fields.isAdmin;

    await ctx.db.patch(userId, patch);
    return ctx.db.get(userId);
  },
});

// ─── Delete a user ────────────────────────────────────────────────────────────

export const deleteUser = mutation({
  args: { sessionToken: v.string(), userId: v.id("users") },
  handler: async (ctx, { sessionToken, userId }) => {
    if (!(await adminFromSession(ctx, sessionToken))) throw new Error("Unauthorized");

    const sessions = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .take(100);
    for (const s of sessions) await ctx.db.delete(s._id);

    await ctx.db.delete(userId);
    return null;
  },
});

// ─── Stats overview ───────────────────────────────────────────────────────────

export const stats = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    if (!(await adminFromSession(ctx, sessionToken))) throw new Error("Unauthorized");

    const users = await ctx.db.query("users").take(500);
    const guests = users.filter((u) => u.isGuest).length;
    const registered = users.length - guests;
    const sessions = await ctx.db.query("sessions").take(500);
    return {
      totalUsers: users.length,
      guests,
      registered,
      activeSessions: sessions.length,
    };
  },
});

// ─── Active games ─────────────────────────────────────────────────────────────

export const listActiveGames = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    if (!(await adminFromSession(ctx, sessionToken))) throw new Error("Unauthorized");

    const rooms = await ctx.db
      .query("rooms")
      .filter((q) => q.eq(q.field("status"), "in-game"))
      .take(50);

    const result = [];
    for (const room of rooms) {
      const players = await ctx.db
        .query("roomPlayers")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();

      const state = await ctx.db
        .query("matchState")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .unique();

      result.push({
        roomId: room._id,
        code: room.code,
        gameId: room.gameId,
        createdAt: room.createdAt,
        phase: state?.phase ?? "unknown",
        round: state?.round ?? 1,
        players: players.map((p) => ({
          userId: p.userId,
          handle: p.handle,
          avatar: p.avatar,
          score: p.score,
        })),
      });
    }

    return result;
  },
});

// ─── Force-end an active game (admin override) ────────────────────────────────

export const forceEndGame = mutation({
  args: { sessionToken: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionToken, roomId }) => {
    if (!(await adminFromSession(ctx, sessionToken))) throw new Error("Unauthorized");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");

    await ctx.db.patch(roomId, { status: "finished" });

    const state = await ctx.db
      .query("matchState")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .unique();
    if (state) await ctx.db.delete(state._id);

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
