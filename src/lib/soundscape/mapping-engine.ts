/**
 * Soundscape Mapping Engine
 *
 * Core module for translating real-time audio analysis features into
 * Scope generation parameters. This is the heart of the audio-reactive
 * visual system.
 *
 * ## Architecture
 *
 * The mapping engine operates in a pipeline:
 * 1. **Audio Features** → Normalized energy, brightness, texture values (0-1)
 * 2. **Theme Mappings** → Apply curves, sensitivity, and range transformations
 * 3. **Beat Effects** → Add noise boosts on detected beats
 * 4. **Prompt Building** → Construct prompts with intensity descriptors
 * 5. **Smoothing** → Temporal smoothing to avoid jarring parameter jumps
 *
 * ## Key Design Decisions
 *
 * - **No cache resets**: Always use smooth transitions to avoid visual jumps
 * - **Static prompts**: Prompts only change on energy level transitions, not continuously
 * - **Beats = noise only**: Beat detection affects noise_scale, not prompts
 * - **Theme cooldowns**: Prevent prompt changes during theme crossfades
 *
 * @module soundscape/mapping-engine
 */

import type {
  Theme,
  AnalysisState,
  ScopeParameters,
  MappingTarget,
  MappingCurve,
  PromptEntry,
  NormalizationConfig,
  PromptAccent,
  ReactivityProfileId,
} from "./types";
import {
  DENOISING_STEPS,
  DEFAULT_REACTIVITY_PROFILE_ID,
  PARAMETER_SMOOTHING_FACTOR,
  REACTIVITY_PROFILES,
  DEFAULT_PROMPT_TRANSITION_STEPS,
  THEME_CHANGE_TRANSITION_STEPS,
  THEME_CHANGE_COOLDOWN_MS,
  ENERGY_SPIKE_COOLDOWN_MS,
  ESTIMATED_SCOPE_FPS,
  TRANSITION_COMPLETION_MARGIN_MS,
} from "./constants";

// ============================================================================
// Mapping Engine Class
// ============================================================================

// Static intensity descriptors - ONE per energy level (no cycling, no looping)
// Prompts only change when energy level actually changes
const INTENSITY_DESCRIPTORS: Record<string, string> = {
  low: "calm atmosphere, gentle flow",
  medium: "dynamic energy, flowing motion",
  high: "intense power, surging force",
  peak: "maximum intensity, transcendent energy",
} as const;

const BRIGHTNESS_DESCRIPTORS: Record<string, string> = {
  dark: "deep shadows, moody contrast",
  balanced: "balanced luminance, cinematic exposure",
  radiant: "radiant highlights, luminous details",
} as const;

const TEXTURE_DESCRIPTORS: Record<string, string> = {
  smooth: "silky gradients, clean edges",
  granular: "textured grain, atmospheric noise",
  crystalline: "crystalline detail, prismatic artifacts",
} as const;

const TEMPO_DESCRIPTORS: Record<string, string> = {
  drift: "slow evolving camera drift",
  drive: "rhythmic forward momentum",
  blitz: "high-velocity kinetic cadence",
} as const;

// NOTE: Temporal variations REMOVED - user requested no prompt looping
// NOTE: Beat modifiers REMOVED - beats only affect noise, not prompts
// Prompts are now completely static until theme change or energy level change

/**
 * MappingEngine translates audio analysis features into Scope generation parameters.
 *
 * This class is the core of the audio-reactive system. It takes normalized audio
 * features (energy, brightness, texture, beats) and produces the parameters that
 * control the AI video generation pipeline.
 *
 * @example
 * ```typescript
 * const engine = new MappingEngine(theme, { energyMax: 0.15 });
 *
 * // On each audio analysis frame (~86 Hz)
 * const params = engine.computeParameters(analysisState);
 * parameterSender.send(params);
 *
 * // On theme change
 * engine.setTheme(newTheme); // Triggers smooth 6-frame transition
 * ```
 */
