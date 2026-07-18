export type Difficulty = "easy" | "medium" | "hard";

type DifficultySettings = {
  defenderCount: number;
  speedMultiplier: number;
  forcedPassChance: number;
  forcedPassCooldownMs: number;
  forcedPassDefenderCount: number;
};

export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: {
    defenderCount: 1,
    speedMultiplier: 1,
    forcedPassChance: 0.1,
    forcedPassCooldownMs: 7000,
    forcedPassDefenderCount: 3,
  },
  medium: {
    defenderCount: 2,
    speedMultiplier: 1.2,
    forcedPassChance: 0.2,
    forcedPassCooldownMs: 5500,
    forcedPassDefenderCount: 4,
  },
  hard: {
    defenderCount: 4,
    speedMultiplier: 1.4,
    forcedPassChance: 0.3,
    forcedPassCooldownMs: 4000,
    forcedPassDefenderCount: 5,
  },
};
