import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    handle: v.string(),
    handleLower: v.string(),
    avatar: v.string(),
    isGuest: v.boolean(),
    email: v.optional(v.string()),
    emailLower: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
    xp: v.number(),
    matchesPlayed: v.number(),
    wins: v.optional(v.number()),
    rating: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_handle_lower", ["handleLower"])
    .index("by_email_lower", ["emailLower"])
    .index("by_rating", ["rating"]),

  sessions: defineTable({
    token: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_token", ["token"]),

  rooms: defineTable({
    code: v.string(),
    gameId: v.string(),
    hostId: v.id("users"),
    visibility: v.union(v.literal("private"), v.literal("public")),
    status: v.union(
      v.literal("lobby"),
      v.literal("in-game"),
      v.literal("finished"),
    ),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  roomPlayers: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    handle: v.string(),
    avatar: v.string(),
    isHost: v.boolean(),
    ready: v.boolean(),
    seatIndex: v.number(),
    score: v.number(),
    streak: v.number(),
    joinedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_user", ["roomId", "userId"])
    .index("by_user", ["userId"]),

  matchState: defineTable({
    roomId: v.id("rooms"),
    gameId: v.string(),
    round: v.number(),
    phase: v.string(),
    phaseStartedAt: v.number(),
    data: v.any(),
  }).index("by_room", ["roomId"]),

  roundResults: defineTable({
    roomId: v.id("rooms"),
    round: v.number(),
    winnerUserId: v.optional(v.id("users")),
    payload: v.any(),
    createdAt: v.number(),
  }).index("by_room_round", ["roomId", "round"]),
});
