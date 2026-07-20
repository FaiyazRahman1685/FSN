"use client";

import { useEffect, useRef } from "react";
import { getMusicVolume } from "@/game/audioVolumes";

export const BACKGROUND_MUSIC_SRC = "/sounds/background-song.mp3";

export function useBackgroundMusic(isPlaying: boolean, volume: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(BACKGROUND_MUSIC_SRC);
    audio.loop = true;
    audio.volume = getMusicVolume();
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.min(1, Math.max(0, volume));
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Browsers may block autoplay without a user gesture.
      });
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }, [isPlaying]);
}
