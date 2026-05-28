"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Placeholder } from "@/components/ui/Placeholder";
import { GAMES, type GameId, ACCENT_CLASSES } from "@/lib/games";
import { useAuth } from "@/lib/auth-store";
import { useCreateRoom, useJoinRoom } from "@/lib/room-store";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/cn";

type Mode = "quick" | "room" | "join";

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <PlayInner />
    </Suspense>
  );
}

function PlayInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialMode = (params.get("mode") as Mode | null) ?? "quick";
  const initialCode = params.get("code") ?? "";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedGame, setSelectedGame] = useState<GameId>("timeout");
  const [joinCode, setJoinCode] = useState(initialCode.toUpperCase().slice(0, 5));
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [busy, setBusy] = useState(false);
  const { user, hydrated } = useAuth();
  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();

  const ready = hydrated && user;

  async function onCreate() {
    if (!ready) return;
    setBusy(true);
    try {
      const r = await createRoom(selectedGame, visibility);
      toast({ title: "Room created!", body: `Share code ${r.code}`, tone: "success" });
      router.push(`/play/room/${r.code}`);
    } catch (e) {
      toast({ title: "Couldn't create room", body: errorMessage(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    if (!ready) return;
    if (joinCode.trim().length < 5) {
      toast({ title: "Invalid code", body: "Room codes are 5 characters.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const r = await joinRoom(joinCode.trim());
      router.push(`/play/room/${r.code}`);
    } catch (e) {
      toast({ title: "Couldn't join room", body: errorMessage(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-14 w-full">
      <div className="label-cap mb-2">Find a match</div>
      <h1 className="font-display text-4xl sm:text-5xl text-bone-50">
        Time to <span className="text-cyan">play.</span>
      </h1>
      <p className="mt-2 text-bone-200/60 font-semibold">
        Create a room and share the code with a friend.
        {user?.isGuest && " You're playing as a guest — sign up to claim a permanent handle."}
      </p>

      <div className="mt-6 sm:mt-8 flex p-1.5 border-[3px] border-black bg-ink-900 rounded-chunk shadow-pop overflow-x-auto max-w-full w-fit">
        {([
          { id: "room", label: "Create room" },
          { id: "join", label: "Join with code" },
          { id: "quick", label: "Quick match", wip: true },
        ] as { id: Mode; label: string; wip?: boolean }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={cn(
              "px-4 sm:px-5 h-11 rounded-chunk font-display uppercase text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2",
              mode === t.id ? "bg-lemon text-black border-2 border-black shadow-pop-sm" : "text-bone-50/70 hover:text-bone-50"
            )}
          >
            {t.label}
            {t.wip && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-magenta text-black border border-black leading-none">
                WIP
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 sm:gap-6">
        <div className="border-[3px] border-black rounded-chunk bg-ink-800 p-4 sm:p-6 shadow-pop-lg">
          {(mode === "quick" || mode === "room") && (
            <>
              <div className="label-cap mb-3">Select game</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GAMES.map((g) => {
                  const a = ACCENT_CLASSES[g.accent];
                  const active = selectedGame === g.id;
                  const disabled = g.status === "coming-soon";
                  return (
                    <button
                      key={g.id}
                      onClick={() => !disabled && setSelectedGame(g.id)}
                      disabled={disabled}
                      className={cn(
                        "relative text-left p-3 sm:p-4 rounded-chunk border-[3px] border-black bg-ink-900 transition-all",
                        active ? `${a.bgSoft} shadow-pop -translate-y-[1px]` : "shadow-pop-sm hover:-translate-y-[1px]",
                        disabled && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-12 h-12 rounded-chunk border-2 border-black flex items-center justify-center", a.bg)}>
                          <Placeholder label={g.icon} size="sm" tone="light" />
                        </div>
                        <div className="flex-1">
                          <div className="font-display text-lg text-bone-50">{g.name}</div>
                          <div className="text-xs font-bold text-bone-200/60">
                            {disabled ? "Coming soon" : `${g.players} · ${g.duration}`}
                          </div>
                        </div>
                        {active && (
                          <div className="w-6 h-6 bg-lemon border-2 border-black rounded-full flex items-center justify-center">
                            <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 2" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mode === "room" && (
            <div className="mt-6">
              <div className="label-cap mb-3">Visibility</div>
              <div className="grid grid-cols-2 gap-3">
                {(["private", "public"] as const).map((v) => {
                  const guestBlocked = v === "public" && !!user?.isGuest;
                  return (
                    <button
                      key={v}
                      onClick={() => !guestBlocked && setVisibility(v)}
                      disabled={guestBlocked}
                      className={cn(
                        "p-4 rounded-chunk border-[3px] border-black bg-ink-900 text-left",
                        visibility === v ? "bg-cyan/15 shadow-pop -translate-y-[1px]" : "shadow-pop-sm",
                        guestBlocked && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div className="font-display text-base text-bone-50 capitalize">{v}</div>
                      <div className="text-xs text-bone-200/60 font-semibold mt-1">
                        {v === "private"
                          ? "Only people with the code can join."
                          : guestBlocked
                          ? "Sign up to create public rooms."
                          : "Discoverable later via matchmaking."}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "join" && (
            <div>
              <div className="label-cap mb-3">Got a room code?</div>
              <Input
                label="Room code"
                placeholder="X4F2K"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
                className="uppercase tracking-[0.4em] font-mono text-lg"
              />
              <p className="mt-2 text-xs text-bone-200/50">5 characters. Share these with your friend.</p>
            </div>
          )}
        </div>

        <div className="border-[3px] border-black rounded-chunk bg-ink-900 p-4 sm:p-6 shadow-pop-lg flex flex-col">
          {mode === "quick" && (
            <>
              <div className="label-cap">Status</div>
              <div className="mt-3 flex-1 flex flex-col items-center justify-center text-center min-h-[180px] sm:min-h-[260px]">
                <div className="mb-4 animate-float">
                  <Placeholder label="quick-match" size="2xl" />
                </div>
                <div className="font-display text-2xl text-bone-50">Quick match coming soon</div>
                <p className="mt-2 text-sm text-bone-200/60 font-semibold max-w-xs">
                  Matchmaking isn't wired up yet. For now, create a room and share the code with a friend.
                </p>
                <Button onClick={() => setMode("room")} size="lg" className="mt-6">
                  Create a room instead
                </Button>
              </div>
            </>
          )}

          {mode === "room" && (
            <>
              <div className="label-cap">Ready?</div>
              <div className="mt-3 flex-1 flex flex-col items-center justify-center text-center min-h-[180px] sm:min-h-[260px]">
                <div className="mb-4">
                  <Placeholder label="room" size="2xl" />
                </div>
                <div className="font-display text-2xl text-bone-50">Spin up a room</div>
                <p className="mt-2 text-sm text-bone-200/60 font-semibold max-w-xs">
                  You'll get a 5-character code. Share it with your friend to start the match.
                </p>
                <Button onClick={onCreate} size="lg" variant="cyan" className="mt-6" disabled={!ready} loading={busy}>
                  Create room
                </Button>
              </div>
            </>
          )}

          {mode === "join" && (
            <>
              <div className="label-cap">Ready to join</div>
              <div className="mt-3 flex-1 flex flex-col items-center justify-center text-center min-h-[180px] sm:min-h-[260px]">
                <div className="mb-4">
                  <Placeholder label="join" size="2xl" />
                </div>
                <div className="font-display text-2xl text-bone-50">Punch in the code</div>
                <p className="mt-2 text-sm text-bone-200/60 font-semibold max-w-xs">
                  Enter the 5-character code your friend gave you to hop into their lobby.
                </p>
                <Button onClick={onJoin} size="lg" variant="magenta" className="mt-6" disabled={!ready || joinCode.length < 5} loading={busy}>
                  Join lobby
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    const m = e.message.match(/Uncaught Error: (.+)$/);
    if (m) return m[1];
    return e.message;
  }
  return "Something went wrong";
}
