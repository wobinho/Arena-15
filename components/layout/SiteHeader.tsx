"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useSignOut } from "@/lib/auth-store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/ui/Placeholder";

const NAV = [
  { href: "/", label: "Games" },
  { href: "/play", label: "Play" },
  { href: "/leaderboard/timeout", label: "Leaderboard" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // hide header on game routes so they fill the viewport
  if (pathname.startsWith("/play/room/") && pathname.endsWith("/game")) return null;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-ink-950/70 border-b-2 border-black">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <LogoMark />
          <div className="leading-none">
            <div className="font-display text-lg sm:text-xl text-bone-50 group-hover:text-lemon transition-colors">
              ARENA<span className="text-lemon">15</span>
            </div>
            <div className="hidden sm:block text-[10px] font-bold tracking-[0.2em] text-bone-200/50 uppercase">
              1v1 mini games
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "px-3 py-1.5 text-sm font-bold uppercase tracking-wider rounded-full transition-colors",
                  active
                    ? "bg-lemon text-black border-2 border-black"
                    : "text-bone-50/80 hover:text-lemon hover:bg-ink-800"
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {hydrated && user ? (
            <div className="flex items-center gap-2">
              <Link href="/profile" className="flex items-center gap-2 px-3 h-10 rounded-full border-2 border-black bg-ink-800 hover:bg-ink-700 transition-colors">
                <Placeholder label={user.avatar} size="xs" shape="circle" />
                <span className="text-sm font-bold">{user.handle}</span>
              </Link>
              <button
                onClick={() => { signOut(); router.push("/"); }}
                className="text-xs font-bold uppercase tracking-wider text-bone-200/60 hover:text-magenta px-2"
              >
                Sign out
              </button>
            </div>
          ) : hydrated ? (
            <>
              <Link href="/login" className="text-sm font-bold uppercase tracking-wider text-bone-50/80 hover:text-lemon">
                Sign in
              </Link>
              <Button size="sm" onClick={() => router.push("/signup")}>
                Get in
              </Button>
            </>
          ) : (
            <div className="h-10 w-32 bg-ink-800 rounded-full animate-pulse" />
          )}
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="md:hidden inline-flex items-center justify-center w-10 h-10 border-2 border-black rounded-full bg-ink-800"
          aria-label="Toggle menu"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <path d={open ? "M2 2L16 12M2 12L16 2" : "M1 2H17M1 7H17M1 12H17"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 border-t-2 border-black",
          open ? "max-h-[480px]" : "max-h-0"
        )}
      >
        <div className="px-4 py-4 flex flex-col gap-2 bg-ink-900">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "px-4 py-3 rounded-chunk border-2 border-black font-display uppercase text-sm",
                  active ? "bg-lemon text-black" : "bg-ink-800 text-bone-50"
                )}
              >
                {n.label}
              </Link>
            );
          })}
          <div className="h-px bg-black/40 my-2" />
          {hydrated && user ? (
            <>
              <Link href="/profile" className="px-4 py-3 rounded-chunk border-2 border-black bg-ink-800 flex items-center gap-3">
                <Placeholder label={user.avatar} size="md" shape="circle" />
                <div className="flex-1">
                  <div className="font-bold text-sm">{user.handle}</div>
                  <div className="text-xs text-bone-200/60">{user.email}</div>
                </div>
              </Link>
              <button
                onClick={() => { signOut(); router.push("/"); }}
                className="px-4 py-3 rounded-chunk border-2 border-black bg-magenta text-black font-display uppercase text-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="px-4 py-3 rounded-chunk border-2 border-black bg-ink-800 text-bone-50 font-display uppercase text-sm text-center">
                Sign in
              </Link>
              <Link href="/signup" className="px-4 py-3 rounded-chunk border-2 border-black bg-lemon text-black font-display uppercase text-sm text-center">
                Get in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <div className="relative w-10 h-10">
      <div className="absolute inset-0 bg-lemon border-[3px] border-black rounded-chunk rotate-[-6deg]" />
      <div className="absolute inset-0 flex items-center justify-center font-display text-base text-black rotate-[-6deg]">
        15
      </div>
    </div>
  );
}
