import type { GameScoreState } from "./scoring";

export type GameCallbacks = {
  onTick: (seconds: number) => void;
  onScoreChange: (score: GameScoreState) => void;
  onGameOver: (seconds: number, score: number) => void;
};
