export type OrbPowerUpType = "doublePoints" | "invulnerability" | "speedBoost";

export const ORB_POWER_UP_TYPES: OrbPowerUpType[] = [
  "doublePoints",
  "invulnerability",
  "speedBoost",
];

export const ORB_COLORS: Record<OrbPowerUpType, number> = {
  doublePoints: 0xffd700,
  invulnerability: 0x22d3ee,
  speedBoost: 0xf97316,
};

export const ORB_LABELS: Record<OrbPowerUpType, string> = {
  doublePoints: "2x Points!",
  invulnerability: "Invulnerable!",
  speedBoost: "Speed boost!",
};

export const ORB_RADIUS = 8;
export const ORB_SPAWN_INTERVAL_MS = 3200;
export const ORB_SPAWN_CHANCE = 0.55;
export const ORB_INVULN_DURATION_MS = 5000;
export const ORB_SPEED_BOOST_DURATION_MS = 5000;
export const ORB_DOUBLE_POINTS_DURATION_MS = 8000;
export const ORB_SPEED_MULTIPLIER = 1.6;
export const ORB_POINTS_MULTIPLIER = 2;

export function randomOrbPowerUpType(): OrbPowerUpType {
  const index = Math.floor(Math.random() * ORB_POWER_UP_TYPES.length);
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
