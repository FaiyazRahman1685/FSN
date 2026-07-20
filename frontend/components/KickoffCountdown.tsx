"use client";

import { useEffect, useState } from "react";
import { releaseKickoffGate } from "@/game/kickoffGate";

const DIGITS = [3, 2, 1] as const;
const BEAT_MS = 1000;

type KickoffCountdownProps = {
  active: boolean;
  onComplete?: () => void;
};

export default function KickoffCountdown({
  active,
  onComplete,
}: KickoffCountdownProps) {
  const [digit, setDigit] = useState<(typeof DIGITS)[number] | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (!active) {
      setDigit(null);
      return;
    }

    let cancelled = false;
    let timeoutId = 0;
    let index = 0;

    const tick = () => {
      if (cancelled) return;

      if (index >= DIGITS.length) {
        setDigit(null);
        releaseKickoffGate();
        onComplete?.();
        return;
      }

      setDigit(DIGITS[index]);
      setPulseKey((key) => key + 1);
      index += 1;
      timeoutId = window.setTimeout(tick, BEAT_MS);
    };

    tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [active, onComplete]);

  if (!active || digit === null) return null;

  return (
    <div className="kickoff-overlay" aria-live="assertive" aria-atomic="true">
      <span key={pulseKey} className="kickoff-digit">
        {digit}
      </span>
    </div>
  );
}