export class MappingEngine {
  private theme: Theme;
  private normalization: NormalizationConfig;
  private lastParams: ScopeParameters | null = null;
  private smoothingFactor = PARAMETER_SMOOTHING_FACTOR;
  private denoisingSteps: number[] = [...DENOISING_STEPS];
  private promptOverlay: PromptAccent | null = null;
  private reactivityProfile: ReactivityProfileId = DEFAULT_REACTIVITY_PROFILE_ID;
  private beatNoiseMultiplier =
    REACTIVITY_PROFILES[DEFAULT_REACTIVITY_PROFILE_ID].beatNoiseMultiplier;
  private energySpikeThreshold =
    REACTIVITY_PROFILES[DEFAULT_REACTIVITY_PROFILE_ID].energySpikeThreshold;

  // Beat handling
  private lastBeatTriggerTime = 0;
  private promptVariationIndex = 0;
  private currentPromptVariation: string | null = null;

  // Intensity tracking - only changes when energy level actually changes
  private lastIntensityLevel: "low" | "medium" | "high" | "peak" = "low";
  private lastBrightnessBand: "dark" | "balanced" | "radiant" = "balanced";
  private lastTextureBand: "smooth" | "granular" | "crystalline" = "smooth";
  private lastTempoBand: "drift" | "drive" | "blitz" = "drift";
  private energySpikeVariationIndex = 0;
  // NOTE: Temporal variations REMOVED - prompts are static per energy level

  // Energy spike cooldown - prevents transition stacking
  private lastEnergySpikeTime = 0;

  // Prompt transition tracking
  private lastPromptText: string | null = null;

  // Theme change flag - triggers smooth transition (NOT cache reset) on next parameter computation
  private pendingThemeTransition = false;

  // Theme change cooldown - prevents energy spikes/intensity changes from interrupting theme crossfade
  private themeChangeCooldownUntil = 0;

  // Transition tracking - prevents new transitions during active SLERP interpolation
  private transitionActiveUntil = 0;

  // Debug logging - track last logged theme to avoid spam
  private lastLoggedTheme: string | null = null;

  constructor(
    theme: Theme,
    normalization: NormalizationConfig = {
      energyMax: 0.15, // Lowered - typical RMS peaks at 0.1-0.2
      spectralCentroidMin: 0, // Zero baseline - any centroid above 0 contributes to brightness
      spectralCentroidMax: 3000, // Reduced for more sensitivity - most content is 200-2000 Hz
      spectralFlatnessMax: 0.5,
    }
  ) {
    this.theme = theme;
    this.normalization = normalization;
    this.setReactivityProfile(DEFAULT_REACTIVITY_PROFILE_ID);
  }

  /**
   * Update the active theme
   * Uses smooth transition instead of cache reset to avoid hard cuts
   *
   * @param skipTransition - If true, don't queue a pending transition (caller handles it)
   */
  setTheme(theme: Theme, skipTransition = false): void {
    const wasThemeChange = this.theme.id !== theme.id;
    const oldTheme = this.theme.id;
    this.theme = theme;
    this.promptVariationIndex = 0;
    this.currentPromptVariation = null;

    // Smooth transition when theme changes (NO cache reset = no hard cuts)
    if (wasThemeChange) {
      // CRITICAL: Reset lastParams to prevent stale theme data bleeding through smooth()
      // This ensures the first frame of the new theme starts fresh
      this.lastParams = null;

      // Only set pending transition if caller doesn't handle it directly
      this.pendingThemeTransition = !skipTransition;

      // Reset intensity tracking to start fresh
      this.lastIntensityLevel = "low";
      this.lastBrightnessBand = "balanced";
      this.lastTextureBand = "smooth";
      this.lastTempoBand = "drift";
      this.lastPromptText = null; // Force fresh prompt
      this.lastLoggedTheme = null; // Force next log

      // Set cooldown to prevent energy spikes/intensity changes from interrupting crossfade
      this.themeChangeCooldownUntil = Date.now() + THEME_CHANGE_COOLDOWN_MS;

      if (process.env.NODE_ENV === "development") {
        console.log("[MappingEngine] 🔄 Theme changed (smooth transition):", oldTheme, "→", theme.id,
          `(${THEME_CHANGE_COOLDOWN_MS}ms cooldown, pendingTransition=${this.pendingThemeTransition})`);
      }
    }
  }

  /**
   * Get current theme ID (for debugging)
   */
  getCurrentThemeId(): string {
    return this.theme.id;
  }

