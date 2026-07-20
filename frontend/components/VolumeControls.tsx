"use client";

type VolumeControlsProps = {
  musicVolume: number;
  sfxVolume: number;
  onMusicVolumeChange: (value: number) => void;
  onSfxVolumeChange: (value: number) => void;
};

export default function VolumeControls({
  musicVolume,
  sfxVolume,
  onMusicVolumeChange,
  onSfxVolumeChange,
}: VolumeControlsProps) {
  return (
    <div className="volume-controls" aria-label="Volume controls">
      <label className="volume-control">
        <span className="volume-control-label">Music</span>
        <input
          className="volume-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(musicVolume * 100)}
          onChange={(event) =>
            onMusicVolumeChange(Number(event.target.value) / 100)
          }
          aria-valuetext={`${Math.round(musicVolume * 100)}%`}
        />
      </label>
      <label className="volume-control">
        <span className="volume-control-label">SFX</span>
        <input
          className="volume-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(sfxVolume * 100)}
          onChange={(event) =>
            onSfxVolumeChange(Number(event.target.value) / 100)
          }
          aria-valuetext={`${Math.round(sfxVolume * 100)}%`}
        />
      </label>
    </div>
  );
}
