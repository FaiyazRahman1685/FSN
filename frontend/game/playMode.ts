import type { Difficulty } from "./difficulty";

export type PlayMode = "single" | "multiplayer";
export type MultiplayerKind = "local" | "online";

export type PlayerNames = {
  player1: string;
  player2: string;
};

export type OnlineSessionInfo = {
  roomCode: string;
  playerId: string;
  slot: 1 | 2;
  isHost: boolean;
  seed?: number;
  startedAt?: string;
};

export type SessionSettings = {
  difficulty: Difficulty;
  playMode: PlayMode;
  multiplayerKind: MultiplayerKind;
  playerNames: PlayerNames;
  online?: OnlineSessionInfo;
};

export function isLocalMultiplayer(settings: SessionSettings): boolean {
  return settings.playMode === "multiplayer" && settings.multiplayerKind === "local";
}

export function isOnlineMultiplayer(settings: SessionSettings): boolean {
  return settings.playMode === "multiplayer" && settings.multiplayerKind === "online";
}

export function isCoopMultiplayer(settings: SessionSettings): boolean {
  return isLocalMultiplayer(settings) || isOnlineMultiplayer(settings);
}