  /**
   * Override denoising schedule at runtime.
   */
  setDenoisingSteps(steps: number[]): void {
    const normalized = Array.from(
      new Set(steps.map((step) => Math.round(step)).filter((step) => step > 0))
    );
    this.denoisingSteps = normalized.length > 0 ? normalized : [...DENOISING_STEPS];
  }

  /**
   * Add or clear an accent prompt entry layered on top of theme prompts.
   */
  setPromptOverlay(overlay: PromptAccent | null): void {
    if (!overlay || !overlay.text.trim()) {
      this.promptOverlay = null;
      return;
    }

    this.promptOverlay = {
      text: overlay.text.trim(),
      weight: Math.max(0.05, Math.min(1, overlay.weight)),
    };
  }

  /**
   * Control the responsiveness profile for visuals.
   */
  setReactivityProfile(profile: ReactivityProfileId): void {
    const resolved = REACTIVITY_PROFILES[profile] ?? REACTIVITY_PROFILES[DEFAULT_REACTIVITY_PROFILE_ID];
    this.reactivityProfile = profile;
    this.smoothingFactor = resolved.smoothingFactor;
    this.beatNoiseMultiplier = resolved.beatNoiseMultiplier;
    this.energySpikeThreshold = resolved.energySpikeThreshold;
  }

  /**
   * Mark an external transition as active.
   * Call this when the caller handles the transition directly (e.g., theme change from hook)
   * to prevent this engine from sending conflicting params during the transition.
   */
  markExternalTransitionActive(steps: number): void {
    this.markTransitionActive(steps);
    if (process.env.NODE_ENV === "development") {
      console.log(`[MappingEngine] External transition marked active (${steps} steps)`);
    }
  }

  /**
   * Reset internal state for clean mode transitions (e.g., audio → ambient)
   * Preserves theme but resets all temporal/intensity tracking
   * Uses smooth transition instead of cache reset to avoid hard cuts
   */
  resetState(): void {
    this.lastParams = null;
    this.lastBeatTriggerTime = 0;
    this.promptVariationIndex = 0;
    this.currentPromptVariation = null;
    this.lastIntensityLevel = "low";
    this.energySpikeVariationIndex = 0;
    this.lastEnergySpikeTime = 0;
    this.lastPromptText = null;
    this.pendingThemeTransition = true; // Smooth transition, not cache reset
    if (process.env.NODE_ENV === "development") {
      console.log("[MappingEngine] State reset for mode transition (smooth)");
    }
  }

  /**
   * Update normalization configuration
   */
  setNormalization(config: Partial<NormalizationConfig>): void {
    this.normalization = { ...this.normalization, ...config };
  }

  /**
   * Calculate how long a transition will take in milliseconds.
   * Used to prevent new transitions from interrupting active ones.
   */
  private calculateTransitionDurationMs(steps: number): number {
    // At estimated FPS, each step takes 1000/FPS ms
    const baseDuration = (steps * 1000) / ESTIMATED_SCOPE_FPS;
    return baseDuration + TRANSITION_COMPLETION_MARGIN_MS;
  }

  /**
   * Check if a transition is currently in progress.
   * Returns true if we should block new transitions.
   */
  private isTransitionActive(): boolean {
    return Date.now() < this.transitionActiveUntil;
  }

  /**
   * Mark a transition as active for the specified number of steps.
   */
  private markTransitionActive(steps: number): void {
    const durationMs = this.calculateTransitionDurationMs(steps);
    this.transitionActiveUntil = Date.now() + durationMs;
    if (process.env.NODE_ENV === "development") {
      console.log(`[MappingEngine] Transition active for ${durationMs}ms (${steps} steps)`);
    }
  }

