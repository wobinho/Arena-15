"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuth, useSignOut } from "@/lib/auth-store";
import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/ui/Placeholder";
import { GAMES, ACCENT_CLASSES } from "@/lib/games";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { getRatingTier, TIER_STYLES } from "@/lib/leaderboard";

export default function ProfilePage() {
  const router = useRouter();
  const { user, hydrated, sessionToken } = useAuth();
  const signOut = useSignOut();

  const gameStats = useQuery(
    api.users.getMyGameStats,
    hydrated && user ? { sessionToken: sessionToken ?? null } : "skip",
  );

  useEffect(() => {
    if (hydrated && !user) router.replace("/login?next=/profile");
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-bone-200/60">Loading profile…</div>
      </div>
    );
  }

  const rating = user.rating ?? 1.0;
  const tier = getRatingTier(rating);
  const tierStyle = TIER_STYLES[tier];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
      <section className="relative border-[3px] border-black rounded-chunk bg-ink-800 shadow-pop-lg overflow-hidden">
        <div className="absolute inset-0 bg-dots opacity-30" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-magenta border-[3px] border-black rounded-full shadow-pop-lg hidden sm:block" />
        <div className="absolute -bottom-10 right-32 w-28 h-28 bg-cyan border-[3px] border-black rounded-chunk shadow-pop rotate-12 hidden sm:block" />

        <div className="relative p-6 sm:p-10 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-chunk border-[3px] border-black bg-lemon shadow-pop-lg flex items-center justify-center">
            <Placeholder label={user.avatar} size="2xl" tone="light" />
          </div>
          <div>
            <div className="label-cap">Player</div>
            <h1 className="font-display text-4xl sm:text-5xl text-bone-50">@{user.handle}</h1>
            <div className="mt-2 text-bone-200/60 font-semibold">{user.isGuest ? "Guest profile" : user.email}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip bg-lemon text-black border-black">{user.xp} XP</span>
              <span className="chip bg-cyan text-black border-black">{user.wins ?? 0} wins</span>
              {!user.isGuest && (
                <span className={cn("chip border-2", tierStyle.bg, tierStyle.color)}>
                  {rating.toFixed(3)} · {tier}
                </span>
              )}
              {user.isGuest && <span className="chip bg-ink-900 text-bone-50">Guest</span>}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <section className="border-[3px] border-black rounded-chunk bg-ink-900 p-6 shadow-pop-lg">
          <div className="label-cap mb-2">Per-game stats</div>
          <h2 className="font-display text-2xl text-bone-50">By game</h2>
          <div className="mt-4 space-y-3">
            {GAMES.map((g) => {
              const a = ACCENT_CLASSES[g.accent];
              const stats = gameStats?.perGame[g.id];
              const w = stats?.wins ?? 0;
              const l = stats?.losses ?? 0;
              const wr = w + l > 0 ? Math.round((w / (w + l)) * 100) : 0;
              const loading = gameStats === undefined;
              return (
                <div key={g.id} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_120px_140px] gap-3 sm:gap-4 items-center p-4 rounded-chunk border-2 border-black bg-ink-800">
                  <div className={`w-12 h-12 rounded-chunk border-2 border-black ${a.bg} flex items-center justify-center`}>
                    <Placeholder label={g.icon} size="sm" tone="light" />
                  </div>
                  <div>
                    <div className="font-display text-lg text-bone-50">{g.name}</div>
                    <div className="text-xs text-bone-200/60 font-semibold sm:hidden">
                      {loading ? "Loading…" : `${w}W · ${l}L · ${wr}% WR`}
                    </div>
                  </div>
                  <div className="hidden sm:block text-sm font-bold text-bone-200/70 tabular-nums">
                    {loading ? "—" : `${w}W / ${l}L`}
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="flex-1 h-2 bg-ink-700 rounded-full overflow-hidden">
                      <div className={`h-full ${a.bg} transition-all duration-500`} style={{ width: `${wr}%` }} />
                    </div>
                    <span className="text-xs font-bold text-bone-50 tabular-nums w-10 text-right">
                      {loading ? "—" : `${wr}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-[3px] border-black rounded-chunk bg-ink-900 p-6 shadow-pop-lg">
          <div className="label-cap mb-2">Account</div>
          <h2 className="font-display text-2xl text-bone-50">Settings</h2>
          <div className="mt-4 space-y-3">
            <Link href="/play" className="block">
              <Button variant="cyan" full>Play a match</Button>
            </Link>
            <Button variant="ghost" full onClick={() => alert("Settings coming soon.")}>
              Edit profile
            </Button>
            <Button variant="danger" full onClick={() => { signOut(); router.push("/"); }}>
              Sign out
            </Button>
          </div>
          {user.isGuest && (
            <p className="mt-4 text-xs text-bone-200/40 font-semibold">
              Playing as a guest. <Link href="/signup" className="text-lemon hover:underline">Sign up</Link> to keep your stats across devices.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
