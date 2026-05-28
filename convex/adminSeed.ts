import { mutation } from "./_generated/server";
import { hashPassword } from "./util";

/**
 * ONE-TIME USE — run from the Convex dashboard, then delete this file.
 * Creates the ARENA-ADMIN account if it doesn't already exist.
 */
export const createAdminUser = mutation({
  args: {},
  handler: async (ctx) => {
    const email = "admin@arena15.app";
    const emailLower = email.toLowerCase();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email_lower", (q) => q.eq("emailLower", emailLower))
      .unique();

    if (existing) {
      return { ok: false, message: "Admin user already exists" };
    }

    const { hash, salt } = await hashPassword("admin-15-santi");

    await ctx.db.insert("users", {
      handle: "ARENA-ADMIN",
      handleLower: "arena-admin",
      avatar: "bot",
      isGuest: false,
      email,
      emailLower,
      passwordHash: hash,
      passwordSalt: salt,
      isAdmin: true,
      xp: 0,
      matchesPlayed: 0,
      wins: 0,
      rating: 1.0,
      createdAt: Date.now(),
    });

    return { ok: true, message: "Admin user created. Email: admin@arena15.app" };
  },
});
