import { v } from "convex/values";
import { query } from "./_generated/server";
import { DEFAULT_RATING } from "./users";

export const getTopPlayers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) => {
    // Scan all users (documents with undefined rating are excluded from the by_rating
    // index, so we do a full scan and sort in JS to ensure no one is missed).
    const candidates = await ctx.db.query("users").take(500);

    const active = candidates
      .filter((u) => !u.isGuest && (u.matchesPlayed ?? 0) >= 1)
      .sort((a, b) => (b.rating ?? DEFAULT_RATING) - (a.rating ?? DEFAULT_RATING));

    return active.slice(0, limit).map((u, i) => ({
      rank: i + 1,
      handle: u.handle,
      avatar: u.avatar,
      rating: u.rating ?? DEFAULT_RATING,
      matchesPlayed: u.matchesPlayed ?? 0,
    }));
  },
});
