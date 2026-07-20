"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameOverResult } from "@/game/events";
import type { Difficulty } from "@/game/difficulty";
import type {
  MultiplayerKind,
  OnlineSessionInfo,
  PlayMode,
  PlayerNames,
} from "@/game/playMode";
import type { GameScoreState } from "@/game/scoring";
import {
  createRoom,
  getWebSocketUrl,
  joinRoom,
  leaveRoom,
  startRoom,
  submitHighscore,
  type Room,
  type ServerMessage,
} from "@/game/network/api";
import { GameSocket } from "@/game/network/socket";
import { InputSyncBridge } from "@/game/network/inputSync";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import BonusBoard from "./BonusBoard";
import DeathModal from "./DeathModal";
import OnlineStatusBar from "./OnlineStatusBar";
import RulesModal from "./RulesModal";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

type Phase = "idle" | "playing" | "gameover";
type OnlineLobbyPhase = "none" | "choose" | "join" | "lobby";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const DEFAULT_PLAYER_NAMES: PlayerNames = {
  player1: "Player 1",
  player2: "Player 2",
};

const INITIAL_SCORE: GameScoreState = {
  total: 0,
  streak: 0,
  multiplier: 1,
  bonusBoard: null,
};

function sanitizePlayerName(value: string, fallback: string) {
  const trimmed = value.trim().slice(0, 16);
  return trimmed || fallback;
}