  /**
   * Compute Scope parameters from audio analysis
   */
  computeParameters(analysis: AnalysisState): ScopeParameters {
    const { derived, beat } = analysis;

    // Compute base parameter values from mappings
    let noiseScale = this.computeMappedValue(
      "noiseScale",
      derived,
      this.theme.ranges.noiseScale
    );

    // Fixed denoising steps from shared constants (4-step schedule)
    const denoisingSteps = [...this.denoisingSteps];

    // Handle beat effects
    const beatEffect = this.handleBeatEffects(beat, derived);
    if (beatEffect.noiseBoost) {
      noiseScale = Math.min(1.0, noiseScale + beatEffect.noiseBoost);
    }

    // Build prompts with intensity descriptors (NO beat modifiers - beats only affect noise)
    const prompts = this.buildPrompts(derived, beat, beatEffect.promptOverride);

    // Determine if we need a smooth transition for prompt changes
    // Priority: theme transition > beat effect transition > regular prompt change transition
    let transition = beatEffect.transition;
    const currentPromptText = prompts.map((p) => p.text).join("|");

    // Theme change gets priority - use longer transition for smooth crossfade
    // Theme changes ALWAYS proceed (user-initiated action)
    if (this.pendingThemeTransition) {
      this.pendingThemeTransition = false;
      transition = {
        target_prompts: prompts,
        num_steps: THEME_CHANGE_TRANSITION_STEPS,
        temporal_interpolation_method: "slerp" as const,
      };
      // Mark transition active to block other transitions until complete
      this.markTransitionActive(THEME_CHANGE_TRANSITION_STEPS);
      if (process.env.NODE_ENV === "development") {
        console.log("[MappingEngine] Theme transition initiated:", THEME_CHANGE_TRANSITION_STEPS, "steps");
      }
    } else if (!transition && this.lastPromptText && currentPromptText !== this.lastPromptText) {
      // Prompt changed without a beat effect - add smooth transition
      // BUT only if no transition is currently active (prevents mid-transition jumps)
      if (!this.isTransitionActive()) {
        transition = {
          target_prompts: prompts,
          num_steps: DEFAULT_PROMPT_TRANSITION_STEPS,
          temporal_interpolation_method: "slerp" as const,
        };
        this.markTransitionActive(DEFAULT_PROMPT_TRANSITION_STEPS);
      } else if (process.env.NODE_ENV === "development") {
        console.log("[MappingEngine] Blocked prompt transition - transition already active");
      }
    }
    this.lastPromptText = currentPromptText;

    // Build final parameters
    // Note: resetCache NEVER used - we always use smooth transitions to avoid hard cuts
    const params: ScopeParameters = {
      prompts,
      denoisingSteps,
      noiseScale,
      // resetCache deliberately omitted - smooth transitions only
      transition,
    };

    // Apply smoothing
    const smoothed = this.smooth(params);
    this.lastParams = smoothed;

    return smoothed;
  }

  // ============================================================================
  // Private: Mapping Computation
  // ============================================================================

  private computeMappedValue(
    parameter: string,
    derived: AnalysisState["derived"],
    range: { min: number; max: number }
  ): number {
    let value = range.min;

    // Find all mappings that target this parameter
    const allMappings = [
      ...this.theme.mappings.energy.filter((m) => m.parameter === parameter),
      ...this.theme.mappings.brightness.filter((m) => m.parameter === parameter),
      ...this.theme.mappings.texture.filter((m) => m.parameter === parameter),
    ];

    if (allMappings.length === 0) {
      return range.min;
    }

    // Combine all mapping contributions
    let totalContribution = 0;
    let totalWeight = 0;

    for (const mapping of allMappings) {
      const sourceValue = this.getSourceValue(mapping, derived);
      const contribution = this.applyMapping(sourceValue, range, mapping);
      totalContribution += contribution * mapping.sensitivity;
      totalWeight += mapping.sensitivity;
    }

    if (totalWeight > 0) {
      value = totalContribution / totalWeight;
    }

    return Math.max(range.min, Math.min(range.max, value));
  }

  private getSourceValue(
    mapping: MappingTarget,
    derived: AnalysisState["derived"]
  ): number {
    // Determine which derived value to use based on where this mapping came from
    // This is a simplification - in practice we'd track which array the mapping came from
    // For now, we use the parameter to guess the source
    if (
      this.theme.mappings.energy.includes(mapping) ||
      mapping.parameter === "noiseScale"
    ) {
      return derived.energy;
    }
    if (
      this.theme.mappings.brightness.includes(mapping) ||
      mapping.parameter === "promptWeight"
    ) {
      return derived.brightness;
    }
    if (this.theme.mappings.texture.includes(mapping)) {
      return derived.texture;
    }
    return derived.energy;
  }

