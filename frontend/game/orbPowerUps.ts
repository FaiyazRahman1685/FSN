export type OrbPowerUpType = "doublePoints" | "invulnerability" | "speedBoost";

export const ORB_POWER_UP_TYPES: OrbPowerUpType[] = [
  "doublePoints",
  "invulnerability",
  "speedBoost",
];

export const ORB_COLORS: Record<OrbPowerUpType, number> = {
  doublePoints: 0xffd700,
  invulnerability: 0x60a5fa,
  speedBoost: 0xef4444,
};

export const ORB_LABELS: Record<OrbPowerUpType, string> = {
  doublePoints: "2x Points!",
  invulnerability: "Invulnerable!",
  speedBoost: "Speed boost!",
};

/** 3×3 sheet — rows: 2× points, speed, invulnerability; cols: pulse frames */
export const ORB_SHEET_KEY = "powerups";
export const ORB_SHEET_PATH = "/sprites/pixil-frame-04.png";
export const ORB_FRAME_W = 120;
export const ORB_FRAME_H = 120;
export const ORB_DISPLAY_W = 56;
export const ORB_DISPLAY_H = 56;
export const ORB_ANIM_FPS = 5;

export const ORB_ANIM_KEYS: Record<OrbPowerUpType, string> = {
  doublePoints: "orb-double-points",
  speedBoost: "orb-speed-boost",
  invulnerability: "orb-invulnerability",
};

/** Column frames (0–2) within each power-up row on the sheet. */
export const ORB_PULSE_FRAMES: Record<OrbPowerUpType, number[]> = {
  doublePoints: [0, 1, 2],
  speedBoost: [3, 4, 5],
  invulnerability: [6, 7, 8],
};

export const ORB_RADIUS = 24;
export const ORB_SPAWN_INTERVAL_MS = 3200;
export const ORB_SPAWN_CHANCE = 0.55;
export const ORB_INVULN_DURATION_MS = 5000;
export const ORB_SPEED_BOOST_DURATION_MS = 5000;
export const ORB_DOUBLE_POINTS_DURATION_MS = 8000;
export const ORB_SPEED_MULTIPLIER = 1.6;
export const ORB_POINTS_MULTIPLIER = 2;

import type { GameRng } from "./rng";

export function randomOrbPowerUpType(rng: GameRng): OrbPowerUpType {
  const index = Math.floor(rng.next() * ORB_POWER_UP_TYPES.length);
  return ORB_POWER_UP_TYPES[index];
}

export function getOrbPowerUpDurationMs(type: OrbPowerUpType) {
  switch (type) {
    case "doublePoints":
      return ORB_DOUBLE_POINTS_DURATION_MS;
    case "invulnerability":
      return ORB_INVULN_DURATION_MS;
    case "speedBoost":
      return ORB_SPEED_BOOST_DURATION_MS;
  }
}
