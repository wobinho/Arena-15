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

// ─── Constants (mirror convex/games/mimic.ts) ─────────────────────────────────

const PREGAME_MS = 5_000;
const STEP_MS = 900;
const TILE_ON_MS = 600;
const SHOW_BUFFER_MS = 500;
const INPUT_BASE_MS = 6_000;
const INPUT_PER_STEP_MS = 2_000;
const TILE_FLASH_MS = 450;

function showingMs(n: number) { return n * STEP_MS + SHOW_BUFFER_MS; }
function inputMs(n: number) { return INPUT_BASE_MS + INPUT_PER_STEP_MS * n; }

// ─── Types ────────────────────────────────────────────────────────────────────

type MimicPhase =
  | "waiting"
  | "pregame"
  | "showing-p1"
  | "input-p1"
  | "showing-p2"
  | "input-p2"
  | "match-over";

type MimicData = {
  pattern: number[];
  tileColors: string[];
  firstPlayerId: string;
  p1Result?: "success" | "fail";
  currentInputs: number[];
  failedBy?: string;
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

// ─── Main component ───────────────────────────────────────────────────────────

export function MimicGame({
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

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);

  // Local tile flash: index → expiry timestamp
  const [flashTile, setFlashTile] = useState<number | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [busy, setBusy] = useState(false);

  const phase = (matchState?.phase ?? "waiting") as MimicPhase;
  const phaseStartedAt = matchState?.phaseStartedAt ?? now;
  const data = (matchState?.data as MimicData | undefined) ?? null;
  const elapsed = now - phaseStartedAt;

  const uid = userId as string;
  const isP1 = data ? uid === data.firstPlayerId : false;

  // Which phases are "my" active phases
  const isMyShowing = (phase === "showing-p1" && isP1) || (phase === "showing-p2" && !isP1);
  const isMyInput = (phase === "input-p1" && isP1) || (phase === "input-p2" && !isP1);

  // Tile to highlight during my showing phase
  const activeShowTile: number | null = (() => {
    if (!isMyShowing || !data) return null;
    const stepIndex = Math.floor(elapsed / STEP_MS);
    const isOn = (elapsed % STEP_MS) < TILE_ON_MS;
    return stepIndex < data.pattern.length && isOn ? data.pattern[stepIndex] : null;
  })();

  // Current step being shown (1-based, for display)
  const showingStep = data ? Math.min(Math.floor(elapsed / STEP_MS) + 1, data.pattern.length) : 0;

  // Pregame countdown
  const pregameSecsLeft = Math.ceil(Math.max(0, PREGAME_MS - elapsed) / 1000);

  // Input timeout countdown
  const inputDeadlineMs = data ? inputMs(data.pattern.length) : 0;
  const inputSecsLeft = Math.ceil(Math.max(0, inputDeadlineMs - elapsed) / 1000);
  const inputDanger = inputSecsLeft <= 3 && inputSecsLeft > 0;

  // ─── Tile click ─────────────────────────────────────────────────────────────

  const handleTileClick = useCallback(
    async (tileIndex: number) => {
      if (!isMyInput || busy || !sessionToken || !data) return;

      // Flash tile immediately
      setFlashTile(tileIndex);
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
      flashTimeout.current = setTimeout(() => setFlashTile(null), TILE_FLASH_MS);

      setBusy(true);
      try {
        await submitAction({
          sessionToken,
          roomId: room._id,
          action: { type: "click", tile: tileIndex },
        });
      } catch {
        // ignore — server state is authoritative
      } finally {
        setBusy(false);
      }
    },
    [isMyInput, busy, sessionToken, data, room._id, submitAction],
  );

  async function onRematch() {
    if (!sessionToken) return;
    try { await rematch({ sessionToken, roomId: room._id }); } catch { /* best effort */ }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const pattern = data?.pattern ?? [];
  const tileColors = data?.tileColors ?? Array(12).fill("#aaaaaa");
  const currentInputs = data?.currentInputs ?? [];

  return (
    <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 py-4 sm:py-8 relative overflow-y-auto">
      <div className="relative w-full max-w-sm flex flex-col gap-3">

        {/* Player header */}
        <div className="grid grid-cols-2 gap-2">
          <PlayerChip
            label="You"
            handle={`@${me?.handle ?? "you"}`}
            highlight={isMyInput ? "border-cyan bg-cyan/10" : ""}
          />
          <PlayerChip
            label="Opp"
            handle={`@${opp?.handle ?? "opponent"}`}
            highlight={!isMyInput && (phase === "input-p1" || phase === "input-p2") ? "border-cyan bg-cyan/10" : ""}
          />
        </div>

        {/* Level badge */}
        {data && phase !== "pregame" && phase !== "waiting" && phase !== "match-over" && (
          <div className="flex items-center justify-center gap-2">
            <div className="px-3 py-1 rounded-chunk border-[2px] border-black bg-ink-800 font-display text-sm text-bone-50">
              Level {pattern.length}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/50">
              {pattern.length} step pattern
            </div>
          </div>
        )}

        {/* Main arena */}
        <div className="rounded-chunk border-[3px] border-black overflow-hidden shadow-pop-lg">

          {phase === "waiting" && <WaitingStage />}

          {phase === "pregame" && <PregameStage secsLeft={pregameSecsLeft} />}

          {/* Showing phase — my turn: animate the pattern */}
          {isMyShowing && (
            <ShowingStage
              pattern={pattern}
              tileColors={tileColors}
              activeTile={activeShowTile}
              step={showingStep}
              totalSteps={pattern.length}
            />
          )}

          {/* Showing phase — opponent's turn: waiting screen */}
          {!isMyShowing && (phase === "showing-p1" || phase === "showing-p2") && (
            <WatchingStage
              label="Watching the pattern…"
              sub={
                phase === "showing-p2" && data?.p1Result === "success"
                  ? "You succeeded — can your opponent match?"
                  : phase === "showing-p2" && data?.p1Result === "fail"
                  ? "You failed — if they also fail, you restart the level"
                  : "Get ready — your turn is next!"
              }
            />
          )}

          {/* Input phase — my turn: clickable grid */}
          {isMyInput && (
            <InputStage
              tileColors={tileColors}
              flashTile={flashTile}
              progress={currentInputs.length}
              total={pattern.length}
              secsLeft={inputSecsLeft}
              danger={inputDanger}
              onTileClick={handleTileClick}
            />
          )}

          {/* Input phase — opponent's turn: watching */}
          {!isMyInput && (phase === "input-p1" || phase === "input-p2") && (
            <OpponentInputStage
              progress={currentInputs.length}
              total={pattern.length}
              secsLeft={inputSecsLeft}
              danger={inputDanger}
              myResult={data?.p1Result}
              iAmP1={isP1}
            />
          )}

          {phase === "match-over" && me && (
            <MatchOverStage
              youWin={data?.winnerUserId === userId}
              myHandle={me.handle}
              oppHandle={opp?.handle ?? "Opponent"}
              patternLength={pattern.length}
              ratingDelta={data?.ratingDeltas?.[uid]}
              onReset={onRematch}
              onLobby={() => router.push(`/play/room/${room.code}`)}
              onMenu={async () => {
                try { await leaveRoom(room._id); } catch { /* best effort */ }
                router.push("/play");
              }}
            />
          )}
        </div>

        {/* Pattern dots during showing/input phases */}
        {data && (phase.startsWith("showing") || phase.startsWith("input")) && (
          <PatternDots
            total={pattern.length}
            filled={isMyInput ? currentInputs.length : (isMyShowing ? showingStep : 0)}
            phase={phase}
            isMyPhase={isMyShowing || isMyInput}
          />
        )}
      </div>
    </div>
  );
}

// ─── Waiting ──────────────────────────────────────────────────────────────────

function WaitingStage() {
  return (
    <div className="flex items-center justify-center py-20 bg-ink-900">
      <div className="text-bone-200/60 text-sm font-bold uppercase tracking-widest animate-pulse">
        Syncing match…
      </div>
    </div>
  );
}

// ─── Pregame countdown ────────────────────────────────────────────────────────

function PregameStage({ secsLeft }: { secsLeft: number }) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[clamp(260px,42vh,420px)] bg-ink-900 select-none">
      <div className="absolute inset-0 bg-dots opacity-25 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bone-200/50">
          Get ready
        </div>
        <div
          className={cn(
            "font-display leading-none tabular-nums transition-all duration-200",
            secsLeft <= 1 ? "text-cyan text-9xl sm:text-[10rem]" : "text-bone-50 text-8xl sm:text-9xl",
          )}
        >
          {secsLeft > 0 ? secsLeft : "GO!"}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bone-200/40">
          memorise the pattern
        </div>
      </div>
    </div>
  );
}

