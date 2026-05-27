"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, usePlayAsGuest } from "@/lib/auth-store";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const buttonStyles = "inline-flex items-center justify-center gap-2 font-display uppercase tracking-wide border-[3px] border-black rounded-chunk shadow-pop transition-all duration-150 ease-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-pop-lg active:translate-x-[3px] active:translate-y-[3px] active:shadow-pop-sm disabled:opacity-60 disabled:cursor-not-allowed w-full h-9 px-3 text-sm";

export function AuthGateModal() {
  const { hydrated, user, sessionToken } = useAuth();
  const playAsGuest = usePlayAsGuest();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Only show when hydrated and no session at all
  if (!hydrated || sessionToken || user || dismissed) return null;

  async function handleGuest() {
    setLoading(true);
    try {
      await playAsGuest();
    } finally {
      setLoading(false);
    }
  }

  function handleLogin() {
    setDismissed(true);
    router.push("/login");
  }

  function handleSignup() {
    setDismissed(true);
    router.push("/signup");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg border-[3px] border-black rounded-chunk bg-ink-800 shadow-pop-lg overflow-hidden animate-wobble-in">
        {/* Decorative blobs */}
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-magenta border-[3px] border-black rounded-full shadow-pop-lg opacity-80 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-cyan border-[3px] border-black rounded-chunk shadow-pop-lg opacity-70 pointer-events-none rotate-12" />

        <div className="relative p-6 sm:p-8">
          {/* Brand */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-lemon border-[3px] border-black rounded-chunk flex items-center justify-center shadow-pop">
              <span className="font-display text-lg text-black">15</span>
            </div>
            <span className="font-display text-xl text-bone-50 uppercase tracking-wider">Arena 15</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl text-bone-50 leading-[0.95]">
            How do you<br />
            <span className="inline-block px-2 -rotate-1 bg-lemon text-black border-[3px] border-black rounded-chunk shadow-pop-lg">
              want to play?
            </span>
          </h2>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Login / Sign up */}
            <div className="border-[3px] border-black rounded-chunk bg-ink-900 p-4 flex flex-col gap-3 shadow-pop">
              <div className="inline-block px-2 py-0.5 border-2 border-black bg-lemon text-black text-[10px] font-bold uppercase tracking-widest rounded-full w-fit">
                Account
              </div>
              <div className="font-display text-lg text-bone-50">Login or sign up</div>
              <ul className="text-xs font-semibold text-bone-200/70 space-y-1">
                <li className="flex items-center gap-1.5"><span className="text-lime">✓</span> Elo rating &amp; leaderboards</li>
                <li className="flex items-center gap-1.5"><span className="text-lime">✓</span> Stats tracked forever</li>
                <li className="flex items-center gap-1.5"><span className="text-lime">✓</span> Public &amp; private rooms</li>
              </ul>
              <div className="flex flex-col gap-2 mt-auto pt-1">
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className={cn(buttonStyles, "bg-lemon text-black hover:bg-lemon-dark")}
                >
                  Log in
                </button>
                <button
                  onClick={handleSignup}
                  disabled={loading}
                  className={cn(buttonStyles, "bg-ink-800 text-bone-50 hover:bg-ink-700")}
                >
                  Create account
                </button>
              </div>
            </div>

            {/* Play as guest */}
            <div className="border-[3px] border-black rounded-chunk bg-ink-900 p-4 flex flex-col gap-3 shadow-pop">
              <div className="inline-block px-2 py-0.5 border-2 border-black bg-cyan text-black text-[10px] font-bold uppercase tracking-widest rounded-full w-fit">
                Guest
              </div>
              <div className="font-display text-lg text-bone-50">Play as guest</div>
              <ul className="text-xs font-semibold text-bone-200/70 space-y-1">
                <li className="flex items-center gap-1.5"><span className="text-lime">✓</span> No signup required</li>
                <li className="flex items-center gap-1.5"><span className="text-bone-200/40">✗</span> Private rooms only</li>
                <li className="flex items-center gap-1.5"><span className="text-bone-200/40">✗</span> No elo or leaderboards</li>
              </ul>
              <div className="mt-auto pt-1">
                <Button
                  size="sm"
                  variant="cyan"
                  className="w-full"
                  onClick={handleGuest}
                  loading={loading}
                >
                  Continue as guest
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
