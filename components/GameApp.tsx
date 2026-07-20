"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import type { GameOverResult } from "@/game/events";
import type { Difficulty } from "@/game/difficulty";
import type { MultiplayerKind, PlayMode, PlayerNames } from "@/game/playMode";
import type { GameScoreState } from "@/game/scoring";
import BonusBoard from "./BonusBoard";
import DeathModal from "./DeathModal";
import RulesModal from "./RulesModal";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

type Phase = "idle" | "playing" | "gameover";
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
  });
  const [sessionId, setSessionId] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [score, setScore] = useState<GameScoreState>(INITIAL_SCORE);
  const [gameOverResult, setGameOverResult] = useState<GameOverResult | null>(
    null,
  );
  const [rulesOpen, setRulesOpen] = useState(false);

  const controlsLocked = phase === "playing";
  const isLocalCoop =
    activeSettings.playMode === "multiplayer" &&
    activeSettings.multiplayerKind === "local";

  const startGame = useCallback(() => {
    const playerNames: PlayerNames = {
      player1: sanitizePlayerName(player1Name, DEFAULT_PLAYER_NAMES.player1),
      player2: sanitizePlayerName(player2Name, DEFAULT_PLAYER_NAMES.player2),
    };

    setSeconds(0);
    setScore(INITIAL_SCORE);
    setGameOverResult(null);
    setActiveSettings({ playMode, multiplayerKind, difficulty, playerNames });
    setSessionId((id) => id + 1);
    setPhase("playing");
  }, [playMode, multiplayerKind, difficulty, player1Name, player2Name]);

  const handleTick = useCallback((value: number) => {
    setSeconds(value);
  }, []);

  const handleScoreChange = useCallback((value: GameScoreState) => {
    setScore(value);
  }, []);

  const handleGameOver = useCallback((result: GameOverResult) => {
    setGameOverResult(result);
    setSeconds(result.seconds);
    setScore((current) => ({
      ...current,
      total: result.totalScore,
      bonusBoard: null,
    }));
    setPhase("gameover");
  }, []);

  const placeholder = useMemo(() => {
    if (playMode === "multiplayer") {
      return "Press Start — P1: ← → + Enter · P2: A D + Space";
    }
    return "Press Start, then use ← → to dodge";
  }, [playMode]);

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
          <button
            type="button"
            className="rules-button"
            onClick={() => setRulesOpen(true)}
          >
            Rules
          </button>
        </div>
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

      <div className="username-row">
        <label className="setting-field username-field">
          <span className="setting-label">Player 1</span>
          <input
            className="username-input"
            type="text"
            value={player1Name}
            maxLength={16}
            disabled={controlsLocked}
            placeholder={DEFAULT_PLAYER_NAMES.player1}
            onChange={(event) => setPlayer1Name(event.target.value)}
          />
        </label>

        {playMode === "multiplayer" && (
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

      <div className="hud">
        {phase === "idle" && (
          <button type="button" className="game-button" onClick={startGame}>
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
      </div>

      <div className="canvas-wrap">
        {phase === "idle" ? (
          <div className="canvas-placeholder">{placeholder}</div>
        ) : (
          <>
            <BonusBoard bonusBoard={score.bonusBoard} />
            <GameCanvas
              sessionId={sessionId}
              settings={activeSettings}
              onTick={handleTick}
              onScoreChange={handleScoreChange}
              onGameOver={handleGameOver}
            />
          </>
        )}
      </div>

      {phase === "playing" && (
        <p className="hint">
          {isLocalCoop
            ? "P1: ← → · Enter to pass · P2: A D · Space to pass"
            : "Left / Right arrow keys to move"}
        </p>
      )}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <DeathModal
        open={phase === "gameover"}
        result={gameOverResult}
        onRestart={startGame}
      />
    </div>
  );
}
