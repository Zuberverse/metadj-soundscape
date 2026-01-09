/**
 * Aspect Ratio Toggle Component
 * Switch between 16:9 widescreen and 9:16 portrait modes
 */

"use client";

import { AspectRatioConfig, ASPECT_PRESETS } from "@/lib/soundscape";

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
  const isWidescreen = current.mode === "16:9";

  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label="Output format">
      {/* Widescreen Option */}
      <button
        type="button"
        role="radio"
        aria-checked={isWidescreen}
        onClick={() => onChange(ASPECT_PRESETS.widescreen)}
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
        onClick={() => onChange(ASPECT_PRESETS.portrait)}
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
  );
}
