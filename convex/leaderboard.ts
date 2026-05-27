import { v } from "convex/values";
import { query } from "./_generated/server";
import { DEFAULT_RATING } from "./users";

export const getTopPlayers = query({
  args: {
    gameId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { gameId, limit = 20 }) => {
    // Fetch top rows for this game ordered by rating descending.
    // The by_game_rating index is (gameId, rating) so we can use it directly.
    const rows = await ctx.db
      .query("userGameRatings")
      .withIndex("by_game_rating", (q) => q.eq("gameId", gameId))
      .order("desc")
      .take(500);

    // Filter to players with at least 1 match, then resolve user info.
    const results: Array<{
      rank: number;
      handle: string;
      avatar: string;
      rating: number;
      matchesPlayed: number;
    }> = [];

    for (const row of rows) {
      if (row.matchesPlayed < 1) continue;
      const user = await ctx.db.get(row.userId);
      if (!user || user.isGuest) continue;

      results.push({
        rank: 0, // filled below
        handle: user.handle,
        avatar: user.avatar,
        rating: row.rating,
        matchesPlayed: row.matchesPlayed,
      });

      if (results.length >= limit) break;
    }

    return results.map((r, i) => ({ ...r, rank: i + 1 }));
  },
});