  private applyMapping(
    value: number,
    range: { min: number; max: number },
    mapping: MappingTarget
  ): number {
    // Apply inversion
    const scaled = mapping.invert ? 1 - value : value;

    // Apply curve
    const curved = this.applyCurve(scaled, mapping.curve);

    // Clamp
    const clamped = Math.max(0, Math.min(1, curved));

    // Map to range
    return range.min + (range.max - range.min) * clamped;
  }

  private applyCurve(value: number, curve: MappingCurve): number {
    switch (curve) {
      case "exponential":
        return Math.pow(value, 2); // More response at high end
      case "logarithmic":
        return Math.sqrt(value); // More response at low end
      case "stepped":
        return Math.floor(value * 4) / 4; // Quantized to 4 levels
      case "linear":
      default:
        return value;
    }
  }

  // ============================================================================
  // Private: Beat Effects
  // ============================================================================

  /**
   * Handle beat effects - SIMPLIFIED: beats only affect noise, never prompts
   * This prevents prompt churn and keeps visuals stable while still being responsive
   */
  private handleBeatEffects(
    beat: AnalysisState["beat"],
    derived: AnalysisState["derived"]
  ): {
    noiseBoost: number;
    promptOverride: string | null;
    transition: ScopeParameters["transition"];
  } {
    const result = {
      noiseBoost: 0,
      promptOverride: null as string | null,
      transition: undefined as ScopeParameters["transition"],
    };

    const beatMapping = this.theme.mappings.beats;

    // Always apply a base noise boost on beats (regardless of configured action)
    // This makes beats universally more impactful
    if (beat.isBeat) {
      result.noiseBoost = 0.08 * this.beatNoiseMultiplier; // Base beat response
    }

    if (!beatMapping.enabled || !beat.isBeat) {
      // Still check for energy spikes even without beat
      return this.handleEnergySpikeEffects(derived, result);
    }

    // Check cooldown
    const now = Date.now();
    const cooldown = beatMapping.cooldownMs || 200;

    if (now - this.lastBeatTriggerTime < cooldown) {
      return this.handleEnergySpikeEffects(derived, result);
    }

    this.lastBeatTriggerTime = now;

    // SIMPLIFIED: All beat actions now just boost noise (no prompt changes)
    // This prevents prompt churn while keeping beat responsiveness
    // The configured intensity controls how much extra noise boost
    switch (beatMapping.action) {
      case "pulse_noise":
        // Standard noise pulse
        result.noiseBoost = Math.max(
          result.noiseBoost,
          beatMapping.intensity * 0.25 * this.beatNoiseMultiplier
        );
        break;

      case "cache_reset":
        // CHANGED: No longer resets cache (causes hard cuts)
        // Instead, treat as strong noise pulse
        result.noiseBoost = Math.max(
          result.noiseBoost,
          beatMapping.intensity * 0.35 * this.beatNoiseMultiplier
        );
        break;

      case "prompt_cycle":
      case "transition_trigger":
        // CHANGED: No longer changes prompts on beats (causes churn)
        // Instead, treat as moderate noise pulse
        result.noiseBoost = Math.max(
          result.noiseBoost,
          beatMapping.intensity * 0.30 * this.beatNoiseMultiplier
        );
        break;
    }

    return this.handleEnergySpikeEffects(derived, result);
  }

