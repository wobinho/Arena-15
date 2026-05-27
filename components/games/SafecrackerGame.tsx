"use client";

import { useRef, useState, useEffect, KeyboardEvent } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { ACCENT_CLASSES } from "@/lib/games";
import { useAuth } from "@/lib/auth-store";
import { useLeaveRoom } from "@/lib/room-store";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type DigitFeedback = "correct" | "wrong";

type GuessEntry = {
  userId: Id<"users">;
  guess: string;
  feedback: DigitFeedback[];
};

type SafecrackerData = {
  /** Boolean flags only — the actual codes are never in this object during play. */
  codesSet: Record<string, boolean>;
  currentTurnUserId?: Id<"users">;
  guesses: GuessEntry[];
  winnerUserId?: Id<"users">;
  /** Populated only when phase === "match-over" — safe to display then. */
  revealedCodes?: Record<string, string>;
  ratingDeltas?: Record<string, number>;
};

// ─── Main component ───────────────────────────────────────────────────────────

export function SafecrackerGame({
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
  const accent = ACCENT_CLASSES.lemon;

  const me = room.players.find((p) => p.userId === userId);
  const opp = room.players.find((p) => p.userId !== userId);

  const phase = (matchState?.phase ?? "setup") as
    | "setup"
    | "playing"
    | "match-over";
  const data = (matchState?.data as SafecrackerData | undefined) ?? {
    codesSet: {},
    guesses: [],
  };

  const myCodeSet = data.codesSet[userId as string] === true;
  const oppCodeSet = opp ? data.codesSet[opp.userId as string] === true : false;
  const isMyTurn = data.currentTurnUserId === userId;

  // Split guesses by attacker
  const myGuesses = data.guesses.filter((g) => g.userId === userId);
  const oppGuesses = data.guesses.filter((g) => g.userId !== userId);

  // ─── Actions ─────────────────────────────────────────────────────────────

  async function onSetCode(code: string) {
    if (!sessionToken) return;
    try {
      await submitAction({
        sessionToken,
        roomId: room._id,
        action: { type: "set-code", code },
      });
    } catch (e) {
      console.warn("set-code failed", e);
    }
  }

  async function onGuess(code: string) {
    if (!sessionToken) return;
    try {
      await submitAction({
        sessionToken,
        roomId: room._id,
        action: { type: "guess", code },
      });
    } catch (e) {
      console.warn("guess failed", e);
    }
  }

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
      <div className="relative w-full max-w-2xl">

        {/* Header: player handles */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <PlayerCard
            label="You"
            handle={`@${me?.handle ?? "you"}`}
            codeSet={myCodeSet}
            accentText={accent.text}
            isYou
          />
          <PlayerCard
            label="Opp"
            handle={`@${opp?.handle ?? "opponent"}`}
            codeSet={oppCodeSet}
            accentText="text-blue"
            isYou={false}
          />
        </div>

        {/* Main arena */}
        <div className="relative rounded-chunk border-[3px] border-black bg-ink-900 shadow-pop-lg overflow-hidden">
          <div className="absolute inset-0 bg-dots opacity-30" />
          <div className={cn("absolute inset-0 opacity-10", accent.bg)} />

          {/* ── Setup phase ─────────────────────────────────────────────── */}
          {phase === "setup" && (
            <SetupStage
              myCodeSet={myCodeSet}
              oppCodeSet={oppCodeSet}
              accent={accent}
              onSetCode={onSetCode}
            />
          )}

          {/* ── Playing phase ────────────────────────────────────────────── */}
          {phase === "playing" && (
            <PlayingStage
              userId={userId}
              oppUserId={opp?.userId}
              myHandle={me?.handle ?? "you"}
              oppHandle={opp?.handle ?? "opponent"}
              isMyTurn={isMyTurn}
              myGuesses={myGuesses}
              oppGuesses={oppGuesses}
              accent={accent}
              onGuess={onGuess}
            />
          )}

          {/* ── Match over ───────────────────────────────────────────────── */}
          {phase === "match-over" && (
            <MatchOverStage
              youWin={data.winnerUserId === userId}
              myHandle={me?.handle ?? "you"}
              oppHandle={opp?.handle ?? "opponent"}
              myGuesses={myGuesses}
              oppGuesses={oppGuesses}
              revealedCodes={data.revealedCodes ?? {}}
              userId={userId}
              oppUserId={opp?.userId}
              ratingDelta={data.ratingDeltas?.[userId as string]}
              accent={accent}
              onRematch={onRematch}
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
      </div>
    </div>
  );
}

// ─── Setup stage ─────────────────────────────────────────────────────────────

function SetupStage({
  myCodeSet,
  oppCodeSet,
  accent,
  onSetCode,
}: {
  myCodeSet: boolean;
  oppCodeSet: boolean;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onSetCode: (code: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(code: string) {
    setSubmitting(true);
    await onSetCode(code);
    setSubmitting(false);
  }

  return (
    <div className="relative px-3 sm:px-5 pt-4 sm:pt-6 pb-4 sm:pb-7">
      <div className="mb-5 text-center">
        <div className="label-cap mb-1">Set your secret code</div>
        <div className={cn("font-display text-3xl", accent.text)}>
          Pick 4 digits
        </div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-bone-200/50 mt-1">
          Your opponent won&apos;t see it until the match ends
        </div>
      </div>

      {/* Status chips */}
      <div className="flex gap-2 justify-center mb-5">
        <span
          className={cn(
            "chip border-black text-xs font-bold",
            myCodeSet
              ? cn(accent.bg, "text-black")
              : "bg-ink-700 text-bone-200/60",
          )}
        >
          You {myCodeSet ? "· locked 🔒" : "· choosing…"}
        </span>
        <span
          className={cn(
            "chip border-black text-xs font-bold",
            oppCodeSet
              ? "bg-blue text-black"
              : "bg-ink-700 text-bone-200/60",
          )}
        >
          Opp {oppCodeSet ? "· locked 🔒" : "· choosing…"}
        </span>
      </div>

      {!myCodeSet ? (
        <CodeInput
          label="Enter your 4-digit secret code"
          submitLabel="Lock it in"
          disabled={submitting}
          accent={accent}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="text-center text-[11px] font-bold uppercase tracking-widest text-bone-200/60 animate-pulse py-4">
          {oppCodeSet
            ? "Both locked — starting…"
            : "Code locked! Waiting for opponent…"}
        </div>
      )}
    </div>
  );
}

// ─── Playing stage ────────────────────────────────────────────────────────────

function PlayingStage({
  userId,
  oppUserId,
  myHandle,
  oppHandle,
  isMyTurn,
  myGuesses,
  oppGuesses,
  accent,
  onGuess,
}: {
  userId: Id<"users">;
  oppUserId?: Id<"users">;
  myHandle: string;
  oppHandle: string;
  isMyTurn: boolean;
  myGuesses: GuessEntry[];
  oppGuesses: GuessEntry[];
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onGuess: (code: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleGuess(code: string) {
    setSubmitting(true);
    await onGuess(code);
    setSubmitting(false);
  }

  // Compute locked digits from my guesses (positions correctly identified)
  const lockedPositions: (string | null)[] = [null, null, null, null];
  for (const g of myGuesses) {
    g.feedback.forEach((f, i) => {
      if (f === "correct") lockedPositions[i] = g.guess[i];
    });
  }

  return (
    <div className="relative px-3 sm:px-5 pt-4 sm:pt-5 pb-4 sm:pb-6">
      {/* Turn banner */}
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-chunk border-[3px] border-black px-4 py-2 mb-5 font-display text-lg",
          isMyTurn
            ? cn(accent.bg, "text-black shadow-pop")
            : "bg-blue text-black",
        )}
      >
        {isMyTurn ? "Your turn to guess" : `${oppHandle}'s turn`}
      </div>

      {/* Locked indicator */}
      <div className="flex gap-2 justify-center mb-5">
        <span className="label-cap text-bone-200/50">Locked:</span>
        {lockedPositions.map((d, i) => (
          <span
            key={i}
            className={cn(
              "w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-chunk border-[2px] border-black font-display text-base sm:text-lg",
              d !== null
                ? cn(accent.bg, "text-black shadow-pop-sm")
                : "bg-ink-800 text-bone-200/30",
            )}
          >
            {d !== null ? d : "·"}
          </span>
        ))}
      </div>

      {/* Two-column guess history */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-5">
        <GuessHistory
          label={`@${myHandle} (you)`}
          guesses={myGuesses}
          accent={accent}
          accentBg={accent.bg}
          accentText={accent.text}
        />
        <GuessHistory
          label={`@${oppHandle}`}
          guesses={oppGuesses}
          accent={accent}
          accentBg="bg-blue"
          accentText="text-blue"
        />
      </div>

      {/* Input */}
      {isMyTurn ? (
        <CodeInput
          label="Enter your 4-digit guess"
          submitLabel="Crack it"
          disabled={submitting}
          accent={accent}
          lockedPositions={lockedPositions}
          onSubmit={handleGuess}
        />
      ) : (
        <div className="text-center text-[11px] font-bold uppercase tracking-widest text-bone-200/50 animate-pulse py-2">
          Waiting for {oppHandle} to guess…
        </div>
      )}
    </div>
  );
}

// ─── Guess history ────────────────────────────────────────────────────────────

function GuessHistory({
  label,
  guesses,
  accentBg,
  accentText,
}: {
  label: string;
  guesses: GuessEntry[];
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  accentBg: string;
  accentText: string;
}) {
  return (
    <div>
      <div
        className={cn(
          "label-cap mb-2 truncate",
          accentText,
        )}
      >
        {label}
      </div>
      {guesses.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/30 py-2">
          No guesses yet
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {guesses.map((g, idx) => (
            <GuessTile
              key={idx}
              attempt={idx + 1}
              guess={g.guess}
              feedback={g.feedback}
              accentBg={accentBg}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GuessTile({
  attempt,
  guess,
  feedback,
  accentBg,
}: {
  attempt: number;
  guess: string;
  feedback: DigitFeedback[];
  accentBg: string;
}) {
  const correctCount = feedback.filter((f) => f === "correct").length;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold text-bone-200/30 w-4 text-right shrink-0">
        {attempt}
      </span>
      {Array.from({ length: 4 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded border-[2px] border-black font-display text-xs sm:text-sm transition-all",
            feedback[i] === "correct"
              ? cn(accentBg, "text-black shadow-pop-sm")
              : "bg-ink-800 text-bone-200/50",
          )}
        >
          {guess[i]}
        </span>
      ))}
      <span className="text-[9px] font-bold uppercase tracking-widest text-bone-200/40 ml-0.5">
        {correctCount}/4
      </span>
    </div>
  );
}

// ─── Match over ───────────────────────────────────────────────────────────────

function MatchOverStage({
  youWin,
  myHandle,
  oppHandle,
  myGuesses,
  oppGuesses,
  revealedCodes,
  userId,
  oppUserId,
  ratingDelta,
  accent,
  onRematch,
  onLobby,
  onMenu,
}: {
  youWin: boolean;
  myHandle: string;
  oppHandle: string;
  myGuesses: GuessEntry[];
  oppGuesses: GuessEntry[];
  revealedCodes: Record<string, string>;
  userId: Id<"users">;
  oppUserId?: Id<"users">;
  ratingDelta?: number;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onRematch: () => void;
  onLobby: () => void;
  onMenu: () => void;
}) {
  const deltaSign = ratingDelta !== undefined && ratingDelta >= 0 ? "+" : "";
  const myCode = revealedCodes[userId as string];
  const oppCode = oppUserId ? revealedCodes[oppUserId as string] : undefined;

  return (
    <div className="relative px-3 sm:px-6 py-5 sm:py-8 flex flex-col items-center text-center gap-3 sm:gap-5">
      {/* Result banner */}
      <div
        className={cn(
          "px-6 py-3 rounded-chunk border-[3px] border-black font-display text-2xl sm:text-3xl shadow-pop-lg",
          youWin ? cn(accent.bg, "text-black") : "bg-blue text-black",
        )}
      >
        {youWin ? "Vault cracked! You win!" : "Opponent cracked your vault!"}
      </div>

      {/* Rating delta */}
      {ratingDelta !== undefined && (
        <div
          className={cn(
            "font-display text-2xl tabular-nums",
            ratingDelta >= 0 ? "text-lemon" : "text-coral",
          )}
        >
          {deltaSign}{ratingDelta.toFixed(3)}
          <span className="text-xs font-bold uppercase tracking-widest ml-1 text-bone-200/60">
            rating
          </span>
        </div>
      )}

      {/* Code reveal */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        <CodeReveal
          label={`Your code`}
          handle={`@${myHandle}`}
          code={myCode}
          accentBg={accent.bg}
        />
        <CodeReveal
          label="Their code"
          handle={`@${oppHandle}`}
          code={oppCode}
          accentBg="bg-blue"
        />
      </div>

      {/* Final guess histories */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full text-left">
        <GuessHistory
          label={`@${myHandle} (you)`}
          guesses={myGuesses}
          accent={accent}
          accentBg={accent.bg}
          accentText={accent.text}
        />
        <GuessHistory
          label={`@${oppHandle}`}
          guesses={oppGuesses}
          accent={accent}
          accentBg="bg-blue"
          accentText="text-blue"
        />
      </div>

      {/* Guess counts */}
      <div className="text-[11px] font-bold uppercase tracking-widest text-bone-200/50">
        {myGuesses.length} guess{myGuesses.length !== 1 ? "es" : ""} by you ·{" "}
        {oppGuesses.length} guess{oppGuesses.length !== 1 ? "es" : ""} by opp
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 w-full">
        <Button onClick={onRematch} size="md" className="w-full sm:w-auto">
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

function CodeReveal({
  label,
  handle,
  code,
  accentBg,
}: {
  label: string;
  handle: string;
  code?: string;
  accentBg: string;
}) {
  return (
    <div className="rounded-chunk border-[3px] border-black bg-ink-800 p-3 text-center">
      <div className="label-cap text-bone-200/50 mb-2">{label}</div>
      <div className="flex gap-1 justify-center mb-1">
        {Array.from({ length: 4 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-chunk border-[2px] border-black font-display text-lg",
              code ? cn(accentBg, "text-black") : "bg-ink-700 text-bone-200/30",
            )}
          >
            {code ? code[i] : "?"}
          </span>
        ))}
      </div>
      <div className="text-[10px] font-bold text-bone-200/40 truncate">{handle}</div>
    </div>
  );
}

// ─── Shared: PlayerCard ───────────────────────────────────────────────────────

function PlayerCard({
  label,
  handle,
  codeSet,
  accentText,
  isYou,
}: {
  label: string;
  handle: string;
  codeSet: boolean;
  accentText: string;
  isYou: boolean;
}) {
  return (
    <div className="border-[3px] border-black rounded-chunk bg-ink-800 p-3 text-left">
      <div className="flex items-baseline justify-between gap-2">
        <div className="label-cap">{label}</div>
        <div className="text-[10px] font-bold text-bone-200/50 truncate">{handle}</div>
      </div>
      <div
        className={cn(
          "text-[10px] font-bold uppercase tracking-widest mt-1",
          codeSet ? accentText : "text-bone-200/30",
        )}
      >
        {codeSet ? "🔒 Code locked" : "Choosing code…"}
      </div>
    </div>
  );
}

// ─── Shared: CodeInput ────────────────────────────────────────────────────────

function CodeInput({
  label,
  submitLabel,
  disabled,
  accent,
  lockedPositions,
  onSubmit,
}: {
  label: string;
  submitLabel: string;
  disabled: boolean;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  lockedPositions?: (string | null)[];
  onSubmit: (code: string) => void;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1, ref2, ref3];

  // Pre-fill locked positions
  useEffect(() => {
    if (!lockedPositions) return;
    setDigits((prev) =>
      prev.map((d, i) => (lockedPositions[i] !== null ? lockedPositions[i]! : d)),
    );
  }, [lockedPositions]);

  function handleChange(i: number, val: string) {
    const char = val.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = char;
      return next;
    });
    if (char && i < 3) {
      refs[i + 1].current?.focus();
    }
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs[i - 1].current?.focus();
    }
    if (e.key === "Enter") {
      trySubmit();
    }
  }

  function trySubmit() {
    const code = digits.join("");
    if (code.length === 4) {
      onSubmit(code);
      setDigits(lockedPositions?.map((d) => d ?? "") ?? ["", "", "", ""]);
      refs[0].current?.focus();
    }
  }

  const isLocked = (i: number) =>
    lockedPositions ? lockedPositions[i] !== null : false;

  const isComplete = digits.every((d) => d !== "");

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="label-cap text-bone-200/50">{label}</div>
      <div className="flex gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            disabled={disabled || isLocked(i)}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={cn(
              "w-10 h-12 sm:w-12 sm:h-14 text-center font-display text-xl sm:text-2xl rounded-chunk border-[3px] border-black outline-none transition-all select-none",
              isLocked(i)
                ? cn(accent.bg, "text-black cursor-not-allowed")
                : d
                ? "bg-ink-700 text-bone-50 ring-2 ring-lemon/60"
                : "bg-ink-800 text-bone-50 focus:ring-2 focus:ring-lemon/60",
              disabled && !isLocked(i) && "opacity-50 cursor-not-allowed",
            )}
          />
        ))}
      </div>
      <Button
        onClick={trySubmit}
        disabled={!isComplete || disabled}
        size="md"
      >
        {submitLabel}
      </Button>
    </div>
  );
}
