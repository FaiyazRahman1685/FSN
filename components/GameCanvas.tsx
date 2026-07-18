"use client";

import { useEffect, useRef } from "react";
import { GAME_HEIGHT, GAME_WIDTH } from "@/game/constants";
import type { GameCallbacks } from "@/game/events";
import type { SessionSettings } from "@/game/playMode";

type GameCanvasProps = GameCallbacks & {
  sessionId: number;
  settings: SessionSettings;
};

export default function GameCanvas({
  sessionId,
  settings,
  onTick,
  onGameOver,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTickRef = useRef(onTick);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    onTickRef.current = onTick;
    onGameOverRef.current = onGameOver;
  }, [onTick, onGameOver]);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    let game: import("phaser").Game | null = null;
    let cancelled = false;

    const callbacks: GameCallbacks = {
      onTick: (seconds) => onTickRef.current(seconds),
      onGameOver: (seconds) => onGameOverRef.current(seconds),
    };

    (async () => {
      const Phaser = (await import("phaser")).default;
      const { createGameConfig } = await import("@/game/config");
      if (cancelled || !containerRef.current) return;

      parent.replaceChildren();
      game = new Phaser.Game(createGameConfig(parent, callbacks, settings));
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
      game = null;
      parent.replaceChildren();
    };
  }, [sessionId, settings]);

  return (
    <div
      ref={containerRef}
      className="game-canvas"
      style={{ width: GAME_WIDTH, height: GAME_HEIGHT, maxWidth: "100%" }}
    />
  );
}