  /**
   * Handle energy spike effects (separate from beat detection)
   * Energy spikes trigger prompt transitions for dramatic visual shifts
   * Cooldown prevents transition stacking
   */
  private handleEnergySpikeEffects(
    derived: AnalysisState["derived"],
    result: {
      noiseBoost: number;
      promptOverride: string | null;
      transition: ScopeParameters["transition"];
    }
  ): typeof result {
    // Energy spike detection threshold
    const energySpikeThreshold = this.energySpikeThreshold;

    // Check cooldowns to prevent transition stacking
    const now = Date.now();

    // CRITICAL: Don't trigger energy spike transitions during theme change cooldown
    // This prevents energy spikes from interrupting the theme crossfade
    if (now < this.themeChangeCooldownUntil) {
      return result;
    }

    // Also block if a transition is currently active (prevents mid-transition jumps)
    if (this.isTransitionActive()) {
      return result;
    }

    if (now - this.lastEnergySpikeTime < ENERGY_SPIKE_COOLDOWN_MS) {
      return result;
    }

    if (
      this.theme.promptVariations?.trigger === "energy_spike" &&
      derived.energyDerivative > energySpikeThreshold
    ) {
      const variations = this.theme.promptVariations.prompts;
      if (!Array.isArray(variations) || variations.length === 0) {
        return result;
      }

      this.lastEnergySpikeTime = now; // Update cooldown timestamp
      // Deterministic cycling instead of random to avoid abrupt visual jumps
      this.energySpikeVariationIndex =
        (this.energySpikeVariationIndex + 1) % variations.length;
      const spikeVariation = variations[this.energySpikeVariationIndex];

      // Scale transition weight by how big the spike is
      const spikeIntensity = Math.min(1, derived.energyDerivative / 0.20);

      // Moderate weight on variation (0.5-0.75) for noticeable but smooth shifts
      const variationWeight = 0.5 + spikeIntensity * 0.25;
      const baseWeight = 1 - variationWeight;

      // DEBUG: Log energy spikes
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[MappingEngine] ⚡ ENERGY SPIKE! derivative=${derived.energyDerivative.toFixed(3)}, ` +
          `intensity=${spikeIntensity.toFixed(2)}, variationWeight=${variationWeight.toFixed(2)}, ` +
          `cooldown=${ENERGY_SPIKE_COOLDOWN_MS}ms`
        );
      }

      const blendDuration = this.theme.promptVariations.blendDuration;
      result.transition = {
        target_prompts: [
          { text: spikeVariation, weight: variationWeight },
          { text: this.buildBasePrompt(), weight: baseWeight },
        ],
        num_steps: blendDuration,
        temporal_interpolation_method: "slerp",
      };

      // Mark transition as active to prevent overlapping transitions
      this.markTransitionActive(blendDuration);

      // Also boost noise on energy spikes
      result.noiseBoost = Math.max(result.noiseBoost, spikeIntensity * 0.15 * this.beatNoiseMultiplier);
    }

    return result;
  }

  // ============================================================================
  // Private: Prompt Building
  // ============================================================================

  private buildBasePrompt(): string {
    return [this.theme.basePrompt, ...this.theme.styleModifiers].join(", ");
  }

  /**
   * Get intensity level from energy value
   */
  private getIntensityLevel(energy: number): "low" | "medium" | "high" | "peak" {
    if (energy < 0.25) return "low";
    if (energy < 0.5) return "medium";
    if (energy < 0.75) return "high";
    return "peak";
  }

  /**
   * Get intensity descriptor based on current energy level
   * STATIC per level - prompts only change when energy level actually changes
   * NO temporal variations, NO cycling - completely stable prompts
   */
  private getIntensityDescriptor(energy: number): string {
    const level = this.getIntensityLevel(energy);

    // Track level changes for logging
    if (level !== this.lastIntensityLevel) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[MappingEngine] Intensity: ${this.lastIntensityLevel} → ${level}`);
      }
      this.lastIntensityLevel = level;
    }

    // Return static descriptor for this level (no cycling, no looping)
    return INTENSITY_DESCRIPTORS[level];
  }

  /**
   * Build prompts for Scope
   * Combines base prompt + style modifiers + intensity descriptor
   * Prompts are STATIC per energy level - no cycling, no temporal variations
   */
  private buildPrompts(
    derived: AnalysisState["derived"],
    beat: AnalysisState["beat"],
    promptOverride: string | null
  ): PromptEntry[] {
    const basePrompt = this.buildBasePrompt();
    const intensityDescriptor = this.getIntensityDescriptor(derived.energy);
    const brightnessDescriptor = this.getBrightnessDescriptor(derived.brightness);
    const textureDescriptor = this.getTextureDescriptor(derived.texture);
    const tempoDescriptor = this.getTempoDescriptor(beat);

    // Build the reactive prompt with controlled descriptor bands.
    const reactivePrompt = `${basePrompt}, ${intensityDescriptor}, ${brightnessDescriptor}, ${textureDescriptor}, ${tempoDescriptor}`;

    if (promptOverride) {
      // Blend override with reactive base and optional accent layer.
      const entries: PromptEntry[] = [
        { text: promptOverride, weight: 0.4 },
        { text: reactivePrompt, weight: 0.6 },
      ];
      if (this.promptOverlay) {
        entries.push(this.promptOverlay);
      }
      return entries;
    }

    const entries: PromptEntry[] = [{ text: reactivePrompt, weight: 1.0 }];
    if (this.promptOverlay) {
      entries.push(this.promptOverlay);
    }
    return entries;
  }

  private getBrightnessDescriptor(brightness: number): string {
    let band: "dark" | "balanced" | "radiant" = this.lastBrightnessBand;
    if (brightness < 0.3) {
      band = "dark";
    } else if (brightness > 0.7) {
      band = "radiant";
    } else {
      band = "balanced";
    }
    this.lastBrightnessBand = band;
    return BRIGHTNESS_DESCRIPTORS[band];
  }

  private getTextureDescriptor(texture: number): string {
    let band: "smooth" | "granular" | "crystalline" = this.lastTextureBand;
    if (texture < 0.33) {
      band = "smooth";
    } else if (texture > 0.72) {
      band = "crystalline";
    } else {
      band = "granular";
    }
    this.lastTextureBand = band;
    return TEXTURE_DESCRIPTORS[band];
  }

  private getTempoDescriptor(beat: AnalysisState["beat"]): string {
    let band: "drift" | "drive" | "blitz" = this.lastTempoBand;
    if (beat.bpm && beat.confidence > 0.45) {
      if (beat.bpm < 92) {
        band = "drift";
      } else if (beat.bpm < 132) {
        band = "drive";
      } else {
        band = "blitz";
      }
    }
    this.lastTempoBand = band;
    return TEMPO_DESCRIPTORS[band];
  }

  // ============================================================================
  // Private: Smoothing
  // ============================================================================

  private smooth(target: ScopeParameters): ScopeParameters {
    if (!this.lastParams) {
      return target;
    }

    return {
      ...target,
      noiseScale: this.lerp(
        this.lastParams.noiseScale,
        target.noiseScale,
        this.smoothingFactor
      ),
      // Don't smooth denoising steps - they change discretely
      denoisingSteps: target.denoisingSteps,
      // Don't smooth prompts - use Scope's transition system
      prompts: target.prompts,
    };
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}

