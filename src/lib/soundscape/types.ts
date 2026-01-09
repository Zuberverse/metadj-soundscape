/**
 * Soundscape Type Definitions
 * Core types for audio-reactive visual generation
 */

// ============================================================================
// Audio Analysis Types
// ============================================================================

export interface AudioFeatures {
  /** Root Mean Square - overall energy/loudness (0-1) */
  rms: number;
  /** Spectral Centroid - brightness/mood indicator (Hz) */
  spectralCentroid: number;
  /** Spectral Flatness - noisiness vs tonality (0-1) */
  spectralFlatness: number;
  /** Spectral Rolloff - high frequency content threshold (Hz) */
  spectralRolloff: number;
  /** Zero Crossing Rate - percussiveness indicator */
  zcr: number;
}

export interface BeatInfo {
  /** Detected BPM (null if not yet stable) */
  bpm: number | null;
  /** Confidence level of BPM detection (0-1) */
  confidence: number;
  /** Timestamp of last detected beat */
  lastBeatTime: number;
  /** Whether a beat just occurred this frame */
  isBeat: boolean;
}

export interface AnalysisState {
  /** Current frame's audio features */
  features: AudioFeatures;
  /** Beat detection state */
  beat: BeatInfo;
  /** Derived metrics */
  derived: {
    /** Normalized energy (0-1, calibrated to track) */
    energy: number;
    /** Normalized brightness (0-1) */
    brightness: number;
    /** Normalized texture/noisiness (0-1) */
    texture: number;
    /** Energy rate of change (-1 to 1) */
    energyDerivative: number;
    /** Recent peak energy for normalization */
    peakEnergy: number;
  };
}

// ============================================================================
// Theme System Types
// ============================================================================

export type MappingCurve = "linear" | "exponential" | "logarithmic" | "stepped";

export type MappingParameter =
  | "noiseScale"
  | "denoisingSteps"
  | "promptWeight"
  | "transitionSpeed";

export type BeatAction =
  | "pulse_noise"
  | "prompt_cycle"
  | "cache_reset"
  | "transition_trigger";

export interface MappingTarget {
  /** Which Scope parameter to affect */
  parameter: MappingParameter;
  /** Response curve shape */
  curve: MappingCurve;
  /** Sensitivity multiplier (0.0 to 2.0) */
  sensitivity: number;
  /** Invert the mapping (high audio = low param) */
  invert: boolean;
}

export interface BeatMapping {
  /** Enable beat-triggered effects */
  enabled: boolean;
  /** What happens on beat */
  action: BeatAction;
  /** Effect intensity (0.0 to 1.0) */
  intensity: number;
  /** Minimum ms between triggers */
  cooldownMs?: number;
}

export interface PromptVariation {
  /** What triggers the variation */
  trigger: "beat" | "energy_spike" | "section";
  /** Alternative prompts to cycle through */
  prompts: string[];
  /** Frames to blend between prompts */
  blendDuration: number;
}

export interface ThemeRanges {
  /** Denoising step arrays: min (fast) to max (quality) */
  denoisingSteps: { min: number[]; max: number[] };
  /** Noise scale range */
  noiseScale: { min: number; max: number };
  /** Prompt transition speed (frames) */
  transitionSpeed: { min: number; max: number };
}

export interface ThemeMappings {
  /** How energy (loudness) affects visuals */
  energy: MappingTarget[];
  /** How brightness (spectral centroid) affects visuals */
  brightness: MappingTarget[];
  /** How texture (spectral flatness) affects visuals */
  texture: MappingTarget[];
  /** Beat-triggered effects */
  beats: BeatMapping;
}

export interface Theme {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Brief description */
  description: string;

  /** Base prompt for generation */
  basePrompt: string;
  /** Style modifiers added to prompt */
  styleModifiers: string[];
  /** Negative prompt (what to avoid) */
  negativePrompt: string;

