/**
 * Soundscape Constants
 * Single source of truth for configuration values used across the codebase
 */

// ============================================================================
// Generation Configuration
// ============================================================================

/**
 * Fixed 4-step denoising schedule for StreamDiffusion.
 * Optimized for RTX 6000: ~15-20 FPS with good visual quality.
 *
 * Each number represents a timestep in the diffusion noise schedule:
 * - 1000: High noise level (start of denoising)
 * - 750, 500: Intermediate refinement steps
 * - 250: Final cleanup
 *
 * More steps = sharper visuals, slower. Fewer steps = faster, softer.
 */
export const DENOISING_STEPS = [1000, 750, 500, 250] as const;

export const DENOISING_PROFILES = {
  speed: [1000, 500, 250],
  balanced: [1000, 750, 500, 250],
  quality: [1000, 850, 700, 550, 400, 250],
} as const;

export type DenoisingProfileId = keyof typeof DENOISING_PROFILES;

export const DEFAULT_DENOISING_PROFILE_ID: DenoisingProfileId = "balanced";

/**
 * Alternative schedules (for reference/future use):
 * - 3-step: [1000, 500, 250] → ~20-25 FPS
 * - 2-step: [1000, 250] → ~25-35 FPS (lower quality)
 */

// ============================================================================
// Update Rates
// ============================================================================

/**
 * Rate at which parameters are sent to Scope via WebRTC DataChannel.
 * Higher = more responsive, but may overwhelm the connection.
 */
export const PARAMETER_UPDATE_RATE_HZ = 30;

/**
 * Rate at which UI state updates are batched.
 * Lower than parameter rate to avoid React render jank.
 */
export const UI_UPDATE_RATE_HZ = 10;

/**
 * Meyda audio analysis rate (derived from buffer size at 44.1kHz).
 * Buffer size 512 at 44.1kHz = ~86 analyses per second.
 */
export const AUDIO_ANALYSIS_RATE_HZ = 86;

// ============================================================================
// Ambient Mode Configuration
// ============================================================================

/**
 * Number of transition frames for theme changes in ambient mode.
 * 10 steps at ~10fps = ~1.0 seconds - smoother crossfade.
 */
export const AMBIENT_THEME_CHANGE_TRANSITION_STEPS = 8;

/**
 * Initial ambient start transition frames.
 * Moderate length for smooth visual initialization.
 */
export const AMBIENT_START_TRANSITION_STEPS = 8;

// ============================================================================
// Connection Configuration
// ============================================================================

/**
 * Maximum reconnection attempts before giving up.
 */
export const MAX_RECONNECT_ATTEMPTS = 3;

/**
 * Base delay between reconnection attempts (ms).
 * Linear scaling is applied: delay = base * attemptNumber.
 */
export const RECONNECT_BASE_DELAY_MS = 2000;

// ============================================================================
// Mapping Engine Configuration
// ============================================================================

/**
 * Smoothing factor for parameter interpolation.
 * Lower = smoother transitions, higher = more responsive.
 */
export const PARAMETER_SMOOTHING_FACTOR = 0.12;

export const REACTIVITY_PROFILES = {
  cinematic: {
    smoothingFactor: 0.06,
    beatNoiseMultiplier: 0.7,
    energySpikeThreshold: 0.14,
  },
  balanced: {
    smoothingFactor: PARAMETER_SMOOTHING_FACTOR,
    beatNoiseMultiplier: 0.85,
    energySpikeThreshold: 0.11,
  },
  kinetic: {
    smoothingFactor: 0.2,
    beatNoiseMultiplier: 1.05,
    energySpikeThreshold: 0.09,
  },
} as const;

export type ReactivityProfileId = keyof typeof REACTIVITY_PROFILES;

export const DEFAULT_REACTIVITY_PROFILE_ID: ReactivityProfileId = "balanced";

