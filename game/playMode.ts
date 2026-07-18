export type PlayMode = "single" | "multiplayer";
export type MultiplayerKind = "local" | "online";

export type SessionSettings = {
  difficulty: import("./difficulty").Difficulty;
  playMode: PlayMode;
  multiplayerKind: MultiplayerKind;
};

export function isLocalMultiplayer(settings: SessionSettings): boolean {
  return settings.playMode === "multiplayer" && settings.multiplayerKind === "local";
}
