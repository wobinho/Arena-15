import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  generateSessionToken,
  generateGuestHandle,
  pickAvatar,
  hashPassword,
} from "./util";

export const DEFAULT_RATING = 1.0;

// Public shape returned to clients. Never include passwordHash / salt.
export type PublicUser = {
  _id: Id<"users">;
  handle: string;
  avatar: string;
  isGuest: boolean;
  email?: string;
  xp: number;
  matchesPlayed: number;
  wins: number;
  rating: number;
};

function toPublic(u: Doc<"users">): PublicUser {
  return {
    _id: u._id,
    handle: u.handle,
    avatar: u.avatar,
    isGuest: u.isGuest,
    email: u.email,
    xp: u.xp,
    matchesPlayed: u.matchesPlayed,
    wins: u.wins ?? 0,
    rating: u.rating ?? DEFAULT_RATING,
  };
}

export async function userFromSession(
  ctx: QueryCtx,
  sessionToken: string | null,
): Promise<Doc<"users"> | null> {
  if (!sessionToken) return null;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .unique();
  if (!session) return null;
  return await ctx.db.get(session.userId);
}

export const me = query({
  args: { sessionToken: v.union(v.string(), v.null()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await userFromSession(ctx, sessionToken);
    return user ? toPublic(user) : null;
  },
});

export const createGuest = mutation({
  args: { preferredHandle: v.optional(v.string()) },
  handler: async (ctx, { preferredHandle }) => {
    let handle = (preferredHandle ?? "").trim();
    if (handle.length < 3) handle = generateGuestHandle();
    // Disambiguate handle collisions for guests by appending random suffix.
    let handleLower = handle.toLowerCase();
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db
        .query("users")
        .withIndex("by_handle_lower", (q) => q.eq("handleLower", handleLower))
        .unique();
      if (!clash) break;
      handle = `${handle}_${Math.floor(100 + Math.random() * 900)}`;
      handleLower = handle.toLowerCase();
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      handle,
      handleLower,
      avatar: pickAvatar(handle),
      isGuest: true,
      xp: 0,
      matchesPlayed: 0,
      rating: DEFAULT_RATING,
      createdAt: now,
    });
    const token = generateSessionToken();
    await ctx.db.insert("sessions", {
      token,
      userId,
      createdAt: now,
      lastSeenAt: now,
    });
    const user = await ctx.db.get(userId);
    return { sessionToken: token, user: toPublic(user!) };
  },
});

export const updateHandle = mutation({
  args: { sessionToken: v.string(), handle: v.string() },
  handler: async (ctx, { sessionToken, handle }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) throw new Error("Not signed in");
    const trimmed = handle.trim();
    if (trimmed.length < 3) throw new Error("Handle must be at least 3 characters");
    const handleLower = trimmed.toLowerCase();
    if (handleLower !== user.handleLower) {
      const clash = await ctx.db
        .query("users")
        .withIndex("by_handle_lower", (q) => q.eq("handleLower", handleLower))
        .unique();
      if (clash) throw new Error("That handle is taken");
    }
    await ctx.db.patch(user._id, {
      handle: trimmed,
      handleLower,
      avatar: pickAvatar(trimmed),
    });
    return toPublic((await ctx.db.get(user._id))!);
  },
});

