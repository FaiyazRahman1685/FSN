"use client";

import { useEffect, useRef, useState } from "react";
import { formatMultiplier, type BonusBoardState } from "@/game/scoring";

type BonusBoardProps = {
  bonusBoard: BonusBoardState | null;
};

export default function BonusBoard({ bonusBoard }: BonusBoardProps) {
  const prevPulseKeyRef = useRef(0);
  const [animClass, setAnimClass] = useState("");

  useEffect(() => {
    if (!bonusBoard) {
      prevPulseKeyRef.current = 0;
      setAnimClass("");
      return;
    }

    setAnimClass(
      prevPulseKeyRef.current === 0 ? "bonus-board--in" : "bonus-board--pop",
    );
    prevPulseKeyRef.current = bonusBoard.pulseKey;

    const timer = window.setTimeout(() => setAnimClass(""), 480);
    return () => window.clearTimeout(timer);
  }, [bonusBoard?.pulseKey]);

  if (!bonusBoard) return null;

  return (
    <div className={`bonus-board ${animClass}`.trim()} aria-live="polite">
      <span className="bonus-board-label">{bonusBoard.label}</span>
      {bonusBoard.points > 0 ? (
        <span className="bonus-board-points">+{bonusBoard.points}</span>
      ) : null}
      <span className="bonus-board-multiplier">
        {formatMultiplier(bonusBoard.multiplier)}
      </span>
    </div>
  );
}
