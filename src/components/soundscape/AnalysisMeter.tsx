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

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest px-1">
        <span className="text-white/40">{label}</span>
        {showValue && <span className="text-white/60 text-pop">{percentage}%</span>}
      </div>
      <div className="h-1.5 glass bg-black/40 rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.2)]"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(to right, ${color}cc, ${color})`,
            boxShadow: `0 0 15px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}

export function AnalysisMeter({ analysis, parameters, compact = false }: AnalysisMeterProps) {
  const derived = analysis?.derived;
  const beat = analysis?.beat;

  // Compact mode for dock
  if (compact) {
    return (
      <div className="flex items-center gap-4">
        {/* Mini meters */}
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-scope-purple/70 font-medium uppercase">E</span>
            <div className="w-16 h-1.5 glass bg-white/5 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-scope-purple rounded-full transition-all duration-150"
                style={{
                  width: `${Math.round((derived?.energy ?? 0) * 100)}%`,
                  boxShadow: derived?.energy && derived.energy > 0.3 ? '0 0 8px rgba(139,92,246,0.5)' : 'none'
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-scope-cyan/70 font-medium uppercase">B</span>
            <div className="w-16 h-1.5 glass bg-white/5 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-scope-cyan rounded-full transition-all duration-150"
                style={{
                  width: `${Math.round((derived?.brightness ?? 0) * 100)}%`,
                  boxShadow: derived?.brightness && derived.brightness > 0.3 ? '0 0 8px rgba(6,182,212,0.5)' : 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* BPM */}
        <div className="flex items-center gap-2 glass bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
          <div className={`w-2 h-2 rounded-full transition-all duration-150 ${beat?.isBeat ? "bg-scope-magenta shadow-[0_0_8px_rgba(236,72,153,0.6)]" : "bg-white/20"}`} />
          <span className="text-sm text-white/80 font-semibold tabular-nums">{beat?.bpm ?? "--"}</span>
          <span className="text-[9px] text-white/40 uppercase">bpm</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Audio Analysis Section */}
      <div className="space-y-6">
        <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] px-1">
          Spectral Data
        </h4>
        <div className="space-y-6">
          <MeterBar
            label="Energy"
            value={derived?.energy ?? 0}
            color="#A855F7" // Purple
          />
          <MeterBar
            label="Brightness"
            value={derived?.brightness ?? 0}
            color="#06B6D4" // Cyan
          />
          <MeterBar
            label="Texture"
            value={derived?.texture ?? 0}
            color="#EC4899" // Magenta
          />
        </div>
      </div>

      {/* Beat Detection Section */}
      <div className="space-y-6">
        <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] px-1">
          Temporal Sync
        </h4>
        <div className="flex items-center gap-6 glass bg-white/5 p-5 rounded-[2rem] border border-white/5 group">
          {/* Beat Indicator */}
          <div className="relative">
            <div
              className={`
                w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center text-xl
                ${beat?.isBeat ? "bg-scope-magenta shadow-[0_0_30px_rgba(236,72,153,0.6)] scale-110" : "bg-white/5 text-white/10"}
              `}
              aria-label={beat?.isBeat ? "Beat detected" : "No beat"}
            >
              {beat?.isBeat ? "⚡" : "•"}
            </div>
            {beat?.isBeat && (
              <div className="absolute inset-0 rounded-full border-2 border-scope-magenta animate-ping opacity-40 scale-150" />
            )}
          </div>

          {/* BPM Display */}
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tighter text-pop">
                {beat?.bpm ?? "--"}
              </span>
              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">BPM</span>
            </div>
            {beat?.confidence !== undefined && beat.confidence > 0 && (
              <div className="text-[9px] font-bold text-white/10 uppercase tracking-widest">
                Accuracy: {Math.round(beat.confidence * 100)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scope Parameters Section */}
      {parameters && (
        <div className="space-y-6">
          <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] px-1">
            Engine Config
          </h4>
          <div className="space-y-6">
            <MeterBar
              label="Diffusion Noise"
              value={parameters.noiseScale}
              color="#F59E0B" // Amber
            />
          </div>

          {/* Denoising Steps */}
          <div className="pt-2 px-1 flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Denoising Latency</span>
            <span className="text-[10px] font-bold text-white/40 tabular-nums tracking-tighter">
              [{parameters.denoisingSteps.join(", ")}]
            </span>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!analysis && (
        <div className="text-center py-12 glass bg-white/5 rounded-[2rem] border border-white/5 border-dashed">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/10">Awaiting Signal Ingest</p>
        </div>
      )}
    </div>
  );
}