// ─── Pattern showing (active player) ─────────────────────────────────────────

function ShowingStage({
  pattern,
  tileColors,
  activeTile,
  step,
  totalSteps,
}: {
  pattern: number[];
  tileColors: string[];
  activeTile: number | null;
  step: number;
  totalSteps: number;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-5 px-4 bg-ink-900 min-h-[clamp(260px,42vh,420px)] justify-center">
      <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bone-200/50">
        Watch the pattern — step {Math.min(step, totalSteps)} / {totalSteps}
      </div>
      <TileGrid tileColors={tileColors} activeTile={activeTile} flashTile={null} clickable={false} onTileClick={() => {}} />
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-bone-200/30">
        Remember the order — your turn is next!
      </div>
    </div>
  );
}

// ─── Watching (non-active player, showing phase) ──────────────────────────────

function WatchingStage({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[clamp(260px,42vh,420px)] bg-ink-900 select-none gap-3">
      <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-2 px-6 text-center">
        <div className="text-sm font-bold uppercase tracking-widest text-bone-200/50 animate-pulse">
          {label}
        </div>
        <div className="text-xs font-semibold text-bone-200/40 mt-1">{sub}</div>
      </div>
    </div>
  );
}

// ─── Input stage (active player) ─────────────────────────────────────────────

