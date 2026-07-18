export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_SETTINGS: Record<
  Difficulty,
  { defenderCount: number; speedMultiplier: number }
> = {
  easy: { defenderCount: 1, speedMultiplier: 1 },
  medium: { defenderCount: 2, speedMultiplier: 1.2 },
  hard: { defenderCount: 4, speedMultiplier: 1.4 },
};
