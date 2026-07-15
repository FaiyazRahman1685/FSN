"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

type Phase = "idle" | "playing" | "gameover";

export default function GameApp() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [finalSeconds, setFinalSeconds] = useState(0);

  const startGame = useCallback(() => {
    setSeconds(0);
    setFinalSeconds(0);
    setSessionId((id) => id + 1);
    setPhase("playing");
  }, []);

  const handleTick = useCallback((value: number) => {
    setSeconds(value);
  }, []);

  const handleGameOver = useCallback((value: number) => {
    setFinalSeconds(value);
    setSeconds(value);
    setPhase("gameover");
  }, []);

  return (
    <div className="game-shell">
      <header className="game-header">
        <h1 className="game-title">Pitch Runner</h1>
        <p className="game-subtitle">
          Dodge defenders. Survive as long as you can.
        </p>
      </header>

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
          <div className="canvas-placeholder">
            Press Start, then use ← → to dodge
          </div>
        ) : (
          <GameCanvas
            sessionId={sessionId}
            onTick={handleTick}
            onGameOver={handleGameOver}
          />
        )}
      </div>

      {phase === "playing" && (
        <p className="hint">Left / Right arrow keys to move</p>
      )}
    </div>
  );
}
