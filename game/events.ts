import type { GameScoreState } from "./scoring";

export type PlayerResult = {
  name: string;
  score: number;
};

export type GameOverResult = {
  seconds: number;
  totalScore: number;
  players: PlayerResult[];
};

export type GameCallbacks = {
  onTick: (seconds: number) => void;
  onScoreChange: (score: GameScoreState) => void;
  onGameOver: (result: GameOverResult) => void;
};
