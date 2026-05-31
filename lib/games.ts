export type GameId = "timeout" | "high-low" | "number-trap" | "safecracker" | "spotlight" | "minefield" | "mimic";

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
  {
    id: "number-trap",
    name: "Number Trap",
    tagline: "Go high — but don't bust.",
    description:
      "Each round, both players secretly pick a number 1–20. Higher wins… unless the sum exceeds 20. Then the lower number wins. Watch the trap.",
    duration: "~2 min",
    players: "1 v 1",
    difficulty: "Spicy",
    accent: "coral",
    icon: "numbertrap-mark",
    status: "live",
    rules: [
      "Each round, both players have 15 seconds to pick a number from 1 to 20.",
      "The player with the higher number wins the round.",
      "But if the sum of both numbers exceeds 20, the lower number wins instead.",
      "A sum of exactly 20 is safe — higher still wins.",
      "First player to win 3 rounds takes the match.",
    ],
  },
  {
    id: "spotlight",
    name: "Spotlight",
    tagline: "Tap the green. Dodge the red.",
    description:
      "A 30-second tapping frenzy. When the zone flashes green, tap as fast as you can — each hit scores a point. Hit red and you lose one. Highest score when the clock runs out wins.",
    duration: "~30 sec",
    players: "1 v 1",
    difficulty: "Hectic",
    accent: "lime",
    icon: "spotlight-mark",
    status: "live",
    rules: [
      "The zone alternates between green and red every few seconds.",
      "Tap the zone when it's green to earn +1 point per tap.",
      "Tapping the zone when it's red costs you −1 point.",
      "The game lasts exactly 30 seconds.",
      "The player with the highest score when time runs out wins.",
    ],
  },
  {
    id: "minefield",
    name: "Minefield",
    tagline: "One wrong step and you're gone.",
    description:
      "A shared 5×5 grid hides 3 bombs. A coin flip decides who goes first. Take turns opening boxes — hit a bomb and you lose the round. First to 3 wins takes the match.",
    duration: "~3 min",
    players: "1 v 1",
    difficulty: "Spicy",
    accent: "cyan",
    icon: "minefield-mark",
    status: "live",
    rules: [
      "A 5×5 grid of 25 boxes is shared between both players — 3 hide bombs, 22 are safe.",
      "A coin flip decides who opens first.",
      "Players alternate turns opening one box at a time.",
      "Opening a safe box reveals it for both players. Opening a bomb loses you the round.",
      "First player to win 3 rounds takes the match.",
    ],
  },
  {
    id: "mimic",
    name: "Mimic",
    tagline: "Watch, remember, repeat.",
    description:
      "A turn-based memory duel. The game flashes a pattern on a 3×4 grid — then each player must repeat it from memory. Both right? The pattern grows. One wrong? They lose.",
    duration: "~3 min",
    players: "1 v 1",
    difficulty: "Spicy",
    accent: "cyan",
    icon: "mimic-mark",
    status: "live",
    rules: [
      "A coin flip decides who goes first.",
      "The pattern is shown only to the active player — watch it carefully!",
      "Click the tiles in the exact order shown to complete your turn.",
      "If you fail and your opponent succeeds, you lose.",
      "If both players fail the same pattern, you restart that level.",
      "Both succeed? The pattern grows by one step.",
    ],
  },
  {
    id: "safecracker",
    name: "Safecracker",
    tagline: "Crack the code. Lock your secret.",
    description:
      "Both players lock in a secret 4-digit code. A coin flip decides who guesses first. Reveal each digit position one by one — first to crack your opponent's vault wins.",
    duration: "~5 min",
    players: "1 v 1",
    difficulty: "Spicy",
    accent: "lemon",
    icon: "safecracker-mark",
    status: "live",
    rules: [
      "Each player secretly sets a 4-digit code (digits 0–9).",
      "A coin flip decides who guesses first.",
      "On your turn, submit a 4-digit guess — each correct digit in the right position locks in.",
      "Players alternate turns. First to crack all 4 digits of the opponent's code wins.",
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
