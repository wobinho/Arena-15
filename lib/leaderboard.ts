export type LeaderRow = {
  rank: number;
  handle: string;
  avatar: string;
  rating: number;
  matchesPlayed: number;
  tier: "Rookie" | "Pro" | "Elite" | "Legend";
};

export function getRatingTier(rating: number): LeaderRow["tier"] {
  if (rating >= 2.0) return "Legend";
  if (rating >= 1.5) return "Elite";
  if (rating >= 1.25) return "Pro";
  return "Rookie";
}

export const TIER_STYLES: Record<LeaderRow["tier"], { color: string; bg: string; mark: string }> = {
  Legend: { color: "text-lemon", bg: "bg-lemon/15 border-lemon/60", mark: "lgnd" },
  Elite: { color: "text-magenta", bg: "bg-magenta/15 border-magenta/60", mark: "elite" },
  Pro: { color: "text-cyan", bg: "bg-cyan/15 border-cyan/60", mark: "pro" },
  Rookie: { color: "text-bone-100", bg: "bg-ink-700 border-ink-500", mark: "rook" },
};
