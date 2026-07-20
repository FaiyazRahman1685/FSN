"use client";

import { useEffect, useRef } from "react";

export const BACKGROUND_MUSIC_SRC = "/sounds/background-song.mp3";

export function useBackgroundMusic(isPlaying: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(BACKGROUND_MUSIC_SRC);
    audio.loop = true;
    audio.volume = 0.45;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

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
