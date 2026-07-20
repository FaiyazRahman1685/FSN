"use client";

import { useEffect, useId, useRef } from "react";

type RulesModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function RulesModal({ open, onClose }: RulesModalProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="rules-modal-backdrop" onClick={onClose}>
      <div
        className="rules-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="rules-modal-header">
          <h2 id={titleId} className="rules-modal-title">
            How to Play
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="rules-modal-close"
            aria-label="Close rules"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="rules-modal-body">
          <section className="rules-section">
            <h3 className="rules-section-title">Goal</h3>
            <p>
              Dodge defenders scrolling down the pitch. Touch a defender without
              invulnerability and it&apos;s game over — survive as long as you
              can and rack up points.
            </p>
          </section>

          <section className="rules-section">
            <h3 className="rules-section-title">Controls</h3>
            <ul className="rules-list">
              <li>
                <strong>Single player:</strong> ← → to move
              </li>
              <li>
                <strong>Local co-op P1:</strong> ← → to move, Enter to pass
              </li>
              <li>
                <strong>Local co-op P2:</strong> A / D to move, Space to pass
              </li>
            </ul>
          </section>

          <section className="rules-section">
            <h3 className="rules-section-title">Scoring</h3>
            <ul className="rules-list">
              <li>
                <strong>Time:</strong> +10 pts per second
              </li>
              <li>
                <strong>Near miss:</strong> +50 pts when a defender passes
                close by
              </li>
              <li>
                <strong>Defender down:</strong> +100 pts while invulnerable
                (pass or orb)
              </li>
              <li>
                <strong>Streak:</strong> back-to-back bonuses build a multiplier
                (+0.1× each). It settles after 4 s without a bonus, or when
                the run ends.
              </li>
            </ul>
          </section>

          <section className="rules-section">
            <h3 className="rules-section-title">Power-ups</h3>
            <p className="rules-note">
              Colored orbs spawn on the pitch. Pick one up to activate it.
              Only <strong>one power-up</strong> can be active at a time — the
              latest always replaces the current one (including pass
              invulnerability).
            </p>
            <ul className="rules-list rules-powerups">
              <li>
                <span className="rules-orb rules-orb--gold" aria-hidden />
                <span>
                  <strong>2× Points</strong> — doubles time and bonus points
                  for 8 s
                </span>
              </li>
              <li>
                <span className="rules-orb rules-orb--cyan" aria-hidden />
                <span>
                  <strong>Invulnerability</strong> — smash through defenders
                  for 5 s
                </span>
              </li>
              <li>
                <span className="rules-orb rules-orb--orange" aria-hidden />
                <span>
                  <strong>Speed boost</strong> — faster left/right movement
                  for 5 s
                </span>
              </li>
            </ul>
          </section>

          <section className="rules-section">
            <h3 className="rules-section-title">Passing (local co-op)</h3>
            <ul className="rules-list">
              <li>
                Passing the ball gives the <strong>passer</strong> 2 s of
                invulnerability.
              </li>
              <li>
                If the ball holder catches the ball while pass invulnerability
                is active, that power-up ends.
              </li>
              <li>
                If a defender intercepts the ball mid-pass, it&apos;s game
                over.
              </li>
              <li>
                On higher difficulties, defender walls can block the ball —
                you may need to pass to get through.
              </li>
            </ul>
          </section>

          <section className="rules-section">
            <h3 className="rules-section-title">Difficulty</h3>
            <ul className="rules-list">
              <li>
                <strong>Easy:</strong> fewer defenders, slower pace
              </li>
              <li>
                <strong>Medium / Hard:</strong> more defenders, faster scroll,
                more forced-pass walls
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
