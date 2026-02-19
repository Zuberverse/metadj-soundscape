/**
 * Soundscape React Hook
 * Orchestrates audio analysis, theme mapping, and Scope parameter updates
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioAnalyzer } from "./audio-analyzer";
import { MappingEngine, ParameterSender } from "./mapping-engine";
import { PRESET_THEMES, THEMES_BY_ID, createCustomTheme } from "./themes";
import type {
  Theme,
  AnalysisState,
  ScopeParameters,
  SoundscapeState,
  CustomThemeInput,
  DenoisingProfileId,
  ReactivityProfileId,
  PromptAccent,
  PromptEntry,
} from "./types";
import {
  AMBIENT_THEME_CHANGE_TRANSITION_STEPS,
  DEFAULT_DENOISING_PROFILE_ID,
  DEFAULT_REACTIVITY_PROFILE_ID,
  DEFAULT_THEME_ID,
  DENOISING_PROFILES,
} from "./constants";

// ============================================================================
// Helper Functions
// ============================================================================

/** Get the default theme object */
const getDefaultTheme = (): Theme => THEMES_BY_ID[DEFAULT_THEME_ID];

const clampPromptAccentWeight = (weight: number): number => {
  if (!Number.isFinite(weight)) return 0.25;
  return Math.max(0.05, Math.min(1, weight));
};

