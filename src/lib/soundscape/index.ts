/**
 * Soundscape Module
 * Audio-reactive visual generation for MetaDJ Soundscape
 */

// Core classes
export { AudioAnalyzer } from "./audio-analyzer";
export { MappingEngine, ParameterSender } from "./mapping-engine";

// Theme system
export {
  PRESET_THEMES,
  THEMES_BY_ID,
  COSMIC_VOYAGE,
  NEON_FOUNDRY,
  DIGITAL_FOREST,
  SYNTHWAVE_HIGHWAY,
  CRYSTAL_SANCTUARY,
  OCEAN_DEPTHS,
  CYBER_CITY,
  AURORA_DREAMS,
  EIGHT_BIT_ADVENTURE,
  VOLCANIC_FORGE,
  QUANTUM_REALM,
  NEON_TOKYO,
  CIRCUIT_BOARD,
  AMETHYST_CAVES,
  DIGITAL_MATRIX,
  createCustomTheme,
  SUGGESTED_STYLE_MODIFIERS,
} from "./themes";

// React hook
export { useSoundscape } from "./use-soundscape";
export type { UseSoundscapeOptions, UseSoundscapeReturn } from "./use-soundscape";

// Types
export type {
  // Audio Analysis
  AudioFeatures,
  BeatInfo,
  AnalysisState,
  NormalizationConfig,

  // Theme System
  Theme,
  ThemeRanges,
  ThemeMappings,
  MappingTarget,
  MappingCurve,
  MappingParameter,
  BeatAction,
  BeatMapping,
  PromptVariation,
  ReactivityPreset,
  BeatResponse,
  CustomThemeInput,
  DenoisingProfileId,
  ReactivityProfileId,
  PromptAccent,

  // Scope Parameters
  ScopeParameters,
  PromptEntry,
  PromptTransition,

  // State Management
  ConnectionState,
  PlaybackState,
  ConnectionStats,
  SoundscapeState,

  // Aspect Ratio
  AspectRatioMode,
  Resolution,
  AspectRatioConfig,
  AspectResolutionPreset,
} from "./types";

// Re-export type constants
export {
  DEFAULT_NORMALIZATION,
  ASPECT_PRESETS,
  ASPECT_RESOLUTION_PRESETS,
  DEFAULT_ASPECT_RATIO,
} from "./types";

// Re-export configuration constants
export {
  DENOISING_STEPS,
  DENOISING_PROFILES,
  DEFAULT_DENOISING_PROFILE_ID,
  PARAMETER_UPDATE_RATE_HZ,
  UI_UPDATE_RATE_HZ,
  AUDIO_ANALYSIS_RATE_HZ,
  AMBIENT_THEME_CHANGE_TRANSITION_STEPS,
  AMBIENT_START_TRANSITION_STEPS,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY_MS,
  PARAMETER_SMOOTHING_FACTOR,
  REACTIVITY_PROFILES,
  MOTION_PACE_PROFILES,
  DEFAULT_RUNTIME_TUNING_SETTINGS,
  RUNTIME_TUNING_BOUNDS,
  DEFAULT_REACTIVITY_PROFILE_ID,
  DEFAULT_MOTION_PACE_PROFILE_ID,
  DEFAULT_PROMPT_TRANSITION_STEPS,
  THEME_CHANGE_TRANSITION_STEPS,
  ENERGY_SPIKE_COOLDOWN_MS,
  DEFAULT_THEME_ID,
  type MotionPaceProfileId,
  type RuntimeTuningSettings,
} from "./constants";