function InputStage({
  tileColors,
  flashTile,
  progress,
  total,
  secsLeft,
  danger,
  onTileClick,
}: {
  tileColors: string[];
  flashTile: number | null;
  progress: number;
  total: number;
  secsLeft: number;
  danger: boolean;
  onTileClick: (i: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-5 px-4 bg-ink-900 min-h-[clamp(260px,42vh,420px)] justify-center">
      <div className="flex items-center justify-between w-full max-w-[220px]">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bone-200/50">
          Your turn — tap the pattern
        </div>
        <div
          className={cn(
            "font-display text-lg tabular-nums",
            danger ? "text-coral animate-pulse" : "text-bone-200/60",
          )}
        >
          {secsLeft}s
        </div>
      </div>
      <TileGrid
        tileColors={tileColors}
        activeTile={null}
        flashTile={flashTile}
        clickable
        onTileClick={onTileClick}
      />
      <ProgressBar progress={progress} total={total} color="bg-cyan" />
    </div>
  );
}

// ─── Opponent input stage (non-active player) ─────────────────────────────────

function OpponentInputStage({
  progress,
  total,
  secsLeft,
  danger,
  myResult,
  iAmP1,
}: {
  progress: number;
  total: number;
  secsLeft: number;
  danger: boolean;
  myResult?: "success" | "fail";
  iAmP1: boolean;
}) {
  const statusLine =
    iAmP1 && myResult === "success"
      ? "You succeeded — can they match it?"
      : iAmP1 && myResult === "fail"
      ? "You failed — if they also fail, you restart"
      : !iAmP1
      ? "Opponent went first — now watch them"
      : "";

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[clamp(260px,42vh,420px)] bg-ink-900 select-none gap-4 px-6">
      <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-[220px]">
        <div className="text-sm font-bold uppercase tracking-widest text-bone-200/50 animate-pulse">
          Opponent&apos;s turn…
        </div>
        {statusLine && (
          <div className="text-xs font-semibold text-bone-200/40 text-center">{statusLine}</div>
        )}
        <ProgressBar progress={progress} total={total} color="bg-bone-200/30" />
        <div
          className={cn(
            "font-display text-3xl tabular-nums mt-1",
            danger ? "text-coral animate-pulse" : "text-bone-200/40",
          )}
        >
          {secsLeft}s
        </div>
      </div>
    </div>
  );
}

// ─── Match over ───────────────────────────────────────────────────────────────