  /** Parameter value ranges */
  ranges: ThemeRanges;
  /** Audio-to-visual mappings */
  mappings: ThemeMappings;
  /** Optional prompt variations */
  promptVariations?: PromptVariation;
}

// ============================================================================
// Scope Parameter Types
// ============================================================================

export interface PromptEntry {
  text: string;
  weight: number;
}

export interface PromptTransition {
  target_prompts: PromptEntry[];
  num_steps: number;
  temporal_interpolation_method: "linear" | "slerp";
}

export interface ScopeParameters {
  /** Current prompts */
  prompts: PromptEntry[];
  /** Denoising step schedule */
  denoisingSteps: number[];
  /** Noise injection scale (0-1) */
  noiseScale: number;
  /** Prompt transition (if changing) - used for smooth visual blending */
  transition?: PromptTransition;
  /**
   * Force cache reset (one-shot)
   * @deprecated NEVER USE - causes hard visual cuts. Use smooth transitions instead.
   * Kept in type for backwards compatibility but MappingEngine never sets this.
   */
  resetCache?: boolean;
}

// ============================================================================
// Custom Theme Input (Simplified Creation)
// ============================================================================

export type ReactivityPreset = "subtle" | "balanced" | "intense" | "chaotic";
export type BeatResponse = "none" | "pulse" | "shift" | "burst";

export interface CustomThemeInput {
  /** Required: What do you want to see? */
  prompt: string;
  /** Optional: Style modifiers */
  style?: string[];
  /** Optional: How reactive to audio */
  reactivity?: ReactivityPreset;
  /** Optional: Beat behavior */
  beatResponse?: BeatResponse;
}

// ============================================================================
// Normalization Configuration
// ============================================================================

export interface NormalizationConfig {
  /** Expected maximum RMS energy */
  energyMax: number;
  /** Minimum spectral centroid (Hz) */
  spectralCentroidMin: number;
  /** Maximum spectral centroid (Hz) */
  spectralCentroidMax: number;
  /** Maximum spectral flatness */
  spectralFlatnessMax: number;
}

export const DEFAULT_NORMALIZATION: NormalizationConfig = {
  energyMax: 0.15, // Lowered - typical RMS peaks at 0.1-0.2
  spectralCentroidMin: 0, // Zero baseline - any centroid above 0 contributes to brightness
  spectralCentroidMax: 3000, // Reduced for more sensitivity - most content is 200-2000 Hz
  spectralFlatnessMax: 0.5,
};

// ============================================================================
// Aspect Ratio & Resolution Types
// ============================================================================

export type AspectRatioMode = "16:9" | "9:16";

export interface Resolution {
  width: number;
  height: number;
}

export interface AspectRatioConfig {
  mode: AspectRatioMode;
  resolution: Resolution;
}

export const ASPECT_PRESETS: Record<string, AspectRatioConfig> = {
  // Lower resolution for better FPS (~15-20 FPS on RTX 6000)
  // Dimensions must be divisible by 64 for diffusion models
  widescreen: { mode: "16:9", resolution: { width: 576, height: 320 } },
  // 320×576 is the Daydream default for longlive (184K pixels)
  portrait: { mode: "9:16", resolution: { width: 320, height: 576 } },
};

export const DEFAULT_ASPECT_RATIO: AspectRatioConfig = ASPECT_PRESETS.widescreen;

// ============================================================================
// Connection & State Types
// ============================================================================

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export type PlaybackState = "idle" | "loading" | "playing" | "paused" | "ended";

export interface ConnectionStats {
  fps: number;
  framesDecoded: number;
  framesDropped: number;
  bytesReceived: number;
  packetsLost: number;
  jitter: number;
}

export interface SoundscapeState {
  /** Current playback state */
  playback: PlaybackState;
  /** Scope connection state */
  connection: ConnectionState;
  /** Currently active theme */
  activeTheme: Theme | null;
  /** Current audio analysis */
  analysis: AnalysisState | null;
  /** Connection statistics */
  stats: ConnectionStats | null;
  /** Error message if any */
  error: string | null;
}
