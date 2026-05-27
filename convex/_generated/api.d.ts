/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as crons from "../crons.js";
import type * as games_highlow from "../games/highlow.js";
import type * as games_minefield from "../games/minefield.js";
import type * as games_numbertrap from "../games/numbertrap.js";
import type * as games_safecracker from "../games/safecracker.js";
import type * as games_spotlight from "../games/spotlight.js";
import type * as games_timeout from "../games/timeout.js";
import type * as leaderboard from "../leaderboard.js";
import type * as match from "../match.js";
import type * as rooms from "../rooms.js";
import type * as users from "../users.js";
import type * as util from "../util.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  crons: typeof crons;
  "games/highlow": typeof games_highlow;
  "games/minefield": typeof games_minefield;
  "games/numbertrap": typeof games_numbertrap;
  "games/safecracker": typeof games_safecracker;
  "games/spotlight": typeof games_spotlight;
  "games/timeout": typeof games_timeout;
  leaderboard: typeof leaderboard;
  match: typeof match;
  rooms: typeof rooms;
  users: typeof users;
  util: typeof util;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
