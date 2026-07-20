import Phaser from "phaser";

/** Display-pixel radius of the visible player character (not the full 64×64 frame). */
export const PLAYER_VISUAL_RADIUS = 11;

/** Matches the drawn defender circle texture radius. */
export const DEFENDER_VISUAL_RADIUS = 20;

export function getBallVisualRadius(ballDisplaySize: number) {
  return ballDisplaySize / 2;
}

export function circlesOverlap(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
) {
  return Phaser.Math.Distance.Between(x1, y1, x2, y2) <= r1 + r2;
}

export function circlesGap(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
) {
  return Phaser.Math.Distance.Between(x1, y1, x2, y2) - (r1 + r2);
}
