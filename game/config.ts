import Phaser from "phaser";
import type { GameCallbacks } from "./events";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";
import type { SessionSettings } from "./playMode";
import { MainScene } from "./scenes/MainScene";

export function createGameConfig(
  parent: HTMLElement,
  callbacks: GameCallbacks,
  settings: SessionSettings,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    backgroundColor: "#2d8a4e",
    // Crisp pixel art — stops smoothed sampling that looks like ghosting while animating
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
    },
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
        game.registry.set("settings", settings);
      },
    },
  };
}