export default function GameApp() {
  const { status: onlineStatus } = useOnlineStatus();
  const onlineAvailable = onlineStatus === "online";

  const [phase, setPhase] = useState<Phase>("idle");
  const [playMode, setPlayMode] = useState<PlayMode>("single");
  const [multiplayerKind, setMultiplayerKind] =
    useState<MultiplayerKind>("local");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [player1Name, setPlayer1Name] = useState(DEFAULT_PLAYER_NAMES.player1);
  const [player2Name, setPlayer2Name] = useState(DEFAULT_PLAYER_NAMES.player2);
  const [activeSettings, setActiveSettings] = useState({
    playMode: "single" as PlayMode,
    multiplayerKind: "local" as MultiplayerKind,
    difficulty: "easy" as Difficulty,
    playerNames: DEFAULT_PLAYER_NAMES,
    online: undefined as OnlineSessionInfo | undefined,
  });
  const [sessionId, setSessionId] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [score, setScore] = useState<GameScoreState>(INITIAL_SCORE);
  const [gameOverResult, setGameOverResult] = useState<GameOverResult | null>(
    null,
  );
  const [deathModalOpen, setDeathModalOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);

  const [onlineLobbyPhase, setOnlineLobbyPhase] = useState<OnlineLobbyPhase>("none");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [onlineSession, setOnlineSession] = useState<OnlineSessionInfo | null>(
    null,
  );
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [lobbyBusy, setLobbyBusy] = useState(false);

  const socketRef = useRef<GameSocket | null>(null);
  const inputSyncRef = useRef<InputSyncBridge | null>(null);
  if (!inputSyncRef.current) {
    inputSyncRef.current = new InputSyncBridge();
  }

  const controlsLocked = phase === "playing";
  const isLocalCoop =
    activeSettings.playMode === "multiplayer" &&
    activeSettings.multiplayerKind === "local";
  const isOnlineMode =
    playMode === "multiplayer" && multiplayerKind === "online";
  const showOnlineLobby =
    isOnlineMode && phase === "idle" && onlineLobbyPhase !== "none";

  useBackgroundMusic(phase === "playing");

  const cleanupOnlineSession = useCallback(async () => {
    socketRef.current?.disconnect();
    socketRef.current = null;

    if (onlineSession) {
      try {
        await leaveRoom(onlineSession.roomCode, onlineSession.playerId);
      } catch {
        // room may already be gone
      }
    }

    setRoom(null);
    setOnlineSession(null);
    setOnlineLobbyPhase("none");
    setLobbyError(null);
    setRoomCodeInput("");
  }, [onlineSession]);

  useEffect(() => {
    if (onlineStatus === "offline" && phase === "playing" && isOnlineMode) {
      setConnectionLost(true);
    }
  }, [onlineStatus, phase, isOnlineMode]);

  useEffect(() => {
    if (!isOnlineMode && onlineLobbyPhase !== "none") {
      void cleanupOnlineSession();
    }
  }, [isOnlineMode, onlineLobbyPhase, cleanupOnlineSession]);

  const beginOnlineGame = useCallback(
    (payload: {
      seed: number;
      startedAt: string;
      roomSnapshot: Room;
      session: OnlineSessionInfo;
    }) => {
      const playerNames: PlayerNames = {
        player1: DEFAULT_PLAYER_NAMES.player1,
        player2: DEFAULT_PLAYER_NAMES.player2,
      };

      for (const player of Object.values(payload.roomSnapshot.players)) {
        if (player.slot === 1) playerNames.player1 = player.username;
        if (player.slot === 2) playerNames.player2 = player.username;
      }

      inputSyncRef.current?.reset(payload.startedAt);

      setSeconds(0);
      setScore(INITIAL_SCORE);
      setGameOverResult(null);
      setDeathModalOpen(false);
      setConnectionLost(false);
      setActiveSettings({
        playMode: "multiplayer",
        multiplayerKind: "online",
        difficulty: payload.roomSnapshot.difficulty,
        playerNames,
        online: {
          ...payload.session,
          seed: payload.seed,
          startedAt: payload.startedAt,
        },
      });
      setSessionId((id) => id + 1);
      setPhase("playing");
      setOnlineLobbyPhase("none");
    },
    [],
  );

  const connectToRoom = useCallback(
    async (code: string, playerId: string, session: OnlineSessionInfo) => {
      const socket = new GameSocket();
      socketRef.current = socket;
      await socket.connect(getWebSocketUrl(code, playerId));

      socket.onMessage((message: ServerMessage) => {
        if (message.type === "room_state") {
          setRoom(message.room);
          return;
        }

        if (message.type === "game_start") {
          beginOnlineGame({
            seed: message.seed,
            startedAt: message.started_at,
            roomSnapshot: message.room,
            session,
          });
          return;
        }

        if (message.type === "input_frame") {
          const slot = session.slot;
          inputSyncRef.current?.applyFrame(message.tick, message.inputs, slot);
          return;
        }

        if (message.type === "player_left") {
          setLobbyError(`Player ${message.slot} disconnected`);
        }
      });
    },
    [beginOnlineGame],
  );

  const handleCreateRoom = useCallback(async () => {
    if (!onlineAvailable) return;
    setLobbyBusy(true);
    setLobbyError(null);
    try {
      const username = sanitizePlayerName(
        player1Name,
        DEFAULT_PLAYER_NAMES.player1,
      );
      const response = await createRoom(username, difficulty);
      const session: OnlineSessionInfo = {
        roomCode: response.code,
        playerId: response.player_id,
        slot: response.slot as 1 | 2,
        isHost: true,
      };
      setOnlineSession(session);
      setRoom(response.room);
      setOnlineLobbyPhase("lobby");
      await connectToRoom(response.code, response.player_id, session);
    } catch (error) {
      setLobbyError(error instanceof Error ? error.message : "Failed to create room");
    } finally {
      setLobbyBusy(false);
    }
  }, [onlineAvailable, player1Name, difficulty, connectToRoom]);

  const handleJoinRoom = useCallback(async () => {
    if (!onlineAvailable) return;
    const code = roomCodeInput.trim();
    if (code.length !== 6) {
      setLobbyError("Enter a 6-digit room code");
      return;
    }

    setLobbyBusy(true);
    setLobbyError(null);
    try {
      const username = sanitizePlayerName(
        player1Name,
        DEFAULT_PLAYER_NAMES.player1,
      );
      const response = await joinRoom(code, username);
      const session: OnlineSessionInfo = {
        roomCode: code,
        playerId: response.player_id,
        slot: response.slot as 1 | 2,
        isHost: response.room.host_player_id === response.player_id,
      };
      setOnlineSession(session);
      setRoom(response.room);
      setOnlineLobbyPhase("lobby");
      await connectToRoom(code, response.player_id, session);
    } catch (error) {
      setLobbyError(error instanceof Error ? error.message : "Failed to join room");
    } finally {
      setLobbyBusy(false);
    }
  }, [onlineAvailable, roomCodeInput, player1Name, connectToRoom]);

  const handleHostStart = useCallback(async () => {
    if (!onlineSession || !onlineSession.isHost || !room) return;
    setLobbyBusy(true);
    setLobbyError(null);
    try {
      await startRoom(onlineSession.roomCode, onlineSession.playerId);
    } catch (error) {
      setLobbyError(error instanceof Error ? error.message : "Failed to start game");
    } finally {
      setLobbyBusy(false);
    }
  }, [onlineSession, room]);

  const startLocalGame = useCallback(() => {
    const playerNames: PlayerNames = {
      player1: sanitizePlayerName(player1Name, DEFAULT_PLAYER_NAMES.player1),
      player2: sanitizePlayerName(player2Name, DEFAULT_PLAYER_NAMES.player2),
    };

    setSeconds(0);
    setScore(INITIAL_SCORE);
    setGameOverResult(null);
    setDeathModalOpen(false);
    setConnectionLost(false);
    setActiveSettings({
      playMode,
      multiplayerKind,
      difficulty,
      playerNames,
      online: undefined,
    });
    setSessionId((id) => id + 1);
    setPhase("playing");
  }, [playMode, multiplayerKind, difficulty, player1Name, player2Name]);

  const handleTick = useCallback((value: number) => {
    setSeconds(value);
  }, []);

  const handleScoreChange = useCallback((value: GameScoreState) => {
    setScore(value);
  }, []);

  const handleGameOver = useCallback(
    async (result: GameOverResult) => {
      setGameOverResult(result);
      setDeathModalOpen(true);
      setSeconds(result.seconds);
      setScore((current) => ({
        ...current,
        total: result.totalScore,
        bonusBoard: null,
      }));
      setPhase("gameover");

      const submitMode =
        activeSettings.playMode === "multiplayer" ? "multiplayer" : "single";

      for (const player of result.players) {
        try {
          await submitHighscore({
            username: player.name,
            score: player.score,
            survival_seconds: result.seconds,
            difficulty: activeSettings.difficulty,
            play_mode: submitMode,
            room_code: activeSettings.online?.roomCode,
          });
        } catch {
          // leaderboard is best-effort
        }
      }

      if (activeSettings.online) {
        void cleanupOnlineSession();
      }
    },
    [activeSettings, cleanupOnlineSession],
  );

  const handleInputSend = useCallback((tick: number, keys: import("@/game/network/api").InputKeys) => {
    socketRef.current?.sendInput(tick, keys);
  }, []);

  const placeholder = useMemo(() => {
    if (playMode === "multiplayer" && multiplayerKind === "online") {
      return "Create or join a room to play online";
    }
    if (playMode === "multiplayer") {
      return "Press Start — P1: ← → + Enter · P2: A D + Space";
    }
    return "Press Start, then use ← → to dodge";
  }, [playMode, multiplayerKind]);

  const lobbyPlayers = room
    ? Object.entries(room.players)
        .map(([id, player]) => ({ id, ...player }))
        .sort((a, b) => a.slot - b.slot)
    : [];

  const connectedCount = lobbyPlayers.filter((player) => player.connected).length;

  return (
    <div className="game-shell">
      <header className="game-header">
        <div className="game-header-row">
          <div className="game-header-copy">
            <h1 className="game-title">Pitch Runner</h1>
            <p className="game-subtitle">
              Dodge defenders. Survive as long as you can.
            </p>
          </div>
          <div className="game-header-actions">
            <OnlineStatusBar status={onlineStatus} />
            <button
              type="button"
              className="rules-button"
              onClick={() => setRulesOpen(true)}
            >
              Rules
            </button>
          </div>
        </div>
      </header>

      {connectionLost && (
        <div className="connection-banner" role="status">
          Connection to server lost
        </div>
      )}

      <div className="settings-row">
        <label className="setting-field">
          <span className="setting-label">Mode</span>
          <select
            className="setting-select"
            value={playMode}
            disabled={controlsLocked}
            onChange={(event) => {
              const next = event.target.value as PlayMode;
              setPlayMode(next);
              if (next === "single") setOnlineLobbyPhase("none");
            }}
          >
            <option value="single">Single player</option>
            <option value="multiplayer">Multiplayer</option>
          </select>
        </label>

        {playMode === "multiplayer" && (
          <label className="setting-field">
            <span className="setting-label">Multiplayer</span>
            <select
              className="setting-select"
              value={multiplayerKind}
              disabled={controlsLocked}
              onChange={(event) => {
                const next = event.target.value as MultiplayerKind;
                setMultiplayerKind(next);
                if (next === "online") {
                  setOnlineLobbyPhase("choose");
                } else {
                  void cleanupOnlineSession();
                }
              }}
            >
              <option value="local">Local</option>
              <option
                value="online"
                disabled={!onlineAvailable}
                title={
                  onlineAvailable
                    ? undefined
                    : "Online multiplayer unavailable"
                }
              >
                Online
              </option>
            </select>
          </label>
        )}

        <label className="setting-field">
          <span className="setting-label">Difficulty</span>
          <select
            className="setting-select"
            value={difficulty}
            disabled={controlsLocked}
            onChange={(event) =>
              setDifficulty(event.target.value as Difficulty)
            }
          >
            {DIFFICULTIES.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="username-row">
        <label className="setting-field username-field">
          <span className="setting-label">
            {isOnlineMode ? "Username" : "Player 1"}
          </span>
          <input
            className="username-input"
            type="text"
            value={player1Name}
            maxLength={16}
            disabled={controlsLocked || onlineLobbyPhase === "lobby"}
            placeholder={DEFAULT_PLAYER_NAMES.player1}
            onChange={(event) => setPlayer1Name(event.target.value)}
          />
        </label>

        {playMode === "multiplayer" && !isOnlineMode && (
          <label className="setting-field username-field">
            <span className="setting-label">Player 2</span>
            <input
              className="username-input"
              type="text"
              value={player2Name}
              maxLength={16}
              disabled={controlsLocked}
              placeholder={DEFAULT_PLAYER_NAMES.player2}
              onChange={(event) => setPlayer2Name(event.target.value)}
            />
          </label>
        )}
      </div>

      {showOnlineLobby && (
        <section className="online-lobby">
          {onlineLobbyPhase === "choose" && (
            <div className="online-lobby-actions">
              <button
                type="button"
                className="game-button"
                disabled={!onlineAvailable || lobbyBusy}
                onClick={() => void handleCreateRoom()}
              >
                Create room
              </button>
              <button
                type="button"
                className="game-button game-button-secondary"
                disabled={!onlineAvailable || lobbyBusy}
                onClick={() => setOnlineLobbyPhase("join")}
              >
                Join room
              </button>
            </div>
          )}

          {onlineLobbyPhase === "join" && (
            <div className="online-lobby-join">
              <label className="setting-field">
                <span className="setting-label">Room code</span>
                <input
                  className="username-input room-code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={roomCodeInput}
                  placeholder="123456"
                  onChange={(event) =>
                    setRoomCodeInput(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
              <button
                type="button"
                className="game-button"
                disabled={!onlineAvailable || lobbyBusy}
                onClick={() => void handleJoinRoom()}
              >
                Join
              </button>
            </div>
          )}

          {onlineLobbyPhase === "lobby" && room && onlineSession && (
            <div className="online-lobby-room">
              <p className="room-code-display">
                Room code: <strong>{room.code}</strong>
              </p>
              <ul className="lobby-player-list">
                {lobbyPlayers.map((player) => (
                  <li key={player.id} className="lobby-player-row">
                    <span>{player.username}</span>
                    <span className="lobby-player-meta">
                      P{player.slot}
                      {player.connected ? " · connected" : " · waiting"}
                    </span>
                  </li>
                ))}
              </ul>
              {onlineSession.isHost ? (
                <button
                  type="button"
                  className="game-button"
                  disabled={
                    lobbyBusy || connectedCount < 2 || room.status !== "waiting"
                  }
                  title={
                    connectedCount < 2
                      ? "Waiting for both players to connect"
                      : undefined
                  }
                  onClick={() => void handleHostStart()}
                >
                  Start game
                </button>
              ) : (
                <p className="lobby-waiting">Waiting for host to start…</p>
              )}
              <button
                type="button"
                className="game-button game-button-secondary"
                disabled={lobbyBusy}
                onClick={() => void cleanupOnlineSession()}
              >
                Leave room
              </button>
            </div>
          )}

          {lobbyError && <p className="lobby-error">{lobbyError}</p>}
        </section>
      )}

      <div className="hud">
        {phase === "idle" && !isOnlineMode && (
          <button type="button" className="game-button" onClick={startLocalGame}>
            Start
          </button>
        )}

        {phase === "playing" && (
          <div className="hud-stats" aria-live="polite">
            <div className="timer">
              Time: <span className="timer-value">{seconds.toFixed(1)}s</span>
            </div>
            <div className="score-display">
              Score:{" "}
              <span className="score-value">{score.total.toLocaleString()}</span>
            </div>
          </div>
        )}

        {phase === "gameover" && !deathModalOpen && (
          <button
            type="button"
            className="game-button"
            onClick={isOnlineMode ? () => setOnlineLobbyPhase("choose") : startLocalGame}
          >
            Play Again
          </button>
        )}
      </div>

      <div className="game-stage">
        <div
          className="audience-strip audience-strip--left"
          aria-hidden="true"
        />
        <div className="canvas-wrap">
          {phase === "idle" ? (
            <div className="canvas-placeholder">{placeholder}</div>
          ) : (
            <>
              <BonusBoard bonusBoard={score.bonusBoard} />
              <GameCanvas
                sessionId={sessionId}
                settings={activeSettings}
                inputSyncBridge={inputSyncRef.current}
                onInputSend={handleInputSend}
                onTick={handleTick}
                onScoreChange={handleScoreChange}
                onGameOver={handleGameOver}
              />
            </>
          )}
        </div>
        <div
          className="audience-strip audience-strip--right"
          aria-hidden="true"
        />
      </div>

      {phase === "playing" && (
        <p className="hint">
          {isLocalCoop
            ? "P1: ← → · Enter to pass · P2: A D · Space to pass"
            : activeSettings.multiplayerKind === "online"
              ? activeSettings.online?.slot === 1
                ? "P1 controls: ← → · Enter to pass"
                : "P2 controls: A D · Space to pass"
              : "Left / Right arrow keys to move"}
        </p>
      )}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <DeathModal
        open={phase === "gameover" && deathModalOpen}
        result={gameOverResult}
        onClose={() => setDeathModalOpen(false)}
        onRestart={isOnlineMode ? () => setOnlineLobbyPhase("choose") : startLocalGame}
      />
    </div>
  );
}
