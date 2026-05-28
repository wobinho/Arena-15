"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-store";
import { useLeaveRoom } from "@/lib/room-store";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// ─── Constants (mirror server) ────────────────────────────────────────────────

const PREGAME_DURATION_MS = 5_000;
const GAME_DURATION_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type ZoneSegment = { color: "green" | "red"; durationMs: number };

type SpotlightData = {
  zones: ZoneSegment[];
  scores: Record<string, number>;
  winnerUserId?: Id<"users">;
  ratingDeltas?: Record<string, number>;
};

type RoomView = {
  _id: Id<"rooms">;
  code: string;
  gameId: string;
  status: string;
  players: Array<{
    _id: Id<"roomPlayers">;
    userId: Id<"users">;
    handle: string;
    avatar: string;
    isHost: boolean;
    ready: boolean;
    seatIndex: number;
    score: number;
    streak: number;
  }>;
};

type TapEffect = { id: number; x: number; y: number };

// ─── Zone helper (client-side, mirrors server) ────────────────────────────────

function getZoneAtMs(
  zones: ZoneSegment[],
  elapsedMs: number,
): "green" | "red" | "ended" {
  let cumulative = 0;
  for (const zone of zones) {
    cumulative += zone.durationMs;
    if (elapsedMs < cumulative) return zone.color;
  }
  return "ended";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SpotlightGame({
  room,
  matchState,
  userId,
}: {
  room: RoomView;
  matchState: Doc<"matchState"> | null;
  userId: Id<"users">;
}) {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const submitAction = useMutation(api.match.submitAction);
  const rematch = useMutation(api.match.rematch);
  const leaveRoom = useLeaveRoom();

  const me = room.players.find((p) => p.userId === userId);
  const opp = room.players.find((p) => p.userId !== userId);

  // Live clock (50 ms for smooth transitions + countdown)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);

  const phase = (matchState?.phase ?? "waiting") as
    | "waiting"
    | "pregame"
    | "playing"
    | "match-over";
  const phaseStartedAt = matchState?.phaseStartedAt ?? now;
  const data = (matchState?.data as SpotlightData | undefined) ?? null;

  const elapsed = now - phaseStartedAt;

  // Pregame countdown (5 → 1)
  const pregameTimeLeft = Math.max(0, PREGAME_DURATION_MS - elapsed);
  const pregameSecsLeft = Math.ceil(pregameTimeLeft / 1000);

  const timeLeft = Math.max(0, GAME_DURATION_MS - elapsed);
  const secsLeft = Math.ceil(timeLeft / 1000);
  const timerDanger = secsLeft <= 5 && secsLeft > 0;

  const zones = data?.zones ?? [];
  const currentZone =
    phase === "playing" ? getZoneAtMs(zones, elapsed) : "ended";

  // Scores — server-authoritative
  const myScore = data?.scores?.[userId as string] ?? 0;
  const oppScore = opp ? (data?.scores?.[opp.userId as string] ?? 0) : 0;

  // Tap ripple effects
  const [tapEffects, setTapEffects] = useState<TapEffect[]>([]);
  const nextTapId = useRef(0);

  function addTapEffect(x: number, y: number) {
    const id = nextTapId.current++;
    setTapEffects((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setTapEffects((prev) => prev.filter((t) => t.id !== id));
    }, 500);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleTap = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>) => {
      if (phase !== "playing" || elapsed >= GAME_DURATION_MS || !sessionToken)
        return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      addTapEffect(x, y);

      try {
        await submitAction({
          sessionToken,
          roomId: room._id,
          action: { type: "tap" },
        });
      } catch {
        // Fire-and-forget; visual feedback is already shown
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, elapsed, sessionToken, room._id],
  );

  async function onRematch() {
    if (!sessionToken) return;
    try {
      await rematch({ sessionToken, roomId: room._id });
    } catch (e) {
      console.warn("rematch failed", e);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 py-3 sm:py-8 relative overflow-y-auto">
      <div className="relative w-full max-w-xl flex flex-col gap-2 sm:gap-3">

        {/* Score strip */}
        <div className="grid grid-cols-2 gap-3">
          <ScoreCard
            who="You"
            handle={`@${me?.handle ?? "you"}`}
            score={myScore}
            highlight="text-lime"
          />
          <ScoreCard
            who="Opp"
            handle={`@${opp?.handle ?? "opponent"}`}
            score={oppScore}
            highlight="text-blue"
          />
        </div>

        {/* Timer bar — only visible during the playing phase */}
        {phase === "playing" && (
          <div className="h-2 bg-ink-700 border-2 border-black rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-none",
                timerDanger ? "bg-coral" : "bg-lime",
              )}
              style={{ width: `${(timeLeft / GAME_DURATION_MS) * 100}%` }}
            />
          </div>
        )}
        {/* Placeholder bar keeps height consistent during pregame/waiting */}
        {phase !== "playing" && phase !== "match-over" && (
          <div className="h-2 bg-ink-700 border-2 border-black rounded-full overflow-hidden" />
        )}

        {/* Main arena */}
        <div className="relative rounded-chunk border-[3px] border-black overflow-hidden shadow-pop-lg">
          {phase === "waiting" && <WaitingStage />}

          {phase === "pregame" && (
            <PregameStage secsLeft={pregameSecsLeft} />
          )}

          {phase === "playing" && (
            <PlayingStage
              currentZone={currentZone}
              secsLeft={secsLeft}
              timerDanger={timerDanger}
              myScore={myScore}
              tapEffects={tapEffects}
              elapsed={elapsed}
              onTap={handleTap}
            />
          )}

          {phase === "match-over" && me && (
            <MatchOverStage
              youWin={data?.winnerUserId === userId}
              isDraw={data?.winnerUserId === undefined}
              myScore={myScore}
              oppScore={oppScore}
              myHandle={me.handle}
              oppHandle={opp?.handle ?? "Opponent"}
              ratingDelta={data?.ratingDeltas?.[userId as string]}
              onReset={onRematch}
              onLobby={() => router.push(`/play/room/${room.code}`)}
              onMenu={async () => {
                try {
                  await leaveRoom(room._id);
                } catch {
                  /* best effort */
                }
                router.push("/play");
              }}
            />
          )}
        </div>

        {/* Round label */}
        {(phase === "pregame" || phase === "playing") && (
          <div className="text-center text-[10px] font-bold uppercase tracking-widest text-bone-200/50">
            30-second match · highest score wins
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pregame countdown stage ──────────────────────────────────────────────────

function PregameStage({ secsLeft }: { secsLeft: number }) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[clamp(220px,38vh,400px)] bg-ink-900 select-none">
      <div className="absolute inset-0 bg-dots opacity-25 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bone-200/50">
          Get ready
        </div>
        <div
          className={cn(
            "font-display leading-none tabular-nums transition-all duration-200",
            secsLeft <= 1 ? "text-lime text-9xl sm:text-[10rem]" : "text-bone-50 text-8xl sm:text-9xl",
          )}
        >
          {secsLeft > 0 ? secsLeft : "GO!"}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bone-200/40">
          match starts soon
        </div>
      </div>
    </div>
  );
}

// ─── Waiting stage ────────────────────────────────────────────────────────────

function WaitingStage() {
  return (
    <div className="flex items-center justify-center py-24 bg-ink-900">
      <div className="text-bone-200/60 text-sm font-bold uppercase tracking-widest animate-pulse">
        Syncing match…
      </div>
    </div>
  );
}

// ─── Playing stage ────────────────────────────────────────────────────────────

function PlayingStage({
  currentZone,
  secsLeft,
  timerDanger,
  myScore,
  tapEffects,
  elapsed,
  onTap,
}: {
  currentZone: "green" | "red" | "ended";
  secsLeft: number;
  timerDanger: boolean;
  myScore: number;
  tapEffects: TapEffect[];
  elapsed: number;
  onTap: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const isGreen = currentZone === "green";
  const isEnded = currentZone === "ended" || elapsed >= GAME_DURATION_MS;

  return (
    <div
      onPointerDown={onTap}
      style={{ touchAction: "none", userSelect: "none" }}
      className={cn(
        "relative flex flex-col items-center justify-center min-h-[clamp(220px,38vh,400px)] cursor-pointer transition-colors duration-200 select-none",
        isEnded
          ? "bg-ink-800"
          : isGreen
          ? "bg-lime"
          : "bg-[#D9281E]", // vivid red for clear signal
      )}
    >
      {/* Dot-grid overlay for texture */}
      <div
        className={cn(
          "absolute inset-0 bg-dots pointer-events-none",
          isGreen ? "opacity-20" : "opacity-15",
        )}
      />

      {/* Tap ripple effects */}
      {tapEffects.map((t) => (
        <span
          key={t.id}
          className="absolute pointer-events-none animate-ping rounded-full bg-white/40"
          style={{
            left: t.x - 22,
            top: t.y - 22,
            width: 44,
            height: 44,
          }}
        />
      ))}

      {/* Zone label */}
      {!isEnded && (
        <div className="relative z-10 flex flex-col items-center gap-2 pointer-events-none">
          <span
            className={cn(
              "font-display text-6xl sm:text-8xl leading-none tracking-tight select-none",
              isGreen ? "text-black" : "text-white",
            )}
          >
            {isGreen ? "TAP!" : "STOP!"}
          </span>
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-[0.3em] select-none",
              isGreen ? "text-black/60" : "text-white/60",
            )}
          >
            {isGreen ? "every tap = +1" : "tapping = −1"}
          </span>
        </div>
      )}

      {isEnded && (
        <div className="relative z-10 text-bone-200/60 text-sm font-bold uppercase tracking-widest animate-pulse pointer-events-none">
          Time&apos;s up — waiting for result…
        </div>
      )}

      {/* Timer chip — top right */}
      <div
        className={cn(
          "absolute top-3 right-3 z-20 pointer-events-none flex flex-col items-center justify-center w-14 h-14 rounded-chunk border-[3px] border-black font-display text-2xl",
          timerDanger
            ? "bg-black text-coral animate-pulse"
            : isGreen
            ? "bg-black/30 text-white"
            : "bg-white/20 text-white",
        )}
      >
        {secsLeft}
        <div className="text-[8px] font-bold uppercase tracking-widest opacity-70 -mt-1">
          sec
        </div>
      </div>

      {/* My live score chip — top left */}
      <div
        className={cn(
          "absolute top-3 left-3 z-20 pointer-events-none px-3 py-1.5 rounded-chunk border-[3px] border-black font-display text-xl",
          isGreen ? "bg-black/30 text-white" : "bg-white/20 text-white",
        )}
      >
        {myScore >= 0 ? "+" : ""}
        {myScore}
      </div>
    </div>
  );
}

// ─── Match over stage ─────────────────────────────────────────────────────────

function MatchOverStage({
  youWin,
  isDraw,
  myScore,
  oppScore,
  myHandle,
  oppHandle,
  ratingDelta,
  onReset,
  onLobby,
  onMenu,
}: {
  youWin: boolean;
  isDraw: boolean;
  myScore: number;
  oppScore: number;
  myHandle: string;
  oppHandle: string;
  ratingDelta?: number;
  onReset: () => void;
  onLobby: () => void;
  onMenu: () => void;
}) {
  const deltaSign = ratingDelta !== undefined && ratingDelta >= 0 ? "+" : "";

  return (
    <div className="relative bg-ink-900 px-6 py-10 flex flex-col items-center justify-center text-center gap-4">
      <div className="absolute inset-0 bg-dots opacity-30 pointer-events-none" />

      {/* Outcome banner */}
      <div
        className={cn(
          "relative px-6 py-3 rounded-chunk border-[3px] border-black font-display text-2xl sm:text-3xl shadow-pop-lg",
          isDraw
            ? "bg-ink-700 text-bone-50"
            : youWin
            ? "bg-lime text-black"
            : "bg-[#D9281E] text-white",
        )}
      >
        {isDraw ? "It's a draw!" : youWin ? "You win! 🎉" : "Opponent wins"}
      </div>

      {/* Final score cards */}
      <div className="relative grid grid-cols-2 gap-3 w-full max-w-sm">
        <FinalScoreCard
          label="You"
          handle={`@${myHandle}`}
          score={myScore}
          winner={youWin}
          winnerBg="bg-lime"
          winnerText="text-black"
        />
        <FinalScoreCard
          label="Opp"
          handle={`@${oppHandle}`}
          score={oppScore}
          winner={!youWin && !isDraw}
          winnerBg="bg-[#D9281E]"
          winnerText="text-white"
        />
      </div>

      {/* Rating delta */}
      {ratingDelta !== undefined && (
        <div
          className={cn(
            "relative font-display text-2xl tabular-nums",
            ratingDelta >= 0 ? "text-lemon" : "text-coral",
          )}
        >
          {deltaSign}
          {ratingDelta.toFixed(3)}
          <span className="text-xs font-bold uppercase tracking-widest ml-1 text-bone-200/60">
            rating
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="relative flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 mt-2 w-full px-2">
        <Button onClick={onReset} size="md" className="w-full sm:w-auto">
          Rematch
        </Button>
        <Button onClick={onLobby} size="md" variant="ghost" className="w-full sm:w-auto">
          Back to room
        </Button>
        <Button onClick={onMenu} size="md" variant="ghost" className="w-full sm:w-auto">
          Main menu
        </Button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreCard({
  who,
  handle,
  score,
  highlight,
}: {
  who: string;
  handle: string;
  score: number;
  highlight: string;
}) {
  return (
    <div className="border-[3px] border-black rounded-chunk bg-ink-800 p-2 sm:p-3 text-left">
      <div className="flex items-baseline justify-between gap-1">
        <div className="label-cap">{who}</div>
        <div className="text-[9px] sm:text-[10px] font-bold text-bone-200/50 truncate">
          {handle}
        </div>
      </div>
      <div className={cn("font-display text-2xl sm:text-3xl mt-0.5 tabular-nums", highlight)}>
        {score >= 0 ? "+" : ""}
        {score}
        <span className="text-xs font-bold ml-1 text-bone-200/40">pts</span>
      </div>
    </div>
  );
}

function FinalScoreCard({
  label,
  handle,
  score,
  winner,
  winnerBg,
  winnerText,
}: {
  label: string;
  handle: string;
  score: number;
  winner: boolean;
  winnerBg: string;
  winnerText: string;
}) {
  return (
    <div
      className={cn(
        "rounded-chunk border-[3px] border-black p-4 text-center transition-all",
        winner
          ? cn(winnerBg, winnerText, "-translate-y-[2px] shadow-pop")
          : "bg-ink-800 text-bone-50",
      )}
    >
      <div
        className={cn(
          "text-[10px] font-bold uppercase tracking-widest mb-1",
          winner ? "opacity-70" : "text-bone-200/60",
        )}
      >
        {label} {winner && "· WIN"}
      </div>
      <div className="font-display text-5xl tabular-nums">
        {score >= 0 ? "+" : ""}
        {score}
      </div>
      <div
        className={cn(
          "text-[10px] font-bold mt-1 truncate",
          winner ? "opacity-60" : "text-bone-200/50",
        )}
      >
        {handle}
      </div>
    </div>
  );
}
