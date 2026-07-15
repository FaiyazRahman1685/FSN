import Phaser from "phaser";
import type { GameCallbacks } from "./events";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";
import { MainScene } from "./scenes/MainScene";

export function createGameConfig(
  parent: HTMLElement,
  callbacks: GameCallbacks,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    backgroundColor: "#2d8a4e",
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MainScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set("callbacks", callbacks);
      },
    },
  };
}