export const signUp = mutation({
  args: {
    sessionToken: v.union(v.string(), v.null()),
    handle: v.string(),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { sessionToken, handle, email, password }) => {
    const trimmedHandle = handle.trim();
    const trimmedEmail = email.trim();
    if (trimmedHandle.length < 3) throw new Error("Handle must be at least 3 characters");
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) throw new Error("Enter a valid email");
    if (password.length < 6) throw new Error("Password needs 6+ characters");

    const emailLower = trimmedEmail.toLowerCase();
    const handleLower = trimmedHandle.toLowerCase();

    const emailClash = await ctx.db
      .query("users")
      .withIndex("by_email_lower", (q) => q.eq("emailLower", emailLower))
      .unique();
    if (emailClash) throw new Error("An account with that email already exists");

    const existing = await userFromSession(ctx, sessionToken);
    const handleClash = await ctx.db
      .query("users")
      .withIndex("by_handle_lower", (q) => q.eq("handleLower", handleLower))
      .unique();
    if (handleClash && handleClash._id !== existing?._id) {
      throw new Error("That handle is taken");
    }

    const { hash, salt } = await hashPassword(password);
    const now = Date.now();

    let userId: Id<"users">;
    if (existing && existing.isGuest) {
      // Promote guest to real account.
      await ctx.db.patch(existing._id, {
        handle: trimmedHandle,
        handleLower,
        email: trimmedEmail,
        emailLower,
        isGuest: false,
        passwordHash: hash,
        passwordSalt: salt,
        avatar: pickAvatar(trimmedHandle),
      });
      userId = existing._id;
    } else {
      userId = await ctx.db.insert("users", {
        handle: trimmedHandle,
        handleLower,
        avatar: pickAvatar(trimmedHandle),
        isGuest: false,
        email: trimmedEmail,
        emailLower,
        passwordHash: hash,
        passwordSalt: salt,
        xp: 0,
        matchesPlayed: 0,
        rating: DEFAULT_RATING,
        createdAt: now,
      });
    }

    const token = generateSessionToken();
    await ctx.db.insert("sessions", {
      token,
      userId,
      createdAt: now,
      lastSeenAt: now,
    });
    const user = await ctx.db.get(userId);
    return { sessionToken: token, user: toPublic(user!) };
  },
});

export const signIn = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const emailLower = email.trim().toLowerCase();
    const candidate = await ctx.db
      .query("users")
      .withIndex("by_email_lower", (q) => q.eq("emailLower", emailLower))
      .unique();
    if (!candidate || !candidate.passwordHash || !candidate.passwordSalt) {
      throw new Error("Invalid email or password");
    }
    const { hash } = await hashPassword(password, candidate.passwordSalt);
    if (hash !== candidate.passwordHash) throw new Error("Invalid email or password");
    const now = Date.now();
    const token = generateSessionToken();
    await ctx.db.insert("sessions", {
      token,
      userId: candidate._id,
      createdAt: now,
      lastSeenAt: now,
    });
    return { sessionToken: token, user: toPublic(candidate) };
  },
});

export const getMyGameStats = query({
  args: { sessionToken: v.union(v.string(), v.null()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await userFromSession(ctx, sessionToken);
    if (!user) return null;

    const participations = await ctx.db
      .query("roomPlayers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(200);

    const perGame: Record<string, { wins: number; losses: number }> = {};

    for (const rp of participations) {
      const room = await ctx.db.get(rp.roomId);
      if (!room || room.status !== "finished") continue;

      const { gameId } = room;
      if (!perGame[gameId]) perGame[gameId] = { wins: 0, losses: 0 };

      const roundResults = await ctx.db
        .query("roundResults")
        .withIndex("by_room_round", (q) => q.eq("roomId", rp.roomId))
        .take(20);

      const roundWins: Record<string, number> = {};
      for (const rr of roundResults) {
        if (rr.winnerUserId) {
          roundWins[rr.winnerUserId as string] = (roundWins[rr.winnerUserId as string] ?? 0) + 1;
        }
      }

      const myWins = roundWins[user._id as string] ?? 0;
      const opponentWins = Object.entries(roundWins)
        .filter(([id]) => id !== (user._id as string))
        .reduce((max, [, v]) => Math.max(max, v), 0);

      if (myWins > opponentWins) {
        perGame[gameId].wins++;
      } else if (myWins < opponentWins) {
        perGame[gameId].losses++;
      }
    }

    return { perGame, rating: user.rating ?? DEFAULT_RATING };
  },
});

export const backfillRatings = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let patched = 0;
    for (const u of users) {
      if (u.rating === undefined) {
        await ctx.db.patch(u._id, { rating: DEFAULT_RATING });
        patched++;
      }
    }
    return { patched };
  },
});

export const signOut = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return null;
  },
});
