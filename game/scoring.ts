export const TIME_POINTS_PER_SECOND = 10;
export const KILL_BONUS_BASE = 100;
export const NEAR_MISS_BONUS_BASE = 50;
export const STREAK_MULTIPLIER_INCREMENT = 0.1;
export const STREAK_TIMEOUT_MS = 4000;
/** Extra gap beyond collision radii to count as a near miss */
export const NEAR_MISS_MARGIN = 45;

export type BonusBoardState = {
  label: string;
  points: number;
  multiplier: number;
  pulseKey: number;
};

export type GameScoreState = {
  total: number;
  streak: number;
  multiplier: number;
  bonusBoard: BonusBoardState | null;
};

type ScoreListener = (state: GameScoreState) => void;

export function formatMultiplier(multiplier: number) {
  const rounded = Math.round(multiplier * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}x` : `${rounded.toFixed(1)}x`;
}

export class ScoreManager {
  private total = 0;
  private streak = 0;
  private multiplier = 1;
  private pointsMultiplier = 1;
  private streakBonusBase = 0;
  private lastBonusAtMs = 0;
  private bonusBoard: BonusBoardState | null = null;
  private bonusPulseKey = 0;
  private onStateChange: ScoreListener;

  constructor(onStateChange: ScoreListener) {
    this.onStateChange = onStateChange;
  }

  reset() {
    this.total = 0;
    this.streak = 0;
    this.multiplier = 1;
    this.pointsMultiplier = 1;
    this.streakBonusBase = 0;
    this.lastBonusAtMs = 0;
    this.bonusBoard = null;
    this.bonusPulseKey = 0;
    this.emitState();
  }

  setPointsMultiplier(multiplier: number) {
    this.pointsMultiplier = multiplier;
  }

  notifyPowerUp(label: string, elapsedMs: number) {
    this.decayStreakIfExpired(elapsedMs);
    this.bonusPulseKey += 1;
    this.bonusBoard = {
      label,
      points: 0,
      multiplier: this.multiplier,
      pulseKey: this.bonusPulseKey,
    };
    this.emitState();
  }

  addTimePoints(deltaMs: number, elapsedMs: number) {
    const points =
      (deltaMs / 1000) * TIME_POINTS_PER_SECOND * this.pointsMultiplier;
    if (points <= 0) return;
    this.total += points;
    this.decayStreakIfExpired(elapsedMs);
    this.emitState();
  }

  awardKill(elapsedMs: number) {
    this.awardBonus(KILL_BONUS_BASE, "Defender down!", elapsedMs);
  }

  awardNearMiss(elapsedMs: number) {
    this.awardBonus(NEAR_MISS_BONUS_BASE, "Near miss!", elapsedMs);
  }

  finalizeStreak() {
    if (this.streak === 0) return;
    this.settleStreakBonus();
    this.emitState();
  }

  private awardBonus(
    basePoints: number,
    label: string,
    elapsedMs: number,
  ) {
    this.decayStreakIfExpired(elapsedMs);
    this.streak += 1;
    this.multiplier = 1 + (this.streak - 1) * STREAK_MULTIPLIER_INCREMENT;
    this.lastBonusAtMs = elapsedMs;

    const awardedPoints = basePoints * this.pointsMultiplier;
    this.total += awardedPoints;
    this.streakBonusBase += awardedPoints;
    this.bonusPulseKey += 1;
    this.bonusBoard = {
      label,
      points: awardedPoints,
      multiplier: this.multiplier,
      pulseKey: this.bonusPulseKey,
    };
    this.emitState();
  }

  private settleStreakBonus() {
    if (this.streakBonusBase > 0 && this.multiplier > 1) {
      this.total += this.streakBonusBase * (this.multiplier - 1);
    }

    this.streak = 0;
    this.multiplier = 1;
    this.streakBonusBase = 0;
    this.bonusBoard = null;
  }

  private decayStreakIfExpired(elapsedMs: number) {
    if (
      this.streak > 0 &&
      this.lastBonusAtMs > 0 &&
      elapsedMs - this.lastBonusAtMs > STREAK_TIMEOUT_MS
    ) {
      this.settleStreakBonus();
    }
  }

  getState(): GameScoreState {
    return {
      total: Math.floor(this.total),
      streak: this.streak,
      multiplier: this.multiplier,
      bonusBoard: this.bonusBoard,
    };
  }

  getFinalScore() {
    return Math.floor(this.total);
  }

  private emitState() {
    this.onStateChange(this.getState());
  }
}
