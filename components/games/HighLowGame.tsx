"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ACCENT_CLASSES } from "@/lib/games";
import { useAuth } from "@/lib/auth-store";
import { useLeaveRoom } from "@/lib/room-store";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@/convex/_generated/dataModel";

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

type GuessEntry = {
  userId: Id<"users">;
  guess: number;
  hint: "higher" | "lower" | "correct";
};

type HighLowData = {
  secretNumbers: Record<string, number>;
  currentTurnUserId?: Id<"users">;
  guesses: GuessEntry[];
  winnerUserId?: Id<"users">;
  ratingDeltas?: Record<string, number>;
};

export function HighLowGame({
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
  const accent = ACCENT_CLASSES.magenta;

  const me = room.players.find((p) => p.userId === userId);
  const opp = room.players.find((p) => p.userId !== userId);

  const phase = matchState?.phase ?? "setup";
  const data = (matchState?.data as HighLowData | undefined) ?? {
    secretNumbers: {},
    guesses: [],
  };

  const [numberInput, setNumberInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inputError, setInputError] = useState("");

  const mySecretSet = data.secretNumbers[userId as string] !== undefined;
  const isMyTurn = data.currentTurnUserId === userId;

  function validateNumber(raw: string): number | null {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 1 || n > 100) return null;
    return n;
  }

  async function onSetNumber() {
    const num = validateNumber(numberInput);
    if (num === null) {
      setInputError("Enter a number between 1 and 100");
      return;
    }
    if (!sessionToken || submitting) return;
    setInputError("");
    setSubmitting(true);
    try {
      await submitAction({
        sessionToken,
        roomId: room._id,
        action: { type: "set-number", number: num },
      });
    } catch (e) {
      console.warn("set-number failed", e);
    } finally {
      setSubmitting(false);
    }
  }

  async function onGuess() {
    const num = validateNumber(guessInput);
    if (num === null) {
      setInputError("Enter a number between 1 and 100");
      return;
    }
    if (!sessionToken || submitting || !isMyTurn) return;
    setInputError("");
    setSubmitting(true);
    try {
      await submitAction({
        sessionToken,
        roomId: room._id,
        action: { type: "guess", number: num },
      });
      setGuessInput("");
    } catch (e) {
      console.warn("guess failed", e);
    } finally {
      setSubmitting(false);
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

  return (
    <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 py-4 sm:py-8 relative overflow-y-auto">
      <div className="relative w-full max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-widest text-bone-200/60">
          <span className={accent.text}>High-Low</span>
          <span className="opacity-50">·</span>
          <span>@{me?.handle ?? "you"} vs @{opp?.handle ?? "opponent"}</span>
        </div>

        <div className="relative rounded-chunk border-[3px] border-black bg-ink-900 shadow-pop-lg overflow-hidden min-h-[300px]">
          <div className="absolute inset-0 bg-dots opacity-40" />
          <div className={cn("absolute inset-0 opacity-10", accent.bg)} />

          {phase === "setup" && (
            <SetupStage
              mySecretSet={mySecretSet}
              numberInput={numberInput}
              onNumberChange={(v) => { setNumberInput(v); setInputError(""); }}
              onSetNumber={onSetNumber}
              onKeyDown={(e) => { if (e.key === "Enter") onSetNumber(); }}
              submitting={submitting}
              inputError={inputError}
              accent={accent}
            />
          )}

          {phase === "playing" && (
            <PlayingStage
              data={data}
              userId={userId}
              me={me}
              opp={opp}
              isMyTurn={isMyTurn}
              guessInput={guessInput}
              onGuessChange={(v) => { setGuessInput(v); setInputError(""); }}
              onGuessKeyDown={(e) => { if (e.key === "Enter") onGuess(); }}
              onGuess={onGuess}
              submitting={submitting}
              inputError={inputError}
              accent={accent}
            />
          )}

          {phase === "match-over" && me && (
            <MatchOverStage
              data={data}
              userId={userId}
              me={me}
              opp={opp}
              ratingDelta={data.ratingDeltas?.[userId as string]}
              accent={accent}
              onRematch={onRematch}
              onMenu={async () => {
                try { await leaveRoom(room._id); } catch { /* best effort */ }
                router.push("/play");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SetupStage({
  mySecretSet,
  numberInput,
  onNumberChange,
  onSetNumber,
  onKeyDown,
  submitting,
  inputError,
  accent,
}: {
  mySecretSet: boolean;
  numberInput: string;
  onNumberChange: (v: string) => void;
  onSetNumber: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  submitting: boolean;
  inputError: string;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
}) {
  return (
    <div className="relative flex flex-col items-center justify-center text-center px-6 gap-4 py-10 min-h-[300px]">
      <div className="label-cap">Pick your secret number</div>
      <div className={cn("font-display text-5xl sm:text-6xl", accent.text)}>1 – 100</div>
      {!mySecretSet ? (
        <>
          <div className="w-full max-w-[200px]">
            <Input
              type="number"
              min={1}
              max={100}
              placeholder="e.g. 42"
              value={numberInput}
              onChange={(e) => onNumberChange(e.target.value)}
              onKeyDown={onKeyDown}
              error={inputError}
              disabled={submitting}
            />
          </div>
          <Button onClick={onSetNumber} disabled={submitting} size="md">
            Lock it in
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className={cn("px-4 py-2 rounded-chunk border-[3px] border-black font-display text-xl", accent.bg, "text-black")}>
            Locked in
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-bone-200/60 animate-pulse">
            Waiting for opponent…
          </div>
        </div>
      )}
    </div>
  );
}

function PlayingStage({
  data,
  userId,
  me,
  opp,
  isMyTurn,
  guessInput,
  onGuessChange,
  onGuessKeyDown,
  onGuess,
  submitting,
  inputError,
  accent,
}: {
  data: HighLowData;
  userId: Id<"users">;
  me: RoomView["players"][number] | undefined;
  opp: RoomView["players"][number] | undefined;
  isMyTurn: boolean;
  guessInput: string;
  onGuessChange: (v: string) => void;
  onGuessKeyDown: (e: React.KeyboardEvent) => void;
  onGuess: () => void;
  submitting: boolean;
  inputError: string;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
}) {
  const lastGuess = data.guesses.length > 0 ? data.guesses[data.guesses.length - 1] : null;

  return (
    <div className="relative flex flex-col px-4 py-4 min-h-[300px]">
      {/* Turn indicator */}
      <div className={cn(
        "text-center text-[11px] font-bold uppercase tracking-widest mb-3",
        isMyTurn ? accent.text : "text-bone-200/60",
      )}>
        {isMyTurn ? "Your turn — guess their number" : `${opp?.handle ?? "Opponent"}'s turn`}
      </div>

      {/* Last hint */}
      {lastGuess && (
        <div className="flex justify-center mb-3">
          <HintBadge hint={lastGuess.hint} guess={lastGuess.guess} isMe={lastGuess.userId === userId} accent={accent} />
        </div>
      )}

      {/* Guess input */}
      {isMyTurn && (
        <div className="flex gap-2 justify-center mb-3">
          <div className="w-[130px]">
            <Input
              type="number"
              min={1}
              max={100}
              placeholder="1 – 100"
              value={guessInput}
              onChange={(e) => onGuessChange(e.target.value)}
              onKeyDown={onGuessKeyDown}
              error={inputError}
              disabled={submitting}
            />
          </div>
          <Button onClick={onGuess} disabled={submitting} size="md" className="self-start mt-0">
            Guess
          </Button>
        </div>
      )}

      {!isMyTurn && !lastGuess && (
        <div className="text-center text-bone-200/50 text-sm font-bold animate-pulse mb-3">
          Waiting for first guess…
        </div>
      )}

      {/* Guess history */}
      <div className="flex-1 overflow-y-auto space-y-1.5 px-1">
        {[...data.guesses].reverse().map((g, i) => {
          const isMe = g.userId === userId;
          return (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-chunk border-2 border-black text-[11px] font-bold",
                g.hint === "correct"
                  ? cn(accent.bg, "text-black")
                  : isMe
                    ? "bg-ink-700 text-bone-50"
                    : "bg-ink-800 text-bone-200/70",
              )}
            >
              <span>{isMe ? `@${me?.handle ?? "you"}` : `@${opp?.handle ?? "opp"}`}</span>
              <span className="font-display text-base">{g.guess}</span>
              <HintChip hint={g.hint} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HintBadge({
  hint,
  guess,
  isMe,
  accent,
}: {
  hint: GuessEntry["hint"];
  guess: number;
  isMe: boolean;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
}) {
  if (hint === "correct") {
    return (
      <div className={cn("px-4 py-2 rounded-chunk border-[3px] border-black font-display text-2xl", accent.bg, "text-black")}>
        Correct!
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-chunk border-[3px] border-black bg-ink-800">
      <span className="text-bone-200/60 text-[11px] font-bold uppercase tracking-widest">
        {isMe ? "Your" : "Their"} guess {guess}
      </span>
      <span className={cn("font-display text-2xl", hint === "higher" ? "text-lemon" : "text-coral")}>
        {hint === "higher" ? "↑ Higher" : "↓ Lower"}
      </span>
    </div>
  );
}

function HintChip({ hint }: { hint: GuessEntry["hint"] }) {
  if (hint === "correct") return <span className="uppercase tracking-widest">Correct!</span>;
  return (
    <span className={hint === "higher" ? "text-lemon" : "text-coral"}>
      {hint === "higher" ? "↑ Higher" : "↓ Lower"}
    </span>
  );
}

function MatchOverStage({
  data,
  userId,
  me,
  opp,
  ratingDelta,
  accent,
  onRematch,
  onMenu,
}: {
  data: HighLowData;
  userId: Id<"users">;
  me: RoomView["players"][number];
  opp: RoomView["players"][number] | undefined;
  ratingDelta?: number;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES];
  onRematch: () => void;
  onMenu: () => void;
}) {
  const iWon = data.winnerUserId === userId;
  const myNumber = data.secretNumbers[userId as string];
  const oppNumber = opp ? data.secretNumbers[opp.userId as string] : undefined;
  const oppHandle = opp?.handle ?? "Opponent";
  const totalGuesses = data.guesses.length;
  const deltaSign = ratingDelta !== undefined && ratingDelta >= 0 ? "+" : "";

  return (
    <div className="relative flex flex-col items-center justify-center text-center px-6 gap-3 py-8">
      <div
        className={cn(
          "px-6 py-3 rounded-chunk border-[3px] border-black font-display text-xl sm:text-3xl shadow-pop-lg",
          iWon ? cn(accent.bg, "text-black") : "bg-magenta text-black",
        )}
      >
        {iWon ? "You cracked it!" : "They cracked it!"}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-2">
        <div className="rounded-chunk border-[3px] border-black bg-ink-800 p-3 text-left">
          <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/60">Your number</div>
          <div className={cn("font-display text-4xl mt-1", accent.text)}>{myNumber ?? "?"}</div>
          <div className="text-[10px] text-bone-200/50 mt-1">@{me.handle}</div>
        </div>
        <div className="rounded-chunk border-[3px] border-black bg-ink-800 p-3 text-left">
          <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/60">Their number</div>
          <div className="font-display text-4xl mt-1 text-bone-50">{oppNumber ?? "?"}</div>
          <div className="text-[10px] text-bone-200/50 mt-1">@{oppHandle}</div>
        </div>
      </div>

      <div className="text-[10px] font-bold uppercase tracking-widest text-bone-200/50">
        {totalGuesses} guess{totalGuesses !== 1 ? "es" : ""} total
      </div>

      {ratingDelta !== undefined && (
        <div className={cn(
          "font-display text-2xl tabular-nums",
          ratingDelta >= 0 ? "text-lemon" : "text-coral",
        )}>
          {deltaSign}{ratingDelta.toFixed(3)}
          <span className="text-xs font-bold uppercase tracking-widest ml-1 text-bone-200/60">rating</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 w-full px-2">
        <Button onClick={onRematch} size="md" className="w-full sm:w-auto">Rematch</Button>
        <Button onClick={onMenu} size="md" variant="ghost" className="w-full sm:w-auto">Main menu</Button>
      </div>
    </div>
  );
}
