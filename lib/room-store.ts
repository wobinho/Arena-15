"use client";

// Convex-backed room hooks. The old Zustand store is gone; rooms now live on the server.

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./auth-store";
import type { Id } from "@/convex/_generated/dataModel";
import type { GameId } from "./games";

export function useRoomByCode(code: string | null | undefined) {
  return useQuery(api.rooms.getByCode, code ? { code: code.toUpperCase() } : "skip");
}

export function useCreateRoom() {
  const create = useMutation(api.rooms.create);
  const { sessionToken } = useAuth();
  return async (gameId: GameId, visibility: "private" | "public" = "private") => {
    if (!sessionToken) throw new Error("No session yet");
    return await create({ sessionToken, gameId, visibility });
  };
}

export function useJoinRoom() {
  const join = useMutation(api.rooms.join);
  const { sessionToken } = useAuth();
  return async (code: string) => {
    if (!sessionToken) throw new Error("No session yet");
    return await join({ sessionToken, code: code.toUpperCase() });
  };
}

export function useToggleReady() {
  const toggle = useMutation(api.rooms.toggleReady);
  const { sessionToken } = useAuth();
  return async (roomId: Id<"rooms">) => {
    if (!sessionToken) throw new Error("No session yet");
    return await toggle({ sessionToken, roomId });
  };
}

export function useLeaveRoom() {
  const leave = useMutation(api.rooms.leave);
  const { sessionToken } = useAuth();
  return async (roomId: Id<"rooms">) => {
    if (!sessionToken) return;
    return await leave({ sessionToken, roomId });
  };
}

export function useForfeitMatch() {
  const forfeit = useMutation(api.match.forfeit);
  const { sessionToken } = useAuth();
  return async (roomId: Id<"rooms">) => {
    if (!sessionToken) return;
    return await forfeit({ sessionToken, roomId });
  };
}

export function useChangeGame() {
  const change = useMutation(api.rooms.changeGame);
  const { sessionToken } = useAuth();
  return async (roomId: Id<"rooms">, gameId: GameId) => {
    if (!sessionToken) throw new Error("No session yet");
    return await change({ sessionToken, roomId, gameId });
  };
}
