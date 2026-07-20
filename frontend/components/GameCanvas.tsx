"use client";

import { useEffect, useRef } from "react";
import { GAME_HEIGHT, GAME_WIDTH } from "@/game/constants";
import type { GameCallbacks } from "@/game/events";
import type { SessionSettings } from "@/game/playMode";
import { InputSyncBridge } from "@/game/network/inputSync";
import type { InputKeys } from "@/game/network/api";

type GameCanvasProps = GameCallbacks & {
  sessionId: number;
  settings: SessionSettings;
  inputSyncBridge?: InputSyncBridge | null;
  onInputSend?: (tick: number, keys: InputKeys) => void;
};

export default function GameCanvas({
  sessionId,
  settings,
  inputSyncBridge,
  onInputSend,
  onTick,
  onScoreChange,
  onGameOver,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTickRef = useRef(onTick);
  const onScoreChangeRef = useRef(onScoreChange);
  const onGameOverRef = useRef(onGameOver);
  const bridgeRef = useRef(inputSyncBridge);
  const settingsRef = useRef(settings);

  useEffect(() => {
    onTickRef.current = onTick;
    onScoreChangeRef.current = onScoreChange;
    onGameOverRef.current = onGameOver;
  }, [onTick, onScoreChange, onGameOver]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    bridgeRef.current = inputSyncBridge ?? null;
    if (inputSyncBridge && onInputSend) {
      inputSyncBridge.setSender(onInputSend);
    }
  }, [inputSyncBridge, onInputSend]);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    let game: import("phaser").Game | null = null;
    let cancelled = false;

    const callbacks: GameCallbacks = {
      onTick: (seconds) => onTickRef.current(seconds),
      onScoreChange: (score) => onScoreChangeRef.current(score),
      onGameOver: (result) => onGameOverRef.current(result),
    };

    (async () => {
      const Phaser = (await import("phaser")).default;
      const { createGameConfig } = await import("@/game/config");
      if (cancelled || !containerRef.current) return;

      parent.replaceChildren();
      game = new Phaser.Game(
        createGameConfig(
          parent,
          callbacks,
          settingsRef.current,
          bridgeRef.current ?? undefined,
        ),
      );
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
      game = null;
      parent.replaceChildren();
    };
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      className="game-canvas"
      style={{ width: GAME_WIDTH, height: GAME_HEIGHT, maxWidth: "100%" }}
    />
  );
}
