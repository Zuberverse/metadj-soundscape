/**
 * Aspect Ratio Toggle Component
 * Switch between output formats and resolution tiers
 */

"use client";

import {
  ASPECT_RESOLUTION_PRESETS,
  type AspectRatioConfig,
  type AspectRatioMode,
} from "@/lib/soundscape";
import type { KeyboardEvent } from "react";

/**
 * Props for the AspectRatioToggle component.
 */
interface AspectRatioToggleProps {
  /** Currently selected aspect ratio configuration */
  current: AspectRatioConfig;
  /**
   * Callback fired when aspect ratio selection changes.
   * Note: Must be set before connecting to Scope (cannot change mid-session).
   */
  onChange: (config: AspectRatioConfig) => void;
  /** Disable selection (e.g., when connected) */
  disabled?: boolean;
}

export function AspectRatioToggle({
  current,
  onChange,
  disabled = false,
}: AspectRatioToggleProps) {
  const matchesConfig = (left: AspectRatioConfig, right: AspectRatioConfig) =>
    left.mode === right.mode &&
    left.resolution.width === right.resolution.width &&
    left.resolution.height === right.resolution.height;

  const getPresetIndex = (mode: AspectRatioMode, config: AspectRatioConfig): number => {
    const presets = ASPECT_RESOLUTION_PRESETS[mode];
    const index = presets.findIndex((preset) => matchesConfig(preset.config, config));
    return index >= 0 ? index : 0;
  };

  const handleModeChange = (mode: AspectRatioMode) => {
    if (disabled || mode === current.mode) return;
    const currentIndex = getPresetIndex(current.mode, current);
    const targetPresets = ASPECT_RESOLUTION_PRESETS[mode];
    const targetPreset =
      targetPresets[Math.min(currentIndex, targetPresets.length - 1)] ?? targetPresets[0];
    if (targetPreset) {
      onChange(targetPreset.config);
    }
  };

  const isWidescreen = current.mode === "16:9";
  const activeResolutionPresets = ASPECT_RESOLUTION_PRESETS[current.mode];

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      handleModeChange("16:9");
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      handleModeChange("9:16");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2" role="radiogroup" aria-label="Output format">
        {/* Widescreen Option */}
        <button
          type="button"
          role="radio"
          aria-checked={isWidescreen}
          tabIndex={isWidescreen ? 0 : -1}
          onClick={() => handleModeChange("16:9")}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300
            ${disabled ? "cursor-not-allowed opacity-50" : ""}
            ${isWidescreen
              ? "glass bg-scope-cyan/20 border-scope-cyan/40 text-scope-cyan"
              : "glass bg-white/5 border-white/20 text-white/50 hover:border-white/40 hover:text-white/70"
            }
          `}
        >
          {/* Widescreen Icon */}
          <div
            className={`
              w-6 h-4 border-2 rounded transition-all duration-300
              ${isWidescreen ? "border-scope-cyan" : "border-current"}
            `}
          />
          <span className="text-xs font-medium tracking-wide">16:9</span>
        </button>

        {/* Portrait Option */}
        <button
          type="button"
          role="radio"
          aria-checked={!isWidescreen}
          tabIndex={!isWidescreen ? 0 : -1}
          onClick={() => handleModeChange("9:16")}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300
            ${disabled ? "cursor-not-allowed opacity-50" : ""}
            ${!isWidescreen
              ? "glass bg-scope-cyan/20 border-scope-cyan/40 text-scope-cyan"
              : "glass bg-white/5 border-white/20 text-white/50 hover:border-white/40 hover:text-white/70"
            }
          `}
        >
          {/* Portrait Icon */}
          <div
            className={`
              w-4 h-6 border-2 rounded transition-all duration-300
              ${!isWidescreen ? "border-scope-cyan" : "border-current"}
            `}
          />
          <span className="text-xs font-medium tracking-wide">9:16</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={`${current.mode} resolution tiers`}>
        {activeResolutionPresets.map((preset) => {
          const isActive = matchesConfig(current, preset.config);
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(preset.config)}
              disabled={disabled}
              className={`
                rounded-lg border px-3 py-2 text-left transition-all duration-300
                ${disabled ? "cursor-not-allowed opacity-50" : ""}
                ${isActive
                  ? "glass bg-scope-cyan/20 border-scope-cyan/40 text-scope-cyan"
                  : "glass bg-white/5 border-white/20 text-white/50 hover:border-white/40 hover:text-white/80"
                }
              `}
            >
              <span className="block text-[10px] uppercase tracking-widest font-bold">
                {preset.label}
              </span>
              <span className="block text-[11px] font-mono mt-1">
                {preset.config.resolution.width}x{preset.config.resolution.height}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
