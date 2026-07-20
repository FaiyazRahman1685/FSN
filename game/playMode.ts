export type PlayMode = "single" | "multiplayer";
export type MultiplayerKind = "local" | "online";

export type PlayerNames = {
  player1: string;
  player2: string;
};

export type SessionSettings = {
  difficulty: import("./difficulty").Difficulty;
  playMode: PlayMode;
  multiplayerKind: MultiplayerKind;
  playerNames: PlayerNames;
};

export function isLocalMultiplayer(settings: SessionSettings): boolean {
  return settings.playMode === "multiplayer" && settings.multiplayerKind === "local";
}
