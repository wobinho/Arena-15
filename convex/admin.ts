import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ─── List all users (real-time via useQuery) ──────────────────────────────────
export const listUsers = query({
  args: {
    search: v.optional(v.string()),
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { search, cursor, limit }) => {
    const pageSize = Math.min(limit ?? 50, 100);

    // Full table scan with optional client-side handle filter.
    // For large tables, add a search index; for now this is fine for admin use.
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
      xp: u.xp,
      matchesPlayed: u.matchesPlayed,
      wins: u.wins ?? 0,
      rating: u.rating ?? 1.0,
      createdAt: u.createdAt,
    }));
  },
});

// ─── Update a user (partial patch) ───────────────────────────────────────────
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    handle: v.optional(v.string()),
    email: v.optional(v.union(v.string(), v.null())),
    xp: v.optional(v.number()),
    wins: v.optional(v.number()),
    matchesPlayed: v.optional(v.number()),
    rating: v.optional(v.number()),
    isGuest: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, ...fields }) => {
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

    await ctx.db.patch(userId, patch);
    return ctx.db.get(userId);
  },
});

// ─── Delete a user and their sessions ────────────────────────────────────────
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Delete all sessions for this user.
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
  args: {},
  handler: async (ctx) => {
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
