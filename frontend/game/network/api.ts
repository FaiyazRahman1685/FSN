import type { Difficulty } from "../difficulty";

export type HealthResponse = {
  status: string;
  redis: string;
  online_multiplayer_available: boolean;
};

export type RoomPlayer = {
  username: string;
  slot: number;
  connected: boolean;
};

export type Room = {
  code: string;
  host_player_id: string;
  difficulty: Difficulty;
  status: "waiting" | "playing" | "finished";
  seed: number | null;
  started_at: string | null;
  players: Record<string, RoomPlayer>;
};

export type CreateRoomResponse = {
  code: string;
  player_id: string;
  slot: number;
  room: Room;
};

export type JoinRoomResponse = {
  player_id: string;
  slot: number;
  room: Room;
};

export type StartRoomResponse = {
  seed: number;
  started_at: string;
  room: Room;
};

export type InputKeys = {
  left: boolean;
  right: boolean;
  pass: boolean;
};

export type ServerMessage =
  | { type: "room_state"; room: Room }
  | {
      type: "game_start";
      seed: number;
      started_at: string;
      tick_rate: number;
      room: Room;
    }
  | {
      type: "input_frame";
      tick: number;
      inputs: Array<{ slot: number; keys: InputKeys }>;
    }
  | { type: "player_left"; slot: number }
  | { type: "pong" }
  | { type: "error"; message: string };

export type HighscoreEntry = {
  id: number;
  username: string;
  score: number;
  survival_seconds: number;
  difficulty: Difficulty;
  play_mode: "single" | "multiplayer";
  room_code: string | null;
  created_at: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Online multiplayer deferred — health ping disabled for now.
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  // const response = await fetch(`${API_URL}/health`, { signal });
  // if (!response.ok) {
  //   const body = (await response.json().catch(() => null)) as HealthResponse | null;
  //   if (body) return body;
  //   throw new Error("Health check failed");
  // }
  // return response.json() as Promise<HealthResponse>;
  void signal;
  return {
    status: "offline",
    redis: "unavailable",
    online_multiplayer_available: false,
  };
}

export function createRoom(username: string, difficulty: Difficulty) {
  return apiFetch<CreateRoomResponse>("/rooms", {
    method: "POST",
    body: JSON.stringify({ username, difficulty }),
  });
}

export function joinRoom(code: string, username: string) {
  return apiFetch<JoinRoomResponse>(`/rooms/${code}/join`, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function getRoom(code: string) {
  return apiFetch<Room>(`/rooms/${code}`);
}

export function startRoom(code: string, playerId: string) {
  return apiFetch<StartRoomResponse>(`/rooms/${code}/start`, {
    method: "POST",
    body: JSON.stringify({ player_id: playerId }),
  });
}

export function leaveRoom(code: string, playerId: string) {
  return apiFetch<void>(`/rooms/${code}/players/${playerId}`, {
    method: "DELETE",
  });
}

export function fetchLeaderboard(
  difficulty: Difficulty,
  playMode: "single" | "multiplayer",
  limit = 10,
) {
  const params = new URLSearchParams({
    difficulty,
    play_mode: playMode,
    limit: String(limit),
  });
  return apiFetch<{ entries: HighscoreEntry[] }>(`/leaderboards?${params}`);
}

export function submitHighscore(payload: {
  username: string;
  score: number;
  survival_seconds: number;
  difficulty: Difficulty;
  play_mode: "single" | "multiplayer";
  room_code?: string;
}) {
  return apiFetch<{ entries: HighscoreEntry[] }>("/leaderboards", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getWebSocketUrl(code: string, playerId: string) {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/ws/rooms/${code}?player_id=${encodeURIComponent(playerId)}`;
}

export { API_URL };