// ============================================================================
// Parameter Sender (Rate-Limited)
// ============================================================================

/**
 * ParameterSender handles rate-limited transmission of parameters to Scope
 * over a WebRTC DataChannel.
 *
 * The mapping engine produces parameters at ~86 Hz (Meyda analysis rate),
 * but we only want to send updates at ~30 Hz to avoid overwhelming the
 * GPU pipeline. This class handles the rate limiting and queueing.
 *
 * @example
 * ```typescript
 * const sender = new ParameterSender(30); // 30 Hz target rate
 *
 * // When WebRTC data channel opens
 * sender.setDataChannel(channel);
 *
 * // On each mapping engine output
 * sender.send(params); // Rate-limited internally
 *
 * // On theme change (optional - prevents stale params)
 * sender.clearPending();
 * ```
 */
export class ParameterSender {
  private dataChannel: RTCDataChannel | null = null;
  private targetUpdateRate: number;
  private lastSendTime = 0;
  private pendingParams: ScopeParameters | null = null;
  private sendScheduled = false;
  private sendTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private consecutiveSendFailures = 0;

  /**
   * Create a new ParameterSender.
   * @param updateRate - Target update rate in Hz (default: 30)
   */
  constructor(updateRate = 30) {
    this.targetUpdateRate = updateRate;
  }

  /**
   * Set the data channel for sending parameters
   */
  setDataChannel(channel: RTCDataChannel | null): void {
    this.dataChannel = channel;

    if (process.env.NODE_ENV === "development") {
      console.log("[ParameterSender] Data channel set:", channel ? `readyState=${channel.readyState}` : "null");
    }

    if (!channel) {
      this.pendingParams = null;
      this.sendScheduled = false;
      if (this.sendTimeoutId) {
        clearTimeout(this.sendTimeoutId);
        this.sendTimeoutId = null;
      }
    }
  }

