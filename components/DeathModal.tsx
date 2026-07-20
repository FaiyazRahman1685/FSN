"use client";

import { useEffect, useId, useRef } from "react";
import type { GameOverResult } from "@/game/events";

type DeathModalProps = {
  open: boolean;
  result: GameOverResult | null;
  onRestart: () => void;
};

export default function DeathModal({ open, result, onRestart }: DeathModalProps) {
  const titleId = useId();
  const restartRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    restartRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onRestart();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onRestart]);

  if (!open || !result) return null;

  return (
    <div className="death-modal-backdrop">
      <div
        className="death-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="death-modal-header">
          <h2 id={titleId} className="death-modal-title">
            Game Over
          </h2>
          <p className="death-modal-subtitle">
            Survived <strong>{result.seconds.toFixed(1)}s</strong>
          </p>
        </header>

        <div className="death-modal-body">
          <ul className="death-score-list">
            {result.players.map((player) => (
              <li key={player.name} className="death-score-row">
                <span className="death-score-name">{player.name}</span>
                <span className="death-score-points">
                  {player.score.toLocaleString()} pts
                </span>
              </li>
            ))}
          </ul>

          {result.players.length > 1 && (
            <p className="death-team-total">
              Team total:{" "}
              <strong>{result.totalScore.toLocaleString()} pts</strong>
            </p>
          )}
        </div>

        <footer className="death-modal-footer">
          <button
            ref={restartRef}
            type="button"
            className="game-button"
            onClick={onRestart}
          >
            Play Again
          </button>
        </footer>
      </div>
    </div>
  );
}
