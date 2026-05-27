"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type User = {
  id: Id<"users">;
  handle: string;
  avatar: string;
  email?: string;
  isGuest: boolean;
  xp: number;
  matchesPlayed: number;
  wins: number;
  rating: number;
};

type AuthState = {
  sessionToken: string | null;
  user: User | null;
  hydrated: boolean;
  setSession: (token: string | null) => void;
  setUser: (user: User | null) => void;
  _setHydrated: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      sessionToken: null,
      user: null,
      hydrated: false,
      setSession: (token) => set({ sessionToken: token }),
      setUser: (user) => set({ user }),
      _setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "arena15:session",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sessionToken: s.sessionToken }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);

/**
 * Mounted once at the top of the tree. Keeps `useAuth().user` in sync with the server.
 */
export function AuthBootstrap() {
  const { sessionToken, hydrated, setSession, setUser } = useAuth();
  const me = useQuery(
    api.users.me,
    hydrated ? { sessionToken: sessionToken ?? null } : "skip",
  );

  // If we have a token but no matching user (e.g. dev DB was wiped), drop the token.
  useEffect(() => {
    if (!hydrated) return;
    if (me === undefined) return; // still loading
    if (sessionToken && me === null) {
      setSession(null);
      setUser(null);
      return;
    }
    if (me) {
      setUser({
        id: me._id,
        handle: me.handle,
        avatar: me.avatar,
        email: me.email,
        isGuest: me.isGuest,
        xp: me.xp,
        matchesPlayed: me.matchesPlayed,
        wins: me.wins,
        rating: me.rating,
      });
    }
  }, [hydrated, sessionToken, me, setSession, setUser]);

  return null;
}

export function usePlayAsGuest() {
  const createGuest = useMutation(api.users.createGuest);
  const { setSession, setUser } = useAuth();
  return async (preferredHandle?: string) => {
    const res = await createGuest({ preferredHandle });
    setSession(res.sessionToken);
    setUser({
      id: res.user._id,
      handle: res.user.handle,
      avatar: res.user.avatar,
      email: res.user.email,
      isGuest: res.user.isGuest,
      xp: res.user.xp,
      matchesPlayed: res.user.matchesPlayed,
      wins: res.user.wins,
      rating: res.user.rating,
    });
  };
}

export function useSignUp() {
  const signUp = useMutation(api.users.signUp);
  const { sessionToken, setSession, setUser } = useAuth();
  return async (handle: string, email: string, password: string) => {
    try {
      const res = await signUp({ sessionToken: sessionToken ?? null, handle, email, password });
      setSession(res.sessionToken);
      setUser({
        id: res.user._id,
        handle: res.user.handle,
        avatar: res.user.avatar,
        email: res.user.email,
        isGuest: res.user.isGuest,
        xp: res.user.xp,
        matchesPlayed: res.user.matchesPlayed,
        wins: res.user.wins,
        rating: res.user.rating,
      });
      return { ok: true as const };
    } catch (e: unknown) {
      return { ok: false as const, error: errorMessage(e) };
    }
  };
}

export function useSignIn() {
  const signIn = useMutation(api.users.signIn);
  const { setSession, setUser } = useAuth();
  return async (email: string, password: string) => {
    try {
      const res = await signIn({ email, password });
      setSession(res.sessionToken);
      setUser({
        id: res.user._id,
        handle: res.user.handle,
        avatar: res.user.avatar,
        email: res.user.email,
        isGuest: res.user.isGuest,
        xp: res.user.xp,
        matchesPlayed: res.user.matchesPlayed,
        wins: res.user.wins,
        rating: res.user.rating,
      });
      return { ok: true as const };
    } catch (e: unknown) {
      return { ok: false as const, error: errorMessage(e) };
    }
  };
}

export function useSignOut() {
  const signOutMutation = useMutation(api.users.signOut);
  const { sessionToken, setSession, setUser } = useAuth();
  return async () => {
    if (sessionToken) {
      try {
        await signOutMutation({ sessionToken });
      } catch {
        // best-effort
      }
    }
    setSession(null);
    setUser(null);
  };
}

export function useUpdateHandle() {
  const updateHandle = useMutation(api.users.updateHandle);
  const { sessionToken, setUser } = useAuth();
  return async (handle: string) => {
    if (!sessionToken) return { ok: false as const, error: "Not signed in" };
    try {
      const u = await updateHandle({ sessionToken, handle });
      setUser({
        id: u._id,
        handle: u.handle,
        avatar: u.avatar,
        email: u.email,
        isGuest: u.isGuest,
        xp: u.xp,
        matchesPlayed: u.matchesPlayed,
        wins: u.wins,
        rating: u.rating,
      });
      return { ok: true as const };
    } catch (e: unknown) {
      return { ok: false as const, error: errorMessage(e) };
    }
  };
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    // Convex wraps function errors with "[CONVEX ...] message". Strip the prefix for display.
    const m = e.message.match(/Uncaught Error: (.+)$/);
    if (m) return m[1];
    return e.message;
  }
  return "Something went wrong";
}
