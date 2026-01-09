/**
 * Soundscape React Hook
 * Orchestrates audio analysis, theme mapping, and Scope parameter updates
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioAnalyzer } from "./audio-analyzer";
import { MappingEngine, ParameterSender } from "./mapping-engine";
import { PRESET_THEMES, THEMES_BY_ID, createCustomTheme } from "./themes";
import type {
  Theme,
  AnalysisState,
  ScopeParameters,
  SoundscapeState,
  CustomThemeInput,
} from "./types";
import {
  DENOISING_STEPS,
  AMBIENT_THEME_CHANGE_TRANSITION_STEPS,
  DEFAULT_THEME_ID,
} from "./constants";

// ============================================================================
// Helper Functions
// ============================================================================

/** Get the default theme object */
const getDefaultTheme = (): Theme => THEMES_BY_ID[DEFAULT_THEME_ID];

// ============================================================================
// Hook Interface
// ============================================================================

export interface UseSoundscapeOptions {
  /** Initial theme ID or custom theme input */
  initialTheme?: string | CustomThemeInput;
  /** Target parameter update rate (Hz) */
  updateRate?: number;
  /** Target UI update rate (Hz) */
  uiUpdateRate?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseSoundscapeReturn {
  /** Current state */
  state: SoundscapeState;
  /** Latest Scope parameters */
  parameters: ScopeParameters | null;
  /** Available preset themes */
  presetThemes: Theme[];

  /** Connect to audio element */
  connectAudio: (audioElement: HTMLAudioElement) => Promise<void>;
  /** Disconnect audio */
  disconnectAudio: () => void;
  /** Set the data channel for Scope communication */
  setDataChannel: (channel: RTCDataChannel | null) => void;

  /** Start analysis and parameter generation */
  start: () => void;
  /** Stop analysis */
  stop: () => void;

  /** Start ambient mode (no audio required) */
  startAmbient: () => void;
  /** Stop ambient mode */
  stopAmbient: () => void;

  /** Change active theme */
  setTheme: (themeIdOrInput: string | CustomThemeInput) => void;
  /** Get current theme */
  currentTheme: Theme;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSoundscape(options: UseSoundscapeOptions = {}): UseSoundscapeReturn {
  const {
    initialTheme = DEFAULT_THEME_ID,
    updateRate = 30,
    uiUpdateRate = 10,
    debug = false,
  } = options;

  // Compute initial theme once - uses single source of truth for fallback
  const getInitialTheme = useCallback((): Theme => {
    if (typeof initialTheme === "string") {
      return THEMES_BY_ID[initialTheme] ?? getDefaultTheme();
    }
    return createCustomTheme(initialTheme);
  }, [initialTheme]);

  // Core refs
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const mappingEngineRef = useRef<MappingEngine | null>(null);
  const parameterSenderRef = useRef<ParameterSender | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const lastUiUpdateRef = useRef(0);
  const uiUpdateIntervalMs = 1000 / uiUpdateRate;

  // Ambient mode refs
  const ambientIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Data channel ref (stored for ambient mode to use)
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // State - initialize theme synchronously
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => getInitialTheme());

  // CRITICAL: Use a ref to track the CURRENT theme for closures
  // This prevents stale closure issues where callbacks capture old theme state
  const currentThemeRef = useRef<Theme>(currentTheme);

  // Keep the ref in sync with state
  useEffect(() => {
    currentThemeRef.current = currentTheme;
  }, [currentTheme]);

  const [state, setState] = useState<SoundscapeState>(() => ({
    playback: "idle",
    connection: "disconnected",
    activeTheme: getInitialTheme(),
    analysis: null,
    stats: null,
    error: null,
  }));

  const [parameters, setParameters] = useState<ScopeParameters | null>(null);
  const parametersRef = useRef<ScopeParameters | null>(null);

  // Debug logger
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[Soundscape]", ...args);
      }
    },
    [debug]
  );

  // ============================================================================
  // Theme Management
  // ============================================================================

  const resolveTheme = useCallback(
    (themeIdOrInput: string | CustomThemeInput): Theme => {
      if (typeof themeIdOrInput === "string") {
        const preset = THEMES_BY_ID[themeIdOrInput];
        if (!preset) {
          log(`Theme "${themeIdOrInput}" not found, using default`);
          return getDefaultTheme();
        }
        return preset;
      }
      return createCustomTheme(themeIdOrInput);
    },
    [log]
  );

  const setTheme = useCallback(
    (themeIdOrInput: string | CustomThemeInput) => {
      const theme = resolveTheme(themeIdOrInput);

      // Always log theme changes for debugging
      console.log(`[Soundscape] 🎨 setTheme: "${theme.id}" (${theme.name})`);

      // Update React state and ref
      setCurrentTheme(theme);
      currentThemeRef.current = theme;

      // CRITICAL: Clear any pending params in the sender to prevent stale old-theme params
      // from being sent after the theme change
      if (parameterSenderRef.current) {
        parameterSenderRef.current.clearPending();
        log("Cleared pending params before theme change");
      }

      // Update mapping engine to new theme
      // Pass skipTransition=true because we handle the transition directly below
      // This prevents duplicate theme transitions (one from here, one from computeParameters)
      if (mappingEngineRef.current) {
        mappingEngineRef.current.setTheme(theme, true); // skipTransition = true
        log("Updated mapping engine to theme:", theme.name);
      }

      // CRITICAL: Reset the cached parameters ref to prevent any stale theme data
      // This ensures UI reflects the new theme immediately
      parametersRef.current = null;

      // Send theme change to Scope if connected (ambient or music mode)
      if (dataChannelRef.current?.readyState === "open") {
        // Build new theme prompt
        const newBasePrompt = `${theme.basePrompt}, ${theme.styleModifiers.join(", ")}, calm atmosphere, gentle flow`;
        const newPrompts = [{ text: newBasePrompt, weight: 1.0 }];

        // Send with transition for smooth crossfade
        const themeChangeParams = {
          prompts: newPrompts,
          denoising_step_list: [...DENOISING_STEPS],
          noise_scale: 0.5,
          transition: {
            target_prompts: newPrompts,
            num_steps: AMBIENT_THEME_CHANGE_TRANSITION_STEPS,
            temporal_interpolation_method: "slerp",
          },
          manage_cache: true,
          paused: false,
        };

        try {
          dataChannelRef.current.send(JSON.stringify(themeChangeParams));
          console.log(`[Soundscape] ✅ Sent theme transition to Scope: ${theme.name} (${AMBIENT_THEME_CHANGE_TRANSITION_STEPS} frames)`);

          // CRITICAL: Mark the transition as active in MappingEngine to prevent
          // conflicting params from audio analysis during the transition
          if (mappingEngineRef.current) {
            mappingEngineRef.current.markExternalTransitionActive(AMBIENT_THEME_CHANGE_TRANSITION_STEPS);
          }
        } catch (error) {
          console.error("[Soundscape] ❌ Failed to send theme transition:", error);
        }

        // Update UI state
        const scopeParams: ScopeParameters = {
          prompts: newPrompts,
          denoisingSteps: [...DENOISING_STEPS],
          noiseScale: 0.5,
          transition: {
            target_prompts: newPrompts,
            num_steps: AMBIENT_THEME_CHANGE_TRANSITION_STEPS,
            temporal_interpolation_method: "slerp" as const,
          },
        };
        parametersRef.current = scopeParams;
        setParameters(scopeParams);
      } else {
        log("Theme changed but no data channel - will apply when connected");
      }

      setState((prev) => ({ ...prev, activeTheme: theme }));
    },
    [resolveTheme, log]
  );

  // Note: Theme is initialized synchronously in useState above

  // ============================================================================
  // Audio Connection
  // ============================================================================

  const connectAudio = useCallback(
    async (audioElement: HTMLAudioElement) => {
      try {
        log("Connecting to audio element...");

        if (analyzerRef.current && audioElementRef.current === audioElement) {
          setState((prev) => ({ ...prev, playback: "loading", error: null }));
          log("Audio element already connected");
          return;
        }

        if (analyzerRef.current) {
          analyzerRef.current.destroy();
          analyzerRef.current = null;
        }

        audioElementRef.current = audioElement;

        // Create analyzer
        const analyzer = new AudioAnalyzer();
        await analyzer.initialize(audioElement);
        analyzerRef.current = analyzer;

        // Reuse existing mapping engine if available, otherwise create new one
        // CRITICAL: Use ref to get CURRENT theme, not stale closure value
        const theme = currentThemeRef.current;

        if (mappingEngineRef.current) {
          // Engine exists - update to current theme
          mappingEngineRef.current.setTheme(theme);
          log("Reusing mapping engine with theme:", theme.name);
        } else {
          mappingEngineRef.current = new MappingEngine(theme);
          log("Created mapping engine with theme:", theme.name);
        }

        // Create parameter sender
        parameterSenderRef.current = new ParameterSender(updateRate);

        // Connect data channel if already available (Scope connected before audio)
        if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
          parameterSenderRef.current.setDataChannel(dataChannelRef.current);
          log("Connected parameter sender to existing data channel");
        }

        setState((prev) => ({ ...prev, playback: "loading", error: null }));
        log("Audio connected successfully");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to connect audio";
        setState((prev) => ({ ...prev, error: message }));
        log("Audio connection failed:", message);
        throw error;
      }
    },
    [updateRate, log] // Removed currentTheme - we use currentThemeRef instead
  );

  const disconnectAudio = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.destroy();
      analyzerRef.current = null;
    }
    audioElementRef.current = null;
    setState((prev) => ({ ...prev, playback: "idle" }));
    log("Audio disconnected");
  }, [log]);

  // ============================================================================
  // Scope Connection
  // ============================================================================

  const setDataChannel = useCallback(
    (channel: RTCDataChannel | null) => {
      // Store for later use (e.g., ambient mode)
      dataChannelRef.current = channel;

      if (parameterSenderRef.current) {
        parameterSenderRef.current.setDataChannel(channel);
      }
      setState((prev) => ({
        ...prev,
        connection: channel ? "connected" : "disconnected",
      }));
      log(channel ? "Data channel connected" : "Data channel cleared");
    },
    [log]
  );

  // ============================================================================
  // Analysis Control
  // ============================================================================

  // Debug: track analysis frames for periodic logging
  const analysisFrameCountRef = useRef(0);

  const handleAnalysis = useCallback(
    (analysis: AnalysisState) => {
      const now = performance.now();
      const shouldUpdateUi = now - lastUiUpdateRef.current >= uiUpdateIntervalMs;

      // Debug: Log that analysis is running every ~3 seconds (at 30Hz UI rate)
      analysisFrameCountRef.current++;
      if (debug && analysisFrameCountRef.current % 90 === 0) {
        const energy = analysis.derived.energy;
        const brightness = analysis.derived.brightness;
        log(`📊 Audio analysis active - Energy: ${energy.toFixed(3)}, Brightness: ${brightness.toFixed(3)}, Beat: ${analysis.beat.isBeat}`);
      }

      // Generate Scope parameters
      if (mappingEngineRef.current) {
        const params = mappingEngineRef.current.computeParameters(analysis);
        parametersRef.current = params;

        // Send to Scope if connected
        if (parameterSenderRef.current) {
          parameterSenderRef.current.send(params);
        }
      }

      if (shouldUpdateUi) {
        // Update UI state at a lower rate to avoid jank
        setState((prev) => ({ ...prev, analysis }));
        setParameters(parametersRef.current);
        lastUiUpdateRef.current = now;
      }
    },
    [uiUpdateIntervalMs, debug, log]
  );

  const start = useCallback(async () => {
    if (!analyzerRef.current) {
      log("Cannot start: no audio connected");
      return;
    }

    // Resume audio context (required after user interaction)
    await analyzerRef.current.resume();

    // Start analysis
    analyzerRef.current.start(handleAnalysis);
    setState((prev) => ({ ...prev, playback: "playing" }));
    log("Analysis started");
  }, [handleAnalysis, log]);

  const stop = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.stop();
    }
    setState((prev) => ({ ...prev, playback: "paused" }));
    log("Analysis stopped");
  }, [log]);

  // ============================================================================
  // Ambient Mode (no audio required)
  // ============================================================================

  const startAmbient = useCallback(() => {
    // Don't start if already running
    if (ambientIntervalRef.current) {
      log("Ambient: already running, skipping start");
      return;
    }

    // Need a data channel to send parameters
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      log("Cannot start ambient: no open data channel");
      return;
    }

    // CRITICAL: Use ref to get CURRENT theme, not stale closure value
    const theme = currentThemeRef.current;
    log("Ambient: starting with theme:", theme.name, `(id: ${theme.id})`);

    // Initialize mapping engine if needed (without audio analyzer)
    if (!mappingEngineRef.current) {
      mappingEngineRef.current = new MappingEngine(theme);
      log("Created mapping engine for ambient with theme:", theme.name);
    } else {
      // Ensure engine has the current theme
      mappingEngineRef.current.setTheme(theme);
      log("Updated existing mapping engine to theme:", theme.name);
    }

    // Initialize parameter sender if needed and connect data channel
    if (!parameterSenderRef.current) {
      parameterSenderRef.current = new ParameterSender(updateRate);
    }
    parameterSenderRef.current.setDataChannel(dataChannelRef.current);

    /**
     * SIMPLIFIED AMBIENT MODE - Send initial prompt ONCE, let Scope's cache handle the rest
     *
     * Previous approach: Continuous reinforcement every 1.5s was causing conflicts with
     * theme changes and creating visual "snapping" when prompts were resent.
     *
     * New approach: Send the theme prompt once with a transition, then let Scope's
     * latent cache maintain visual coherence. Theme changes are handled by setTheme().
     */

    // Build and send initial ambient parameters
    const basePrompt = `${theme.basePrompt}, ${theme.styleModifiers.join(", ")}, calm atmosphere, gentle flow`;
    const prompts = [{ text: basePrompt, weight: 1.0 }];

    const params = {
      prompts,
      denoising_step_list: [...DENOISING_STEPS],
      noise_scale: 0.5,
      transition: {
        target_prompts: prompts,
        num_steps: AMBIENT_THEME_CHANGE_TRANSITION_STEPS,
        temporal_interpolation_method: "slerp",
      },
      manage_cache: true,
      paused: false,
    };

    try {
      dataChannelRef.current.send(JSON.stringify(params));
      log("Ambient: sent initial params for theme:", theme.name);
    } catch (error) {
      log("Ambient: failed to send initial params", error);
      return;
    }

    // Update React state for UI
    const scopeParams: ScopeParameters = {
      prompts,
      denoisingSteps: [...DENOISING_STEPS],
      noiseScale: 0.5,
      transition: {
        target_prompts: prompts,
        num_steps: AMBIENT_THEME_CHANGE_TRANSITION_STEPS,
        temporal_interpolation_method: "slerp" as const,
      },
    };
    parametersRef.current = scopeParams;
    setParameters(scopeParams);

    // Mark ambient as running (no interval needed - just a flag)
    // Using a dummy interval that does nothing, just to track state
    ambientIntervalRef.current = setInterval(() => {
      // No-op: We no longer send continuous reinforcement
      // Theme changes are handled by setTheme() directly
    }, 60000); // Very long interval since it does nothing

    setState((prev) => ({ ...prev, playback: "playing" }));
  }, [updateRate, log]);

  const stopAmbient = useCallback(() => {
    if (ambientIntervalRef.current) {
      clearInterval(ambientIntervalRef.current);
      ambientIntervalRef.current = null;
      log("Ambient mode stopped");
    }
  }, [log]);

  // ============================================================================
  // Cleanup
  // ============================================================================

  useEffect(() => {
    return () => {
      disconnectAudio();
      stopAmbient();
    };
  }, [disconnectAudio, stopAmbient]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    state,
    parameters,
    presetThemes: PRESET_THEMES,
    connectAudio,
    disconnectAudio,
    setDataChannel,
    start,
    stop,
    startAmbient,
    stopAmbient,
    setTheme,
    currentTheme,
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type { Theme, AnalysisState, ScopeParameters, SoundscapeState };
