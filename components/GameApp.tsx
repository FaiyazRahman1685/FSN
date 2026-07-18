"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import type { Difficulty } from "@/game/difficulty";
import type { MultiplayerKind, PlayMode } from "@/game/playMode";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

type Phase = "idle" | "playing" | "gameover";
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export default function GameApp() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [playMode, setPlayMode] = useState<PlayMode>("single");
  const [multiplayerKind, setMultiplayerKind] =
    useState<MultiplayerKind>("local");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [activeSettings, setActiveSettings] = useState({
    playMode: "single" as PlayMode,
    multiplayerKind: "local" as MultiplayerKind,
    difficulty: "easy" as Difficulty,
  });
  const [sessionId, setSessionId] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [finalSeconds, setFinalSeconds] = useState(0);

  const controlsLocked = phase === "playing";
  const isLocalCoop =
    activeSettings.playMode === "multiplayer" &&
    activeSettings.multiplayerKind === "local";

  const startGame = useCallback(() => {
    setSeconds(0);
    setFinalSeconds(0);
    setActiveSettings({ playMode, multiplayerKind, difficulty });
    setSessionId((id) => id + 1);
    setPhase("playing");
  }, [playMode, multiplayerKind, difficulty]);

  const handleTick = useCallback((value: number) => {
    setSeconds(value);
  }, []);

  const handleGameOver = useCallback((value: number) => {
    setFinalSeconds(value);
    setSeconds(value);
    setPhase("gameover");
  }, []);

  const placeholder = useMemo(() => {
    if (playMode === "multiplayer") {
      return "Press Start — P1: ← → · P2: A D · Space: pass";
    }
    return "Press Start, then use ← → to dodge";
  }, [playMode]);

  return (
    <div className="game-shell">
      <header className="game-header">
        <h1 className="game-title">Pitch Runner</h1>
        <p className="game-subtitle">
          Dodge defenders. Survive as long as you can.
        </p>
      </header>

      <div className="settings-row">
        <label className="setting-field">
          <span className="setting-label">Mode</span>
          <select
            className="setting-select"
            value={playMode}
            disabled={controlsLocked}
            onChange={(event) => setPlayMode(event.target.value as PlayMode)}
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
              onChange={(event) =>
                setMultiplayerKind(event.target.value as MultiplayerKind)
              }
            >
              <option value="local">Local</option>
              <option value="online" disabled>
                Online (coming soon)
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

      <div className="hud">
        {phase === "idle" && (
          <button type="button" className="game-button" onClick={startGame}>
            Start
          </button>
        )}

        {phase === "playing" && (
          <div className="timer" aria-live="polite">
            Time: <span className="timer-value">{seconds.toFixed(1)}s</span>
          </div>
        )}

        {phase === "gameover" && (
          <div className="gameover">
            <p className="gameover-text">
              Survived <strong>{finalSeconds.toFixed(1)}s</strong>
            </p>
            <button type="button" className="game-button" onClick={startGame}>
              Restart
            </button>
          </div>
        )}
      </div>

      <div className="canvas-wrap">
        {phase === "idle" ? (
          <div className="canvas-placeholder">{placeholder}</div>
        ) : (
          <GameCanvas
            sessionId={sessionId}
            settings={activeSettings}
            onTick={handleTick}
            onGameOver={handleGameOver}
          />
        )}
      </div>

      {phase === "playing" && (
        <p className="hint">
          {isLocalCoop
            ? "P1: ← → · P2: A D · Space: pass the ball"
            : "Left / Right arrow keys to move"}
        </p>
      )}
    </div>
  );
}
