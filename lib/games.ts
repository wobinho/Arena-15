export type GameId = "timeout" | "high-low";

export type Game = {
  id: GameId;
  name: string;
  tagline: string;
  description: string;
  duration: string;
  players: string;
  difficulty: "Chill" | "Spicy" | "Hectic";
  accent: "lemon" | "magenta" | "cyan" | "lime" | "coral" | "blue";
  icon: string;
  status: "live" | "beta" | "coming-soon";
  rules: string[];
};

export const GAMES: Game[] = [
  {
    id: "timeout",
    name: "Timeout",
    tagline: "Closest to the call wins.",
    description:
      "A blind timing duel. Stop the hidden clock as close to the target second as you can. Streaks compound — get sharp.",
    duration: "~2 min",
    players: "1 v 1",
    difficulty: "Spicy",
    accent: "blue",
    icon: "timeout-mark",
    status: "live",
    rules: [
      "Both players see a target time in seconds, then the clock hides.",
      "Stop the hidden clock as close to the target as you can.",
      "Closest player wins the round.",
      "First to 3,000 points takes the match.",
    ],
  },
  {
    id: "high-low",
    name: "High-Low",
    tagline: "Crack your opponent's number.",
    description:
      "Both players pick a secret number 1–100. A coin flip decides who guesses first. Each turn you get higher or lower — first to crack the code wins.",
    duration: "~3 min",
    players: "1 v 1",
    difficulty: "Chill",
    accent: "magenta",
    icon: "highlow-mark",
    status: "live",
    rules: [
      "Each player secretly picks a number between 1 and 100.",
      "A coin flip decides who guesses first.",
      "On your turn, guess your opponent's number — you'll be told higher or lower.",
      "Players alternate turns. First to guess the correct number wins.",
    ],
  },
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

export const ACCENT_CLASSES: Record<
  Game["accent"],
  {
    bg: string;
    bgSoft: string;
    text: string;
    border: string;
    ring: string;
    fill: string;
    shadow: string;
  }
> = {
  lemon: {
    bg: "bg-lemon",
    bgSoft: "bg-lemon/15",
    text: "text-lemon",
    border: "border-lemon",
    ring: "ring-lemon",
    fill: "fill-lemon",
    shadow: "shadow-[6px_6px_0_0_#E2C400]",
  },
  magenta: {
    bg: "bg-magenta",
    bgSoft: "bg-magenta/15",
    text: "text-magenta",
    border: "border-magenta",
    ring: "ring-magenta",
    fill: "fill-magenta",
    shadow: "shadow-[6px_6px_0_0_#D31E69]",
  },
  cyan: {
    bg: "bg-cyan",
    bgSoft: "bg-cyan/15",
    text: "text-cyan",
    border: "border-cyan",
    ring: "ring-cyan",
    fill: "fill-cyan",
    shadow: "shadow-[6px_6px_0_0_#19BCD0]",
  },
  lime: {
    bg: "bg-lime",
    bgSoft: "bg-lime/15",
    text: "text-lime",
    border: "border-lime",
    ring: "ring-lime",
    fill: "fill-lime",
    shadow: "shadow-[6px_6px_0_0_#8FD315]",
  },
  coral: {
    bg: "bg-coral",
    bgSoft: "bg-coral/15",
    text: "text-coral",
    border: "border-coral",
    ring: "ring-coral",
    fill: "fill-coral",
    shadow: "shadow-[6px_6px_0_0_#D9651D]",
  },
  blue: {
    bg: "bg-blue",
    bgSoft: "bg-blue/15",
    text: "text-blue",
    border: "border-blue",
    ring: "ring-blue",
    fill: "fill-blue",
    shadow: "shadow-[6px_6px_0_0_#1E5FE2]",
  },
};