export const MOTION_PACE_PROFILES = {
  stable: {
    label: "Stable",
    motionDescriptor: "ultra-stable camera velocity, no acceleration surges",
    beatBoostScale: 0.8,
    spikeBoostScale: 0.85,
    spikeVariationWeightScale: 0.85,
    tempoBands: {
      driftToDriveEnter: 106,
      driveToDriftExit: 96,
      driveToBlitzEnter: 154,
      blitzToDriveExit: 142,
      fallbackDriftMax: 100,
      fallbackDriveMax: 148,
    },
  },
  balanced: {
    label: "Balanced",
    motionDescriptor: "stable camera velocity, no abrupt acceleration spikes",
    beatBoostScale: 1.0,
    spikeBoostScale: 1.0,
    spikeVariationWeightScale: 1.0,
    tempoBands: {
      driftToDriveEnter: 100,
      driveToDriftExit: 92,
      driveToBlitzEnter: 146,
      blitzToDriveExit: 136,
      fallbackDriftMax: 96,
      fallbackDriveMax: 140,
    },
  },
  dynamic: {
    label: "Dynamic",
    motionDescriptor: "dynamic forward momentum with controlled acceleration",
    beatBoostScale: 1.15,
    spikeBoostScale: 1.1,
    spikeVariationWeightScale: 1.08,
    tempoBands: {
      driftToDriveEnter: 94,
      driveToDriftExit: 88,
      driveToBlitzEnter: 134,
      blitzToDriveExit: 126,
      fallbackDriftMax: 90,
      fallbackDriveMax: 130,
    },
  },
} as const;

export type MotionPaceProfileId = keyof typeof MOTION_PACE_PROFILES;

export const DEFAULT_MOTION_PACE_PROFILE_ID: MotionPaceProfileId = "balanced";

export interface RuntimeTuningSettings {
  beatBoostScale: number;
  spikeBoostScale: number;
  spikeVariationWeightScale: number;
  tempoThresholdScale: number;
  noiseCeiling: number;
}

export const RUNTIME_TUNING_BOUNDS = {
  beatBoostScale: { min: 0.6, max: 1.4 },
  spikeBoostScale: { min: 0.6, max: 1.4 },
  spikeVariationWeightScale: { min: 0.7, max: 1.35 },
  tempoThresholdScale: { min: 0.85, max: 1.2 },
  noiseCeiling: { min: 0.35, max: 1 },
} as const;

export const DEFAULT_RUNTIME_TUNING_SETTINGS: RuntimeTuningSettings = {
  beatBoostScale: 1,
  spikeBoostScale: 1,
  spikeVariationWeightScale: 1,
  tempoThresholdScale: 1,
  noiseCeiling: 1,
};

/**
 * Default transition frames for prompt changes (music mode).
 */
export const DEFAULT_PROMPT_TRANSITION_STEPS = 8;

/**
 * Theme change transition frames (music mode).
 * 10 steps at ~10fps = ~1.0 seconds - smoother crossfade.
 */
export const THEME_CHANGE_TRANSITION_STEPS = 8;

/**
 * Cooldown after theme change where no other transitions are allowed (ms).
 * Prevents energy spikes and intensity changes from interrupting theme crossfades.
 * Reduced from 1500ms for snappier response.
 */
export const THEME_CHANGE_COOLDOWN_MS = 800;

/**
 * Cooldown between energy spike transitions (ms).
 * Prevents transition stacking. Reduced from 3000ms for more responsiveness.
 */
export const ENERGY_SPIKE_COOLDOWN_MS = 2200;

/**
 * Estimated Scope output frame rate (FPS).
 * Used to calculate transition duration in milliseconds.
 * RTX 6000 with 4-step schedule typically runs 10-15 FPS.
 * Conservative estimate ensures transitions complete before new ones start.
 */
export const ESTIMATED_SCOPE_FPS = 10;

/**
 * Margin added to transition duration to ensure completion (ms).
 * Accounts for frame rate variability and network latency.
 */
export const TRANSITION_COMPLETION_MARGIN_MS = 100;

// ============================================================================
// Default Theme
// ============================================================================

/**
 * Default theme ID when no theme is specified or lookup fails.
 * Changed from cosmic-voyage to cybernetic-core-forge for better baseline cohesion.
 */
export const DEFAULT_THEME_ID = "forge";
