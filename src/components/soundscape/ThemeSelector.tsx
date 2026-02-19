/**
 * Theme Selector Component
 * Visual theme selection for Soundscape with color-coded indicators
 */

"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import type { Theme, CustomThemeInput, ReactivityPreset, BeatResponse } from "@/lib/soundscape";

/**
 * Color accents per theme for visual differentiation.
 * Maps theme IDs to a gradient pair (from, to) used for the indicator dot and active ring.
 */
const THEME_ACCENTS: Record<string, { from: string; to: string }> = {
  "cosmic-voyage": { from: "#8B5CF6", to: "#06B6D4" },
  "neon-foundry": { from: "#8B5CF6", to: "#EC4899" },
  "digital-forest": { from: "#10B981", to: "#06B6D4" },
  "synthwave-highway": { from: "#EC4899", to: "#F59E0B" },
  "crystal-sanctuary": { from: "#8B5CF6", to: "#A855F7" },
  "ocean-depths": { from: "#06B6D4", to: "#3B82F6" },
  "cyber-city": { from: "#06B6D4", to: "#EC4899" },
  "aurora-dreams": { from: "#10B981", to: "#8B5CF6" },
  "8-bit-adventure": { from: "#F59E0B", to: "#EC4899" },
  "volcanic-forge": { from: "#EF4444", to: "#F59E0B" },
  "quantum-realm": { from: "#3B82F6", to: "#8B5CF6" },
  "neon-tokyo": { from: "#EC4899", to: "#06B6D4" },
};

const DEFAULT_ACCENT = { from: "#8B5CF6", to: "#06B6D4" };

/**
 * Props for the ThemeSelector component.
 */
interface ThemeSelectorProps {
  /** Array of available preset themes */
  themes: Theme[];
  /** Currently active theme, or null if none selected */
  currentTheme: Theme | null;
  /**
   * Callback fired when user selects a theme.
   * Receives either a preset theme ID string or a CustomThemeInput object.
   */
  onThemeChange: (themeIdOrInput: string | CustomThemeInput) => void;
  /** Disable all interactions (default: false) */
  disabled?: boolean;
  /** Use compact dock layout instead of full grid (default: false) */
  compact?: boolean;
}