function MatchOverStage({
  youWin,
  myHandle,
  oppHandle,
  patternLength,
  ratingDelta,
  onReset,
  onLobby,
  onMenu,
}: {
  youWin: boolean;
  myHandle: string;
  oppHandle: string;
  patternLength: number;
  ratingDelta?: number;
  onReset: () => void;
  onLobby: () => void;
  onMenu: () => void;
}) {
  const deltaSign = ratingDelta !== undefined && ratingDelta >= 0 ? "+" : "";
  return (
    <div className="relative bg-ink-900 px-6 py-10 flex flex-col items-center justify-center text-center gap-4">
      <div className="absolute inset-0 bg-dots opacity-30 pointer-events-none" />

      <div
        className={cn(
          "relative px-6 py-3 rounded-chunk border-[3px] border-black font-display text-2xl sm:text-3xl shadow-pop-lg",
          youWin ? "bg-cyan text-black" : "bg-coral text-white",
        )}
      >
        {youWin ? "You win! 🎉" : "Opponent wins"}
      </div>

      <div className="relative flex items-center justify-center gap-3 w-full max-w-xs">
        <FinalChip label="You" handle={`@${myHandle}`} winner={youWin} color={youWin ? "bg-cyan text-black" : "bg-ink-700 text-bone-50"} />
        <div className="font-display text-bone-200/30 text-lg">vs</div>
        <FinalChip label="Opp" handle={`@${oppHandle}`} winner={!youWin} color={!youWin ? "bg-coral text-white" : "bg-ink-700 text-bone-50"} />
      </div>

      <div className="relative text-[11px] font-bold uppercase tracking-widest text-bone-200/40">
        Pattern reached {patternLength} step{patternLength !== 1 ? "s" : ""}
      </div>

      {ratingDelta !== undefined && (
        <div
          className={cn(
            "relative font-display text-2xl tabular-nums",
            ratingDelta >= 0 ? "text-lemon" : "text-coral",
          )}
        >
          {deltaSign}{ratingDelta.toFixed(3)}
          <span className="text-xs font-bold uppercase tracking-widest ml-1 text-bone-200/60">
            rating
          </span>
        </div>
      )}

      <div className="relative flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 mt-2 w-full px-2">
        <Button onClick={onReset} size="md" className="w-full sm:w-auto">Rematch</Button>
        <Button onClick={onLobby} size="md" variant="ghost" className="w-full sm:w-auto">Back to room</Button>
        <Button onClick={onMenu} size="md" variant="ghost" className="w-full sm:w-auto">Main menu</Button>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function TileGrid({
  tileColors,
  activeTile,
  flashTile,
  clickable,
  onTileClick,
}: {
  tileColors: string[];
  activeTile: number | null;
  flashTile: number | null;
  clickable: boolean;
  onTileClick: (i: number) => void;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: "repeat(3, 1fr)", width: "100%", maxWidth: 228 }}
    >
      {Array.from({ length: 12 }, (_, i) => {
        const isActive = activeTile === i || flashTile === i;
        return (
          <button
            key={i}
            onClick={() => clickable && onTileClick(i)}
            disabled={!clickable}
            className={cn(
              "aspect-square rounded-chunk border-[3px] border-black transition-all duration-150 select-none",
              isActive
                ? "shadow-pop scale-[1.06]"
                : clickable
                ? "bg-bone-50 hover:bg-bone-100 active:scale-95 cursor-pointer shadow-pop-sm"
                : "bg-bone-50 cursor-default",
            )}
            style={isActive ? { backgroundColor: tileColors[i] } : {}}
          />
        );
      })}
    </div>
  );
}

function ProgressBar({ progress, total, color }: { progress: number; total: number; color: string }) {
  const pct = total > 0 ? (progress / total) * 100 : 0;
  return (
    <div className="w-full max-w-[220px]">
      <div className="flex justify-between text-[10px] font-bold text-bone-200/50 mb-1">
        <span>Progress</span>
        <span>{progress} / {total}</span>
      </div>
      <div className="h-2 bg-ink-700 border-2 border-black rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-200", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PatternDots({
  total,
  filled,
  phase,
  isMyPhase,
}: {
  total: number;
  filled: number;
  phase: string;
  isMyPhase: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full border-[1.5px] border-black transition-all duration-200",
            i < filled && isMyPhase
              ? "bg-cyan"
              : i < filled
              ? "bg-bone-200/40"
              : "bg-ink-700",
          )}
        />
      ))}
    </div>
  );
}

function PlayerChip({
  label,
  handle,
  highlight,
}: {
  label: string;
  handle: string;
  highlight: string;
}) {
  return (
    <div
      className={cn(
        "border-[3px] border-black rounded-chunk bg-ink-800 p-2 text-left transition-all",
        highlight,
      )}
    >
      <div className="label-cap">{label}</div>
      <div className="text-[10px] font-bold text-bone-200/50 truncate">{handle}</div>
    </div>
  );
}

function FinalChip({
  label,
  handle,
  winner,
  color,
}: {
  label: string;
  handle: string;
  winner: boolean;
  color: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-chunk border-[3px] border-black p-3 text-center transition-all",
        color,
        winner && "-translate-y-[2px] shadow-pop",
      )}
    >
      <div className="text-[9px] font-bold uppercase tracking-widest opacity-70">
        {label} {winner && "· WIN"}
      </div>
      <div className="font-display text-lg truncate mt-0.5">{handle}</div>
    </div>
  );
}
