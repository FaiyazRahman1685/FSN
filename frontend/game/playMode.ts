import type { Difficulty } from "./difficulty";

export type PlayMode = "single" | "multiplayer";
export type MultiplayerKind = "local" | "online";
export type DefenderNationality = "argentina" | "brazil";

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
  defenderNationality: DefenderNationality;
  online?: OnlineSessionInfo;
};

/** Same 6×5 / 24×24 grid; row differs per sheet. */
export const DEFENDER_SHEETS: Record<
  DefenderNationality,
  { path: string; row: number; label: string }
> = {
  argentina: {
    path: "/sprites/ops.png",
    row: 1,
    label: "Argentina",
  },
  brazil: {
    path: "/sprites/brazil.png",
    row: 2,
    label: "Brazil",
  },
};

export const DEFENDER_NATIONALITIES: DefenderNationality[] = [
  "argentina",
  "brazil",
];

export function isLocalMultiplayer(settings: SessionSettings): boolean {
  return settings.playMode === "multiplayer" && settings.multiplayerKind === "local";
}

export function isOnlineMultiplayer(settings: SessionSettings): boolean {
  return settings.playMode === "multiplayer" && settings.multiplayerKind === "online";
}

export function isCoopMultiplayer(settings: SessionSettings): boolean {
  return isLocalMultiplayer(settings) || isOnlineMultiplayer(settings);
}