export function ThemeSelector({
  themes,
  currentTheme,
  onThemeChange,
  disabled = false,
  compact = false,
}: ThemeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [reactivity, setReactivity] = useState<ReactivityPreset>("balanced");
  const [beatResponse, setBeatResponse] = useState<BeatResponse>("pulse");

  const handlePresetSelect = useCallback(
    (themeId: string) => {
      onThemeChange(themeId);
      setShowCustom(false);
    },
    [onThemeChange]
  );

  const handleCustomApply = useCallback(() => {
    if (!customPrompt.trim()) return;

    const customInput: CustomThemeInput = {
      prompt: customPrompt,
      reactivity,
      beatResponse,
    };
    onThemeChange(customInput);
  }, [customPrompt, reactivity, beatResponse, onThemeChange]);

  const handleThemeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || themes.length === 0) {
        return;
      }

      let targetIndex: number | null = null;
      const currentIndex = themes.findIndex((theme) => theme.id === currentTheme?.id);

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          targetIndex = currentIndex >= 0 ? (currentIndex + 1) % themes.length : 0;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          targetIndex = currentIndex >= 0 ? (currentIndex - 1 + themes.length) % themes.length : 0;
          break;
        case "Home":
          targetIndex = 0;
          break;
        case "End":
          targetIndex = themes.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const nextTheme = themes[targetIndex];
      if (nextTheme) {
        handlePresetSelect(nextTheme.id);
      }
    },
    [currentTheme?.id, disabled, handlePresetSelect, themes]
  );

  // Compact mode for dock -- horizontal scrollable strip with color indicators
  if (compact) {
    return (
      <div className="relative group">
        <div
          className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 pr-8"
          role="radiogroup"
          aria-label="Visual themes"
          onKeyDown={handleThemeKeyDown}
        >
          {themes.map((theme, index) => {
            const isActive = currentTheme?.id === theme.id;
            const accent = THEME_ACCENTS[theme.id] ?? DEFAULT_ACCENT;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handlePresetSelect(theme.id)}
                disabled={disabled}
                role="radio"
                aria-checked={isActive}
                aria-label={`${theme.name} theme${isActive ? " (active)" : ""}`}
                tabIndex={isActive || (!currentTheme && index === 0) ? 0 : -1}
                className={`
                  flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg text-[10px] font-semibold whitespace-nowrap
                  transition-colors duration-300
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black
                  ${isActive
                    ? "bg-white/12 text-white border border-white/20"
                    : "bg-white/5 text-white/55 border border-transparent hover:bg-white/8 hover:text-white/75"}
                  ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                {/* Color indicator dot */}
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-50"}`}
                  style={{
                    background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                    boxShadow: isActive ? `0 0 6px ${accent.from}66` : "none",
                  }}
                  aria-hidden="true"
                />
                {theme.name}
              </button>
            );
          })}
        </div>
        {/* Scroll affordance - fade gradient */}
        <div 
          className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-scope-bg to-transparent pointer-events-none opacity-100 group-hover:opacity-0 transition-opacity duration-300"
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preset Themes Grid */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 px-1 mb-4">Visual Environment</h3>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-fade-in-stagger"
          role="radiogroup"
          aria-label="Visual themes"
          onKeyDown={handleThemeKeyDown}
        >
          {themes.map((theme, index) => {
            const isActive = currentTheme?.id === theme.id;
            const accent = THEME_ACCENTS[theme.id] ?? DEFAULT_ACCENT;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handlePresetSelect(theme.id)}
                disabled={disabled}
                role="radio"
                aria-checked={isActive}
                tabIndex={isActive || (!currentTheme && index === 0) ? 0 : -1}
                className={`
                  relative p-4 rounded-xl text-left transition-colors duration-300 group
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black
                  ${isActive
                    ? "glass bg-white/10 border-white/20"
                    : "glass bg-white/[0.03] border-white/5 hover:bg-white/8 hover:border-white/12"}
                  ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                {/* Active indicator bar at top */}
                <div
                  className={`absolute top-0 left-3 right-3 h-0.5 rounded-b-full transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-0"}`}
                  style={{ background: `linear-gradient(to right, ${accent.from}, ${accent.to})` }}
                  aria-hidden="true"
                />

                <div className="flex items-start gap-2.5">
                  {/* Color indicator */}
                  <span
                    className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`}
                    style={{
                      background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                      boxShadow: isActive ? `0 0 8px ${accent.from}55` : "none",
                    }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <span className="block font-semibold text-white text-xs tracking-tight mb-0.5 truncate">{theme.name}</span>
                    <span className="block text-[10px] text-white/45 truncate leading-snug">
                      {theme.description}
                    </span>
                  </div>
                </div>

                {/* Keyboard shortcut hint */}
                {index < 9 && (
                  <span
                    className="absolute top-2 right-2.5 text-[9px] text-white/45 font-mono tabular-nums"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom Theme Button */}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          disabled={disabled}
          aria-pressed={showCustom}
          aria-expanded={showCustom}
          aria-controls="custom-theme-panel"
          className={`
            mt-2 w-full p-4 rounded-xl text-left transition-colors duration-300 group
            focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black
            ${showCustom
              ? "glass bg-scope-cyan/10 border-scope-cyan/30"
              : "glass bg-white/[0.03] border-dashed border-white/15 hover:border-scope-cyan/30 hover:bg-white/5"}
            ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          <span className="block font-semibold text-white text-xs tracking-tight mb-0.5">Custom Theme</span>
          <span className="block text-[10px] text-white/45">Define your own visual world</span>
        </button>
      </div>

      {/* Custom Theme Panel */}
      {showCustom && (
        <div
          id="custom-theme-panel"
          className="glass bg-white/[0.03] rounded-xl p-5 space-y-5 border border-white/10 animate-fade-in"
        >
          <div className="space-y-2">
            <label
              htmlFor="custom-prompt"
              className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40"
            >
              Visual Descriptor
            </label>
            <textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe the visual world you want to see..."
              disabled={disabled}
              className="w-full px-4 py-3 glass bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-scope-cyan/40 transition-colors duration-300"
              rows={3}
            />
          </div>

          {/* Reactivity Selector */}
          <fieldset className="space-y-2">
            <legend className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              Reactivity
            </legend>
            <div className="flex gap-1.5" role="group">
              {(["subtle", "balanced", "intense", "chaotic"] as ReactivityPreset[]).map(
                (preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReactivity(preset)}
                    disabled={disabled}
                    aria-pressed={reactivity === preset}
                    className={`
                      flex-1 py-2.5 px-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black
                      ${reactivity === preset
                        ? "bg-scope-purple/25 text-white border border-scope-purple/40"
                        : "glass bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/70 border border-transparent"}
                      ${disabled ? "opacity-30 cursor-not-allowed" : ""}
                    `}
                  >
                    {preset}
                  </button>
                )
              )}
            </div>
          </fieldset>

          {/* Beat Response Selector */}
          <fieldset className="space-y-2">
            <legend className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              Beat Response
            </legend>
            <div className="flex gap-1.5" role="group">
              {(["none", "pulse", "shift", "burst"] as BeatResponse[]).map((response) => (
                <button
                  key={response}
                  type="button"
                  onClick={() => setBeatResponse(response)}
                  disabled={disabled}
                  aria-pressed={beatResponse === response}
                  className={`
                    flex-1 py-2.5 px-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black
                    ${beatResponse === response
                      ? "bg-scope-cyan/20 text-scope-cyan border border-scope-cyan/35"
                      : "glass bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/70 border border-transparent"}
                    ${disabled ? "opacity-30 cursor-not-allowed" : ""}
                  `}
                >
                  {response}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Apply Button */}
          <button
            type="button"
            onClick={handleCustomApply}
            disabled={disabled || !customPrompt.trim()}
            className={`
              w-full py-3.5 rounded-xl font-semibold uppercase tracking-[0.2em] text-[11px] transition-colors duration-300
              focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black
              ${disabled || !customPrompt.trim()
                ? "bg-white/5 text-white/30 cursor-not-allowed border border-white/5"
                : "bg-scope-cyan/15 hover:bg-scope-cyan/25 text-scope-cyan border border-scope-cyan/30"}
            `}
          >
            Apply Custom Theme
          </button>
        </div>
      )}
    </div>
  );
}