const composePromptEntriesWithAccent = (basePrompt: string, accent: PromptAccent): PromptEntry[] => {
  const entries: PromptEntry[] = [{ text: basePrompt, weight: 1.0 }];
  if (accent.text.trim()) {
    entries.push({
      text: accent.text.trim(),
      weight: clampPromptAccentWeight(accent.weight),
    });
  }
  return entries;
};

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
  /** Active denoising profile */
  denoisingProfileId: DenoisingProfileId;
  /** Active reactivity profile */
  reactivityProfileId: ReactivityProfileId;
  /** Prompt accent layer */
  promptAccent: PromptAccent;
  /** Current denoising schedule */
  activeDenoisingSteps: number[];
  /** Apply denoising profile */
  setDenoisingProfile: (profileId: DenoisingProfileId) => void;
  /** Apply reactivity profile */
  setReactivityProfile: (profileId: ReactivityProfileId) => void;
  /** Set prompt accent layer */
  setPromptAccent: (text: string, weight?: number) => void;
  /** Compose prompt entries with optional accent layer */
  composePromptEntries: (basePrompt: string) => PromptEntry[];
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

  const effectiveUpdateRate = Number.isFinite(updateRate) && updateRate > 0 ? updateRate : 30;
  const effectiveUiUpdateRate = Number.isFinite(uiUpdateRate) && uiUpdateRate > 0 ? uiUpdateRate : 10;

  // Core refs
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const mappingEngineRef = useRef<MappingEngine | null>(null);
  const parameterSenderRef = useRef<ParameterSender | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const lastUiUpdateRef = useRef(0);
  const uiUpdateIntervalMs = 1000 / effectiveUiUpdateRate;

  // Ambient mode refs
  const isAmbientActiveRef = useRef(false);

  // Data channel ref (stored for ambient mode to use)
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // State - initialize theme synchronously
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => getInitialTheme());
  const [denoisingProfileId, setDenoisingProfileId] =
    useState<DenoisingProfileId>(DEFAULT_DENOISING_PROFILE_ID);
  const [reactivityProfileId, setReactivityProfileId] =
    useState<ReactivityProfileId>(DEFAULT_REACTIVITY_PROFILE_ID);
  const [promptAccent, setPromptAccentState] = useState<PromptAccent>({
    text: "",
    weight: 0.25,
  });

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
  const activeDenoisingSteps = useMemo(
    () =>
      [...(DENOISING_PROFILES[denoisingProfileId] ?? DENOISING_PROFILES[DEFAULT_DENOISING_PROFILE_ID])],
    [denoisingProfileId]
  );

  const composePromptEntries = useCallback(
    (basePrompt: string): PromptEntry[] => {
      return composePromptEntriesWithAccent(basePrompt, promptAccent);
    },
    [promptAccent]
  );

  const pushScopeParameters = useCallback(
    ({
      theme = currentThemeRef.current,
      accent = promptAccent,
      denoisingSteps = activeDenoisingSteps,
      includeTransition = false,
      requireAmbient = true,
    }: {
      theme?: Theme;
      accent?: PromptAccent;
      denoisingSteps?: number[];
      includeTransition?: boolean;
      requireAmbient?: boolean;
    } = {}): boolean => {
      if (requireAmbient && !isAmbientActiveRef.current) {
        return false;
      }

      const channel = dataChannelRef.current;
      if (!channel || channel.readyState !== "open") {
        return false;
      }

      const basePrompt = `${theme.basePrompt}, ${theme.styleModifiers.join(", ")}, calm atmosphere, gentle flow`;
      const prompts = composePromptEntriesWithAccent(basePrompt, accent);
      const safeDenoisingSteps = [...denoisingSteps];

      const params: Record<string, unknown> = {
        prompts,
        denoising_step_list: safeDenoisingSteps,
        noise_scale: 0.5,
        manage_cache: true,
        paused: false,
      };

      if (includeTransition) {
        params.transition = {
          target_prompts: prompts,
          num_steps: AMBIENT_THEME_CHANGE_TRANSITION_STEPS,
          temporal_interpolation_method: "slerp",
        };
      }

      try {
        channel.send(JSON.stringify(params));
      } catch (error) {
        console.warn("[Soundscape] Failed to send Scope params:", error);
        setState((prev) => ({
          ...prev,
          error: "Scope parameter sync failed — visuals may be out of date.",
        }));
        return false;
      }

      const scopeParams: ScopeParameters = {
        prompts,
        denoisingSteps: safeDenoisingSteps,
        noiseScale: 0.5,
        ...(includeTransition
          ? {
              transition: {
                target_prompts: prompts,
                num_steps: AMBIENT_THEME_CHANGE_TRANSITION_STEPS,
                temporal_interpolation_method: "slerp" as const,
              },
            }
          : {}),
      };

      parametersRef.current = scopeParams;
      setParameters(scopeParams);
      return true;
    },
    [promptAccent, activeDenoisingSteps]
  );

  const applyEngineControls = useCallback(
    (engine: MappingEngine) => {
      engine.setDenoisingSteps(activeDenoisingSteps);
      engine.setReactivityProfile(reactivityProfileId);
      engine.setPromptOverlay(
        promptAccent.text.trim()
          ? { text: promptAccent.text.trim(), weight: clampPromptAccentWeight(promptAccent.weight) }
          : null
      );
    },
    [activeDenoisingSteps, reactivityProfileId, promptAccent]
  );

  // Debug logger
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[Soundscape]", ...args);
      }
    },
    [debug]
  );

  const disposeParameterSender = useCallback(() => {
    if (!parameterSenderRef.current) {
      return;
    }

    parameterSenderRef.current.dispose();
    parameterSenderRef.current = null;
  }, []);

  const setDenoisingProfile = useCallback(
    (profileId: DenoisingProfileId) => {
      if (!DENOISING_PROFILES[profileId]) {
        return;
      }

      const nextDenoisingSteps = [...DENOISING_PROFILES[profileId]];
      setDenoisingProfileId(profileId);
      mappingEngineRef.current?.setDenoisingSteps(nextDenoisingSteps);

      // Keep ambient mode in sync when playback is paused.
      pushScopeParameters({ denoisingSteps: nextDenoisingSteps });
    },
    [pushScopeParameters]
  );

  const setReactivityProfile = useCallback((profileId: ReactivityProfileId) => {
    setReactivityProfileId(profileId);
    mappingEngineRef.current?.setReactivityProfile(profileId);
  }, []);

  const setPromptAccent = useCallback(
    (text: string, weight = 0.25) => {
      const nextAccent: PromptAccent = {
        text: text.trim(),
        weight: clampPromptAccentWeight(weight),
      };

      setPromptAccentState(nextAccent);
      mappingEngineRef.current?.setPromptOverlay(
        nextAccent.text
          ? { text: nextAccent.text, weight: nextAccent.weight }
          : null
      );

      // Keep ambient mode in sync when playback is paused.
      pushScopeParameters({ accent: nextAccent });
    },
    [pushScopeParameters]
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

      log(`🎨 setTheme: "${theme.id}" (${theme.name})`);

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
      const didSendThemeTransition = pushScopeParameters({
        theme,
        includeTransition: true,
        requireAmbient: false,
      });
      if (didSendThemeTransition) {
        log(`Sent theme transition to Scope: ${theme.name} (${AMBIENT_THEME_CHANGE_TRANSITION_STEPS} frames)`);

        // CRITICAL: Mark the transition as active in MappingEngine to prevent
        // conflicting params from audio analysis during the transition
        if (mappingEngineRef.current) {
          mappingEngineRef.current.markExternalTransitionActive(AMBIENT_THEME_CHANGE_TRANSITION_STEPS);
        }
      } else {
        log("Theme changed but no data channel - will apply when connected");
      }

      setState((prev) => ({ ...prev, activeTheme: theme }));
    },
    [resolveTheme, pushScopeParameters, log]
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
          applyEngineControls(mappingEngineRef.current);
          log("Reusing mapping engine with theme:", theme.name);
        } else {
          mappingEngineRef.current = new MappingEngine(theme);
          applyEngineControls(mappingEngineRef.current);
          log("Created mapping engine with theme:", theme.name);
        }

        // Create parameter sender
        parameterSenderRef.current = new ParameterSender(effectiveUpdateRate);

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
    [effectiveUpdateRate, applyEngineControls, log] // Removed currentTheme - we use currentThemeRef instead
  );

  const disconnectAudio = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.destroy();
      analyzerRef.current = null;
    }
    disposeParameterSender();
    audioElementRef.current = null;
    lastUiUpdateRef.current = 0;
    parametersRef.current = null;
    setParameters(null);
    setState((prev) => ({
      ...prev,
      playback: "idle",
      analysis: null,
      stats: null,
    }));
    log("Audio disconnected");
  }, [disposeParameterSender, log]);

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
      if (!channel) {
        isAmbientActiveRef.current = false;
      }
      setState((prev) => ({
        ...prev,
        connection: channel ? "connected" : "disconnected",
      }));
      log(channel ? "Data channel connected" : "Data channel cleared");
    },
    [log]
  );

  useEffect(() => {
    if (mappingEngineRef.current) {
      applyEngineControls(mappingEngineRef.current);
    }
  }, [applyEngineControls]);

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
    try {
      await analyzerRef.current.resume();
    } catch (error) {
      console.error("[Soundscape] AudioContext resume failed:", error);
      setState((prev) => ({
        ...prev,
        error: "Audio could not start. Try tapping the page to enable audio playback.",
      }));
      return;
    }

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
    if (isAmbientActiveRef.current) {
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
      applyEngineControls(mappingEngineRef.current);
      log("Created mapping engine for ambient with theme:", theme.name);
    } else {
      // Ensure engine has the current theme
      mappingEngineRef.current.setTheme(theme);
      applyEngineControls(mappingEngineRef.current);
      log("Updated existing mapping engine to theme:", theme.name);
    }

    // Initialize parameter sender if needed and connect data channel
    if (!parameterSenderRef.current) {
      parameterSenderRef.current = new ParameterSender(effectiveUpdateRate);
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

    const didSendAmbientStart = pushScopeParameters({
      theme,
      includeTransition: true,
      requireAmbient: false,
    });
    if (!didSendAmbientStart) {
      log("Ambient: failed to send initial params");
      return;
    }
    log("Ambient: sent initial params for theme:", theme.name);

    isAmbientActiveRef.current = true;

    setState((prev) => ({ ...prev, playback: "playing" }));
  }, [effectiveUpdateRate, applyEngineControls, pushScopeParameters, log]);

  const stopAmbient = useCallback(() => {
    if (isAmbientActiveRef.current) {
      isAmbientActiveRef.current = false;
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
    denoisingProfileId,
    reactivityProfileId,
    promptAccent,
    activeDenoisingSteps,
    setDenoisingProfile,
    setReactivityProfile,
    setPromptAccent,
    composePromptEntries,
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type { Theme, AnalysisState, ScopeParameters, SoundscapeState };
