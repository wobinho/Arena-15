import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const GUEST_SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

export const cleanupAbandonedGuests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - GUEST_SESSION_TIMEOUT;

    // Find all guest sessions that haven't been seen for 24 hours
    const sessions = await ctx.db.query("sessions").take(1000);

    let deleted = 0;
    for (const session of sessions) {
      if (session.lastSeenAt < cutoff) {
        const user = await ctx.db.get(session.userId);
        // Delete abandoned guest accounts that haven't played any matches
        if (user && user.isGuest && user.matchesPlayed === 0) {
          await ctx.db.delete(user._id);
          await ctx.db.delete(session._id);
          deleted++;
        }
      }
    }

    return { deleted };
  },
});

const crons = cronJobs();

// Run cleanup every 6 hours to remove abandoned guest accounts
crons.interval("cleanup abandoned guests", { hours: 6 }, internal.crons.cleanupAbandonedGuests, {});

export default crons;
