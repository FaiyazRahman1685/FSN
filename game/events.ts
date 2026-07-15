export type GameCallbacks = {
  onTick: (seconds: number) => void;
  onGameOver: (seconds: number) => void;
};
