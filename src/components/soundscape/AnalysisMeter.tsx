/**
 * Analysis Meter Component
 * Real-time visualization of audio analysis metrics
 */

"use client";

import type { AnalysisState, ScopeParameters } from "@/lib/soundscape";

/**
 * Props for the AnalysisMeter component.
 */
interface AnalysisMeterProps {
  /** Current audio analysis state from useSoundscape, or null if no audio */
  analysis: AnalysisState | null;
  /** Current Scope parameters being sent, or null if not connected */
  parameters: ScopeParameters | null;
  /** Use compact dock layout instead of full meters (default: false) */
  compact?: boolean;
}

/**
 * Props for the internal MeterBar component.
 */
interface MeterBarProps {
  /** Display label for the meter (e.g., "Energy") */
  label: string;
  /** Current value normalized 0-1 */
  value: number;
  /** CSS color for the meter fill (e.g., "#A855F7") */
  color: string;
  /** Show numeric percentage value (default: true) */
  showValue?: boolean;
}

function MeterBar({ label, value, color, showValue = true }: MeterBarProps) {
  const percentage = Math.round(value * 100);
  const meterId = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[10px] uppercase tracking-wider px-0.5" id={`${meterId}-label`}>
        <span className="text-white/50 font-medium">{label}</span>
        {showValue && <span className="text-white/70 tabular-nums font-semibold">{percentage}%</span>}
      </div>
      <div
        className="h-1.5 bg-white/5 rounded-full overflow-hidden"
        role="progressbar"
        aria-labelledby={`${meterId}-label`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(to right, ${color}99, ${color})`,
            boxShadow: value > 0.3 ? `0 0 8px ${color}44` : "none",
          }}
        />
      </div>
    </div>
  );
}

export function AnalysisMeter({ analysis, parameters, compact = false }: AnalysisMeterProps) {
  const derived = analysis?.derived;
  const beat = analysis?.beat;
  const compactEnergy = Math.round((derived?.energy ?? 0) * 100);
  const compactBrightness = Math.round((derived?.brightness ?? 0) * 100);

  // Compact mode for dock
  if (compact) {
    return (
      <div className="flex items-center gap-4">
        {/* Mini meters */}
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-scope-purple/70 font-semibold uppercase tracking-wide" aria-hidden="true">E</span>
            <div
              className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden"
              role="progressbar"
              aria-label="Energy level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={compactEnergy}
            >
              <div
                className="h-full bg-scope-purple rounded-full transition-all duration-150"
                style={{
                  width: `${compactEnergy}%`,
                  boxShadow: derived?.energy && derived.energy > 0.3 ? '0 0 6px rgba(139,92,246,0.4)' : 'none'
                }}
              />
            </div>
            <span className="sr-only">Energy {compactEnergy}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-scope-cyan/70 font-semibold uppercase tracking-wide" aria-hidden="true">B</span>
            <div
              className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden"
              role="progressbar"
              aria-label="Brightness level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={compactBrightness}
            >
              <div
                className="h-full bg-scope-cyan rounded-full transition-all duration-150"
                style={{
                  width: `${compactBrightness}%`,
                  boxShadow: derived?.brightness && derived.brightness > 0.3 ? '0 0 6px rgba(6,182,212,0.4)' : 'none'
                }}
              />
            </div>
            <span className="sr-only">Brightness {compactBrightness}%</span>
          </div>
        </div>

        {/* BPM */}
        <div
          className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/8"
          role="status"
          aria-live="polite"
          aria-label={`Tempo: ${beat?.bpm ?? "unknown"} BPM`}
        >
          <div
            className={`w-2 h-2 rounded-full transition-all duration-100 ${
              beat?.isBeat
                ? "bg-scope-magenta shadow-[0_0_6px_rgba(236,72,153,0.5)]"
                : "bg-white/15"
            }`}
            aria-hidden="true"
          />
          <span className="text-sm text-white/80 font-semibold tabular-nums">{beat?.bpm ?? "--"}</span>
          <span className="text-[9px] text-white/35 uppercase font-medium">bpm</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Audio Analysis Section */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.25em] px-0.5">
          Spectral Data
        </h4>
        <div className="space-y-4">
          <MeterBar
            label="Energy"
            value={derived?.energy ?? 0}
            color="#A855F7"
          />
          <MeterBar
            label="Brightness"
            value={derived?.brightness ?? 0}
            color="#06B6D4"
          />
          <MeterBar
            label="Texture"
            value={derived?.texture ?? 0}
            color="#EC4899"
          />
        </div>
      </div>

      {/* Beat Detection Section */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.25em] px-0.5">
          Tempo
        </h4>
        <div
          className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-xl border border-white/8"
          role="status"
          aria-live="polite"
          aria-label={`Tempo: ${beat?.bpm ?? "unknown"} BPM, confidence ${beat?.confidence ? Math.round(beat.confidence * 100) : 0}%`}
        >
          {/* Beat Indicator */}
          <div className="relative flex-shrink-0">
            <div
              className={`
                w-10 h-10 rounded-full transition-all duration-150 flex items-center justify-center
                ${beat?.isBeat
                  ? "bg-scope-magenta/30 shadow-[0_0_16px_rgba(236,72,153,0.4)]"
                  : "bg-white/5"}
              `}
              aria-hidden="true"
            >
              <div
                className={`w-3 h-3 rounded-full transition-all duration-100 ${
                  beat?.isBeat ? "bg-scope-magenta" : "bg-white/15"
                }`}
              />
            </div>
          </div>

          {/* BPM Display */}
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white tracking-tight tabular-nums">
                {beat?.bpm ?? "--"}
              </span>
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">BPM</span>
            </div>
            {beat?.confidence !== undefined && beat.confidence > 0 && (
              <div className="text-[10px] font-medium text-white/35 uppercase tracking-wider">
                Confidence: {Math.round(beat.confidence * 100)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scope Parameters Section */}
      {parameters && (
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.25em] px-0.5">
            Engine Output
          </h4>
          <MeterBar
            label="Noise Scale"
            value={parameters.noiseScale}
            color="#F59E0B"
          />
          <div className="flex justify-between items-center text-[10px] px-0.5">
            <span className="text-white/40 uppercase tracking-wider font-medium">Denoising Steps</span>
            <span className="text-white/60 tabular-nums font-mono text-[11px]">
              [{parameters.denoisingSteps.join(", ")}]
            </span>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!analysis && (
        <div className="text-center py-10 bg-white/[0.02] rounded-xl border border-dashed border-white/8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/30">Awaiting Audio Input</p>
          <p className="text-[9px] text-white/20 mt-1">Play a track or enable microphone</p>
        </div>
      )}
    </div>
  );
}