  /**
   * Clear any pending parameters (call on theme change to prevent stale params)
   */
  clearPending(): void {
    this.pendingParams = null;
    if (this.sendTimeoutId) {
      clearTimeout(this.sendTimeoutId);
      this.sendTimeoutId = null;
      this.sendScheduled = false;
    }
    if (process.env.NODE_ENV === "development") {
      console.log("[ParameterSender] Pending params cleared");
    }
  }

  /**
   * Queue parameters for sending. Rate-limited to targetUpdateRate.
   */
  send(params: ScopeParameters): void {
    this.pendingParams = params;

    if (!this.sendScheduled) {
      this.scheduleNextSend();
    }
  }

  private scheduleNextSend(): void {
    const now = performance.now();
    const minInterval = 1000 / this.targetUpdateRate;
    const elapsed = now - this.lastSendTime;
    const delay = Math.max(0, minInterval - elapsed);

    this.sendScheduled = true;

    this.sendTimeoutId = setTimeout(() => {
      this.sendScheduled = false;
      this.sendTimeoutId = null;

      if (!this.dataChannel || this.dataChannel.readyState !== "open") {
        if (this.pendingParams) {
          this.consecutiveSendFailures++;
          if (this.consecutiveSendFailures === 1 || this.consecutiveSendFailures % 30 === 0) {
            console.warn("[ParameterSender] Dropping params - channel not open:",
              this.dataChannel ? `state=${this.dataChannel.readyState}` : "no channel",
              `(${this.consecutiveSendFailures} consecutive drops)`);
          }
        }
        this.pendingParams = null;
        return;
      }

      if (this.pendingParams) {
        const formatted = this.formatParams(this.pendingParams);
        try {
          this.dataChannel.send(JSON.stringify(formatted));
          this.lastSendTime = performance.now();
          this.consecutiveSendFailures = 0;
        } catch (error) {
          this.consecutiveSendFailures++;
          if (this.consecutiveSendFailures === 1 || this.consecutiveSendFailures % 30 === 0) {
            console.warn("[ParameterSender] Failed to send params:", error,
              `(${this.consecutiveSendFailures} consecutive failures)`);
          }
        }

        // Log cache resets (important for debugging theme changes)
        if (process.env.NODE_ENV === "development" && formatted.reset_cache) {
          console.log("[ParameterSender] Cache reset triggered");
        }

        this.pendingParams = null;
      }

      // If more params arrived while waiting, schedule again
      if (this.pendingParams) {
        this.scheduleNextSend();
      }
    }, delay);
  }

  // Track last logged theme for change detection
  private lastLoggedTheme: string | null = null;

  private formatParams(params: ScopeParameters): Record<string, unknown> {
    // Debug: Log theme identification (only when theme changes)
    if (process.env.NODE_ENV === "development") {
      const fullPrompt = params.prompts[0]?.text || "";
      // Extract key theme identifier from prompt
      let themeHint = "UNKNOWN";
      if (fullPrompt.includes("cosmic")) themeHint = "COSMIC";
      else if (fullPrompt.includes("foundry") || fullPrompt.includes("workshop")) themeHint = "FOUNDRY";
      else if (fullPrompt.includes("forest") || fullPrompt.includes("bioluminescent")) themeHint = "FOREST";
      else if (fullPrompt.includes("synthwave") || fullPrompt.includes("highway")) themeHint = "SYNTHWAVE";
      else if (fullPrompt.includes("sanctuary") || fullPrompt.includes("gothic castle")) themeHint = "SANCTUARY";

      if (themeHint !== this.lastLoggedTheme) {
        // Log theme changes
        console.log("[Scope] Theme:", themeHint);
        this.lastLoggedTheme = themeHint;
      }
    }

    const formatted: Record<string, unknown> = {
      // Always send prompts - this is the target state
      prompts: params.prompts.map((p) => ({ text: p.text, weight: p.weight })),
      denoising_step_list: params.denoisingSteps,
      noise_scale: params.noiseScale,
      noise_controller: false, // We control noise manually
      manage_cache: true, // Let Scope manage its latent cache
      paused: false, // Ensure generation is running
    };

    // Note: reset_cache NEVER sent - we use smooth transitions only to avoid hard cuts

    // Add transition for smooth blending when prompts change
    if (params.transition) {
      formatted.transition = params.transition;
    }

    return formatted;
  }
}
