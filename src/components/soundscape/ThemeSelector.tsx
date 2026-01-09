/**
 * Theme Selector Component
 * Visual theme selection for Soundscape
 */

"use client";

import { useState, useCallback } from "react";
import type { Theme, CustomThemeInput, ReactivityPreset, BeatResponse } from "@/lib/soundscape";

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

  // Compact mode for dock
  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Visual themes">
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => handlePresetSelect(theme.id)}
            disabled={disabled}
            aria-pressed={currentTheme?.id === theme.id}
            className={`
              px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all duration-300
              focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black
              ${currentTheme?.id === theme.id
                ? "glass bg-scope-purple/30 text-white border border-scope-purple/50 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                : "glass bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:border-scope-purple/30"}
            `}
          >
            {theme.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Preset Themes Grid */}
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 px-1 mb-6">Visual Environment</h3>
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Visual themes">
          {themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => handlePresetSelect(theme.id)}
              disabled={disabled}
              aria-pressed={currentTheme?.id === theme.id}
              className={`
                p-5 rounded-2xl text-left transition-all duration-500 hover:scale-[1.03] active:scale-95 group
                focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black
                ${currentTheme?.id === theme.id
                  ? "glass bg-scope-purple/20 border-scope-purple/40 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                  : "glass bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10"}
                ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <span className="block font-bold text-white uppercase tracking-tighter text-sm mb-1 group-hover:text-pop transition-all">{theme.name}</span>
              <span className="block text-[10px] text-white/30 truncate font-medium">
                {theme.description}
              </span>
            </button>
          ))}

          {/* Custom Theme Button */}
          <button
            type="button"
            onClick={() => setShowCustom(!showCustom)}
            disabled={disabled}
            aria-pressed={showCustom}
            aria-expanded={showCustom}
            className={`
              p-5 rounded-2xl text-left transition-all duration-500 hover:scale-[1.03] active:scale-95 group
              focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black
              ${showCustom
                ? "glass bg-scope-cyan/20 border-scope-cyan/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                : "glass bg-white/5 border-dashed border-white/20 hover:border-scope-cyan/40"}
              ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            <span className="block font-bold text-white uppercase tracking-tighter text-sm mb-1 group-hover:text-pop transition-all">✨ Custom</span>
            <span className="block text-[10px] text-white/30 truncate font-medium">Inject unique vision</span>
          </button>
        </div>
      </div>

      {/* Custom Theme Panel */}
      {showCustom && (
        <div className="glass-radiant bg-black/40 rounded-[2rem] p-6 space-y-6 border-white/5 animate-scale-in">
          <div className="space-y-3">
            <label
              htmlFor="custom-prompt"
              className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 px-1"
            >
              Visual Descriptor
            </label>
            <textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Inject spectral seed..."
              disabled={disabled}
              className="w-full px-4 py-3 glass bg-black/40 border border-white/5 rounded-2xl text-sm text-white placeholder:text-white/10 resize-none focus:outline-none focus:border-scope-cyan/40 transition-all duration-300"
              rows={3}
            />
          </div>

          {/* Reactivity Selector */}
          <div className="space-y-4">
            <label id="reactivity-label" className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 px-1">
              Neural Sensitivity
            </label>
            <div className="flex gap-2" role="group" aria-labelledby="reactivity-label">
              {(["subtle", "balanced", "intense", "chaotic"] as ReactivityPreset[]).map(
                (preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReactivity(preset)}
                    disabled={disabled}
                    aria-pressed={reactivity === preset}
                    className={`
                      flex-1 py-3 px-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-500
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black
                      ${reactivity === preset
                        ? "bg-scope-purple text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                        : "glass bg-white/5 text-white/20 hover:bg-white/10 hover:text-white"}
                      ${disabled ? "opacity-30 cursor-not-allowed" : ""}
                    `}
                  >
                    {preset}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Beat Response Selector */}
          <div className="space-y-4">
            <label id="beat-response-label" className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 px-1">
              Temporal Response
            </label>
            <div className="flex gap-2" role="group" aria-labelledby="beat-response-label">
              {(["none", "pulse", "shift", "burst"] as BeatResponse[]).map((response) => (
                <button
                  key={response}
                  type="button"
                  onClick={() => setBeatResponse(response)}
                  disabled={disabled}
                  aria-pressed={beatResponse === response}
                  className={`
                      flex-1 py-3 px-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-500
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black
                    ${beatResponse === response
                      ? "bg-scope-cyan text-black shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                      : "glass bg-white/5 text-white/20 hover:bg-white/10 hover:text-white"}
                    ${disabled ? "opacity-30 cursor-not-allowed" : ""}
                  `}
                >
                  {response}
                </button>
              ))}
            </div>
          </div>

          {/* Apply Button */}
          <button
            type="button"
            onClick={handleCustomApply}
            disabled={disabled || !customPrompt.trim()}
            className={`
              w-full py-4 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px] transition-all duration-500 shadow-xl
              focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black
              ${disabled || !customPrompt.trim()
                ? "bg-white/5 text-white/10 cursor-not-allowed"
                : "glass-radiant bg-scope-cyan/20 hover:bg-scope-cyan text-white/80 hover:text-white hover:scale-[1.02] active:scale-95"}
            `}
          >
            Apply Custom Protocol
          </button>
        </div>
      )}
    </div>
  );
}
