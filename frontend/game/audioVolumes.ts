const STORAGE_KEY = "pitch-runner-audio";

export const DEFAULT_MUSIC_VOLUME = 0.45;
export const DEFAULT_SFX_VOLUME = 0.7;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

let musicVolume = DEFAULT_MUSIC_VOLUME;
let sfxVolume = DEFAULT_SFX_VOLUME;
let hydrated = false;

function persist() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ music: musicVolume, sfx: sfxVolume }),
  );
}

/** Load saved volumes once on the client (avoids SSR/hydration mismatch). */
export function hydrateAudioVolumes(): { music: number; sfx: number } {
  if (typeof window === "undefined") {
    return { music: musicVolume, sfx: sfxVolume };
  }

  if (!hydrated) {
    hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { music?: unknown; sfx?: unknown };
        if (typeof parsed.music === "number") {
          musicVolume = clamp01(parsed.music);
        }
        if (typeof parsed.sfx === "number") {
          sfxVolume = clamp01(parsed.sfx);
        }
      }
    } catch {
      // keep defaults
    }
  }

  return { music: musicVolume, sfx: sfxVolume };
}

export function getMusicVolume() {
  return musicVolume;
}

export function getSfxVolume() {
  return sfxVolume;
}

export function setMusicVolume(value: number) {
  musicVolume = clamp01(value);
  persist();
}

export function setSfxVolume(value: number) {
  sfxVolume = clamp01(value);
  persist();
}
