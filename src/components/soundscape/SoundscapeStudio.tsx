/**
 * Soundscape Studio Component
 * Video-first layout with collapsible controls
 */

"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  useSoundscape,
  ASPECT_RESOLUTION_PRESETS,
  DEFAULT_RUNTIME_TUNING_SETTINGS,
  DEFAULT_ASPECT_RATIO,
  DENOISING_PROFILES,
  MAX_RECONNECT_ATTEMPTS,
  MOTION_PACE_PROFILES,
  REACTIVITY_PROFILES,
  RECONNECT_BASE_DELAY_MS,
  RUNTIME_TUNING_BOUNDS,
  type DenoisingProfileId,
  type MotionPaceProfileId,
  type ReactivityProfileId,
  type RuntimeTuningSettings,
} from "@/lib/soundscape";
import type { AspectRatioConfig } from "@/lib/soundscape";
import { getScopeClient, useScopeConnection } from "@/lib/scope";
import type {
  HealthResponse,
  PipelineDescriptor,
  PipelineStatusResponse,
  ScopeInputSourceConfig,
} from "@/lib/scope";
import { AudioPlayer, type AudioPlayerControls } from "./AudioPlayer";
import { ThemeSelector } from "./ThemeSelector";
import { AnalysisMeter } from "./AnalysisMeter";
import { AspectRatioToggle } from "./AspectRatioToggle";

// Default pipeline for Soundscape (longlive = stylized, smooth transitions)
const DEFAULT_PIPELINE = "longlive";
const NO_PREPROCESSOR = "__none__";
const DEFAULT_PIPELINE_DESCRIPTOR: PipelineDescriptor = {
  id: DEFAULT_PIPELINE,
  name: "LongLive",
  usage: [],
  source: "unknown",
};

const WARNING_DROPPED_FRAME_PERCENT = 5;
const CRITICAL_DROPPED_FRAME_PERCENT = 12;
const WARNING_FPS_THRESHOLD = 10;
const AUTO_THEME_BPM_CONFIDENCE_THRESHOLD = 0.45;
const AUTO_THEME_BEAT_ESTIMATE_MIN_BPM = 60;
const AUTO_THEME_BEAT_ESTIMATE_MAX_BPM = 200;
const AUTO_THEME_MAX_ESTIMATED_BEAT_INCREMENT = 8;
const AUTO_THEME_SECTION_BEAT_OPTIONS = [16, 32, 64] as const;

const clampRuntimeSetting = (
  key: keyof RuntimeTuningSettings,
  value: number
): number => {
  const bounds = RUNTIME_TUNING_BOUNDS[key];
  if (!Number.isFinite(value)) {
    return DEFAULT_RUNTIME_TUNING_SETTINGS[key];
  }
  return Math.max(bounds.min, Math.min(bounds.max, value));
};

type DiagnosticsRefreshResult = {
  isHealthy: boolean;
  resolvedPipeline: string;
  resolvedPreprocessor: string;
};

interface VideoStats {
  width: number;
  height: number;
  totalFrames: number | null;
  droppedFrames: number | null;
  fps: number | null;
}

interface ScopeCapabilities {
  hardwareSummary: string;
  freeVramGb: number | null;
  totalVramGb: number | null;
  modelReady: boolean | null;
  loraCount: number;
  pluginCount: number;
  ndiAvailable: boolean;
  spoutAvailable: boolean;
}

/**
 * Props for the SoundscapeStudio component.
 */
interface SoundscapeStudioProps {
  /**
   * Callback fired when Scope connection state changes.
   * Useful for parent components that need to show connection status.
   * @param connected - True when video stream is active
   */
  onConnectionChange?: (connected: boolean) => void;
  /** Whether to show visual enhancement (contrast/saturation) */
  sharpenEnabled?: boolean;
  /** Whether to show bottom controls dock */
  showControls?: boolean;
  /** Callback to register the disconnect handler with the parent */
  onRegisterDisconnect?: (disconnectFn: () => void) => void;
  /** Whether global hotkeys should be active */
  hotkeysEnabled?: boolean;
}

export function SoundscapeStudio({
  onConnectionChange,
  sharpenEnabled: sharpenEnabledProp,
  showControls: showControlsProp,
  onRegisterDisconnect,
  hotkeysEnabled = true,
}: SoundscapeStudioProps) {
  // Scope connection state
  const [scopeStream, setScopeStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const transportControlsRef = useRef<AudioPlayerControls | null>(null);
  const shouldAutoPlayDemoOnNextConnectRef = useRef(false);
  const previousFrameSampleRef = useRef<{ timestamp: number; totalFrames: number } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const processedBeatTimestampRef = useRef<number>(0);
  const autoThemeBeatCounterRef = useRef(0);
  const scopePcRef = useRef<RTCPeerConnection | null>(null);
  const scopeDataChannelRef = useRef<RTCDataChannel | null>(null);
  const attemptedNoFrameRecoveryRef = useRef(false);
  const codecStrategyRef = useRef<"vp8-preferred" | "browser-default">("vp8-preferred");
  const connectionProfileRef = useRef<"modern" | "legacy-minimal">("modern");

  // UI state - use props if provided (controlled), otherwise internal state (uncontrolled)
  const [hasLaunched, setHasLaunched] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [autoPlayDemoOnLaunch, setAutoPlayDemoOnLaunch] = useState(true);
  const [transportControlsVersion, setTransportControlsVersion] = useState(0);
  const [mounted, setMounted] = useState(false);

  const showControls = showControlsProp ?? true;
  const sharpenEnabled = sharpenEnabledProp ?? true;

  const handleRegisterAudioControls = useCallback((controls: AudioPlayerControls | null) => {
    transportControlsRef.current = controls;
    setTransportControlsVersion((previous) => previous + 1);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Aspect ratio state (first-launch default: 16:9 Low tier at 576x320)
  const [aspectRatio, setAspectRatio] = useState<AspectRatioConfig>(DEFAULT_ASPECT_RATIO);
  const [selectedPipeline, setSelectedPipeline] = useState(DEFAULT_PIPELINE);
  const [selectedPreprocessor, setSelectedPreprocessor] = useState(NO_PREPROCESSOR);
  const [availablePipelines, setAvailablePipelines] = useState<PipelineDescriptor[]>([
    DEFAULT_PIPELINE_DESCRIPTOR,
  ]);
  const [scopeHealth, setScopeHealth] = useState<HealthResponse | null>(null);
  const [hasResolvedInitialScopeHealth, setHasResolvedInitialScopeHealth] = useState(false);
  const [, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [, setLastScopeCheckAt] = useState<number | null>(null);
  const [videoStats, setVideoStats] = useState<VideoStats>({
    width: 0,
    height: 0,
    totalFrames: null,
    droppedFrames: null,
    fps: null,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordedClipUrl, setRecordedClipUrl] = useState<string | null>(null);
  const [, setRecordedClipMimeType] = useState<string | null>(null);
  const [recordedClipSeconds, setRecordedClipSeconds] = useState<number | null>(null);
  const [autoThemeEnabled, setAutoThemeEnabled] = useState(false);
  const [autoThemeSectionBeats, setAutoThemeSectionBeats] = useState(32);
  const [ndiEnabled, setNdiEnabled] = useState(false);
  const [ndiStreamName, setNdiStreamName] = useState("Soundscape NDI");
  const [spoutEnabled, setSpoutEnabled] = useState(false);
  const [spoutStreamName, setSpoutStreamName] = useState("Soundscape Spout");
  const [scopeCapabilities, setScopeCapabilities] = useState<ScopeCapabilities>({
    hardwareSummary: "Unknown",
    freeVramGb: null,
    totalVramGb: null,
    modelReady: null,
    loraCount: 0,
    pluginCount: 0,
    ndiAvailable: false,
    spoutAvailable: false,
  });
  const scopeClient = useMemo(() => getScopeClient(), []);
  const hasLoadedInitialDiagnostics = useRef(false);

  const isPreprocessorPipeline = useCallback((pipeline: PipelineDescriptor) => {
    return pipeline.usage.some((usage) => usage.toLowerCase() === "preprocessor");
  }, []);

  const mainPipelineOptions = useMemo(
    () => availablePipelines.filter((pipeline) => !isPreprocessorPipeline(pipeline)),
    [availablePipelines, isPreprocessorPipeline]
  );

  const preprocessorOptions = useMemo(
    () => availablePipelines.filter((pipeline) => isPreprocessorPipeline(pipeline)),
    [availablePipelines, isPreprocessorPipeline]
  );

  const activePipelineChain = useMemo(() => {
    if (selectedPreprocessor !== NO_PREPROCESSOR && (ndiEnabled || spoutEnabled)) {
      return `${selectedPreprocessor} → ${selectedPipeline}`;
    }
    if (selectedPreprocessor !== NO_PREPROCESSOR) {
      return `${selectedPreprocessor} (video-only inactive) → ${selectedPipeline}`;
    }
    return selectedPipeline;
  }, [selectedPreprocessor, selectedPipeline, ndiEnabled, spoutEnabled]);

  const {
    state: soundscapeState,
    parameters: soundscapeParameters,
    presetThemes,
    connectAudio,
    disconnectAudio,
    setDataChannel,
    start,
    stop,
    setTheme,
    currentTheme,
    startAmbient,
    stopAmbient,
    denoisingProfileId,
    reactivityProfileId,
    motionPaceProfileId,
    promptAccent,
    activeDenoisingSteps,
    setDenoisingProfile,
    setReactivityProfile,
    setMotionPaceProfile,
    setPromptAccent,
    runtimeTuning,
    setRuntimeTuning,
    resetRuntimeTuning,
    composePromptEntries,
  } = useSoundscape({
    initialTheme: "astral",
    debug: process.env.NODE_ENV === "development",
  });

  // Track if audio is ready
  const [audioReady, setAudioReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoAutoplayBlocked, setVideoAutoplayBlocked] = useState(false);

  const runtimeMode = useMemo<"audio-reactive" | "ambient" | "inactive">(() => {
    if (!scopeStream) return "inactive";
    if (isPlaying && audioReady) return "audio-reactive";
    return "ambient";
  }, [scopeStream, isPlaying, audioReady]);

  const runtimeModeLabel = useMemo(() => {
    if (runtimeMode === "audio-reactive") return "Audio Reactive";
    if (runtimeMode === "ambient") return "Ambient Hold";
    return "Inactive";
  }, [runtimeMode]);

  const runtimeSignalLabel = useMemo(() => {
    if (runtimeMode !== "audio-reactive") {
      return "No live audio mapping";
    }
    if (!soundscapeState.analysis) {
      return "Waiting for analysis frames";
    }
    const derived = soundscapeState.analysis.derived;
    // Format to an integer percentage to avoid visual flickering from rapid decimal changes
    const energy = Math.round(derived.energy * 100).toString().padStart(2, '0') + '%';
    const bpm = soundscapeState.analysis.beat.bpm;
    const beat = bpm ? `${Math.round(bpm)} BPM` : '--- BPM';
    return `Energy ${energy} · ${beat}`;
  }, [runtimeMode, soundscapeState.analysis]);

  // Handle audio element connection
  const handleAudioElement = useCallback(
    async (element: HTMLAudioElement | null) => {
      audioElementRef.current = element;
      if (element) {
        try {
          await connectAudio(element);
          setAudioReady(true);
        } catch (error) {
          console.error("Failed to connect audio:", error);
          setAudioReady(false);
        }
      } else {
        disconnectAudio();
        setAudioReady(false);
        setIsPlaying(false);
      }
    },
    [connectAudio, disconnectAudio]
  );

  // Handle play state changes
  const handlePlayStateChange = useCallback(
    (playing: boolean) => {
      setIsPlaying(playing);
    },
    []
  );

  // Restart audio analysis when audio becomes ready or play state changes
  useEffect(() => {
    if (isPlaying && audioReady) {
      stopAmbient();
      start();
    } else {
      // Any non-audio-reactive state falls back to ambient hold when Scope is connected.
      stop();
      if (scopeStream) {
        startAmbient();
      }
    }
  }, [isPlaying, audioReady, scopeStream, start, stop, startAmbient, stopAmbient]);

  const handleDenoisingProfileChange = useCallback(
    (value: string) => {
      if (value in DENOISING_PROFILES) {
        setDenoisingProfile(value as DenoisingProfileId);
      }
    },
    [setDenoisingProfile]
  );

  const handleReactivityProfileChange = useCallback(
    (value: string) => {
      if (value in REACTIVITY_PROFILES) {
        setReactivityProfile(value as ReactivityProfileId);
      }
    },
    [setReactivityProfile]
  );

  const handleMotionPaceProfileChange = useCallback(
    (value: string) => {
      if (value in MOTION_PACE_PROFILES) {
        setMotionPaceProfile(value as MotionPaceProfileId);
      }
    },
    [setMotionPaceProfile]
  );

  const handlePromptAccentWeightChange = useCallback(
    (weight: number) => {
      setPromptAccent(promptAccent.text, weight);
    },
    [setPromptAccent, promptAccent.text]
  );

  const handleRuntimeTuningChange = useCallback(
    (key: keyof RuntimeTuningSettings, value: number) => {
      setRuntimeTuning({ [key]: clampRuntimeSetting(key, value) });
    },
    [setRuntimeTuning]
  );

  const handleRuntimeTuningReset = useCallback(() => {
    resetRuntimeTuning();
  }, [resetRuntimeTuning]);

  const refreshScopeDiagnostics = useCallback(async (): Promise<DiagnosticsRefreshResult> => {
    setIsDiagnosticsLoading(true);
    setDiagnosticsError(null);

    const fallbackPipeline = selectedPipeline || DEFAULT_PIPELINE;

    try {
      const health = await scopeClient.checkHealth();
      setScopeHealth(health);
      setLastScopeCheckAt(Date.now());

      if (health.status !== "ok") {
        setPipelineStatus(null);
        setDiagnosticsError("Scope server unavailable. Verify SCOPE_API_URL and server health.");
        setAvailablePipelines([DEFAULT_PIPELINE_DESCRIPTOR]);
        setSelectedPipeline(DEFAULT_PIPELINE);
        setSelectedPreprocessor(NO_PREPROCESSOR);
        setScopeCapabilities({
          hardwareSummary: "Unknown",
          freeVramGb: null,
          totalVramGb: null,
          modelReady: null,
          loraCount: 0,
          pluginCount: 0,
          ndiAvailable: false,
          spoutAvailable: false,
        });
        return {
          isHealthy: false,
          resolvedPipeline: DEFAULT_PIPELINE,
          resolvedPreprocessor: NO_PREPROCESSOR,
        };
      }

      const [pipelines, status, hardwareInfo, modelStatus, loras, plugins] = await Promise.all([
        scopeClient.getPipelineDescriptors(),
        scopeClient.getPipelineStatus(),
        scopeClient.getHardwareInfo(),
        scopeClient.getModelStatus(selectedPipeline),
        scopeClient.getLoraList(),
        scopeClient.getPlugins(),
      ]);

      setPipelineStatus(status);
      const totalVramMb =
        typeof hardwareInfo?.total_vram_mb === "number" ? hardwareInfo.total_vram_mb : null;
      const freeVramMb =
        typeof hardwareInfo?.free_vram_mb === "number" ? hardwareInfo.free_vram_mb : null;
      const gpuName =
        (typeof hardwareInfo?.gpu_name === "string" && hardwareInfo.gpu_name) ||
        (typeof hardwareInfo?.gpu === "string" && hardwareInfo.gpu) ||
        health.gpu ||
        "Unknown GPU";

      const modelReady = (() => {
        if (!modelStatus || typeof modelStatus !== "object") return null;
        const record = modelStatus as Record<string, unknown>;
        if (typeof record.ready === "boolean") return record.ready;
        if (typeof record.downloaded === "boolean") return record.downloaded;
        if (typeof record.status === "string") {
          return ["ready", "downloaded", "ok"].includes(record.status.toLowerCase());
        }
        if (record[selectedPipeline] && typeof record[selectedPipeline] === "object") {
          const selected = record[selectedPipeline] as Record<string, unknown>;
          if (typeof selected.ready === "boolean") return selected.ready;
          if (typeof selected.downloaded === "boolean") return selected.downloaded;
          if (typeof selected.status === "string") {
            return ["ready", "downloaded", "ok"].includes(selected.status.toLowerCase());
          }
        }
        return null;
      })();

      setScopeCapabilities({
        hardwareSummary: gpuName,
        freeVramGb: freeVramMb !== null ? freeVramMb / 1024 : null,
        totalVramGb: totalVramMb !== null ? totalVramMb / 1024 : null,
        modelReady,
        loraCount: loras.length,
        pluginCount: plugins.length,
        ndiAvailable: !!hardwareInfo?.ndi_available,
        spoutAvailable: !!hardwareInfo?.spout_available,
      });

      if (pipelines.length > 0) {
        const sorted = [...pipelines].sort((a, b) => a.name.localeCompare(b.name));
        const mainPipelines = sorted.filter((pipeline) => !isPreprocessorPipeline(pipeline));
        const preprocessors = sorted.filter((pipeline) => isPreprocessorPipeline(pipeline));

        const resolvedPipeline = mainPipelines.some((pipeline) => pipeline.id === selectedPipeline)
          ? selectedPipeline
          : mainPipelines.some((pipeline) => pipeline.id === DEFAULT_PIPELINE)
            ? DEFAULT_PIPELINE
            : mainPipelines[0]?.id ?? DEFAULT_PIPELINE;

        const resolvedPreprocessor =
          selectedPreprocessor !== NO_PREPROCESSOR &&
            preprocessors.some((pipeline) => pipeline.id === selectedPreprocessor)
            ? selectedPreprocessor
            : NO_PREPROCESSOR;

        setAvailablePipelines(sorted);
        setSelectedPipeline(resolvedPipeline);
        setSelectedPreprocessor(resolvedPreprocessor);
        return {
          isHealthy: true,
          resolvedPipeline,
          resolvedPreprocessor,
        };
      } else {
        setDiagnosticsError("Connected to Scope, but no pipeline schemas were returned.");
        setAvailablePipelines([DEFAULT_PIPELINE_DESCRIPTOR]);
        setSelectedPipeline(DEFAULT_PIPELINE);
        setSelectedPreprocessor(NO_PREPROCESSOR);
        return {
          isHealthy: true,
          resolvedPipeline: DEFAULT_PIPELINE,
          resolvedPreprocessor: NO_PREPROCESSOR,
        };
      }
    } catch (error) {
      setDiagnosticsError(
        error instanceof Error ? error.message : "Failed to refresh Scope diagnostics"
      );
      return {
        isHealthy: false,
        resolvedPipeline: fallbackPipeline,
        resolvedPreprocessor: NO_PREPROCESSOR,
      };
    } finally {
      setIsDiagnosticsLoading(false);
      setHasResolvedInitialScopeHealth(true);
    }
  }, [scopeClient, isPreprocessorPipeline, selectedPipeline, selectedPreprocessor]);

  // Connect video stream to element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    if (scopeStream) {
      console.log("[Scope] Attaching stream to video element");

      // Monitor track unmute - video may arrive muted and unmute when frames flow
      const tracks = scopeStream.getVideoTracks();
      tracks.forEach(track => {
        console.log("[Scope] Video track initial state:", { muted: track.muted, readyState: track.readyState });
        if (track.muted) {
          const handleUnmute = () => {
            console.log("[Scope] Video track unmuted - frames should be flowing");
            void videoElement.play().catch(() => { });
          };
          track.addEventListener("unmute", handleUnmute, { once: true });
        }
      });

      videoElement.srcObject = scopeStream;
      videoElement.play().catch((err) => {
        console.warn("[Soundscape] Video autoplay blocked:", err.message);
        setVideoAutoplayBlocked(true);
      });
      return;
    }

    if (videoElement.srcObject) {
      videoElement.pause();
      videoElement.srcObject = null;
    }
  }, [scopeStream]);

  useEffect(() => {
    if (hasLoadedInitialDiagnostics.current) return;
    hasLoadedInitialDiagnostics.current = true;
    void refreshScopeDiagnostics();
  }, [refreshScopeDiagnostics]);

  const hasHydratedFromStorage = useRef(false);
  useEffect(() => {
    if (hasHydratedFromStorage.current) return;
    hasHydratedFromStorage.current = true;
    try {
      const storedAspectMode = window.localStorage.getItem("soundscape.aspectRatio.mode");
      const storedAspectWidth = Number(window.localStorage.getItem("soundscape.aspectRatio.width") ?? "");
      const storedAspectHeight = Number(window.localStorage.getItem("soundscape.aspectRatio.height") ?? "");
      if (storedAspectMode === "16:9" || storedAspectMode === "9:16") {
        const matchedPreset = ASPECT_RESOLUTION_PRESETS[storedAspectMode].find(
          (preset) =>
            preset.config.resolution.width === storedAspectWidth &&
            preset.config.resolution.height === storedAspectHeight
        );
        if (matchedPreset) {
          setAspectRatio(matchedPreset.config);
        }
      }

      // Pipeline and preprocessor are NOT restored here — they are validated
      // against server-reported schemas in refreshScopeDiagnostics() which runs
      // on mount. Blindly restoring stale values causes a visible flash when
      // diagnostics resolves them back to valid IDs.
      const storedDenoisingProfile = window.localStorage.getItem("soundscape.denoisingProfile");
      if (storedDenoisingProfile && storedDenoisingProfile in DENOISING_PROFILES) {
        setDenoisingProfile(storedDenoisingProfile as DenoisingProfileId);
      }
      const storedReactivity = window.localStorage.getItem("soundscape.reactivityProfile");
      if (storedReactivity && storedReactivity in REACTIVITY_PROFILES) {
        setReactivityProfile(storedReactivity as ReactivityProfileId);
      }
      const storedMotionPace = window.localStorage.getItem("soundscape.motionPaceProfile");
      if (storedMotionPace && storedMotionPace in MOTION_PACE_PROFILES) {
        setMotionPaceProfile(storedMotionPace as MotionPaceProfileId);
      }
      const storedAccentText = window.localStorage.getItem("soundscape.promptAccent.text") ?? "";
      const storedAccentWeight = Number(window.localStorage.getItem("soundscape.promptAccent.weight") ?? "0.25");
      const validAccentWeight =
        Number.isFinite(storedAccentWeight) && storedAccentWeight >= 0.05 && storedAccentWeight <= 1
          ? storedAccentWeight
          : 0.25;
      setPromptAccent(storedAccentText, validAccentWeight);
      const storedBeatBoostScale = Number(window.localStorage.getItem("soundscape.runtimeTuning.beatBoostScale") ?? "");
      const storedSpikeBoostScale = Number(window.localStorage.getItem("soundscape.runtimeTuning.spikeBoostScale") ?? "");
      const storedSpikeVariationWeightScale = Number(
        window.localStorage.getItem("soundscape.runtimeTuning.spikeVariationWeightScale") ?? ""
      );
      const storedTempoThresholdScale = Number(
        window.localStorage.getItem("soundscape.runtimeTuning.tempoThresholdScale") ?? ""
      );
      const storedNoiseCeiling = Number(window.localStorage.getItem("soundscape.runtimeTuning.noiseCeiling") ?? "");
      setRuntimeTuning({
        beatBoostScale: clampRuntimeSetting("beatBoostScale", storedBeatBoostScale),
        spikeBoostScale: clampRuntimeSetting("spikeBoostScale", storedSpikeBoostScale),
        spikeVariationWeightScale: clampRuntimeSetting(
          "spikeVariationWeightScale",
          storedSpikeVariationWeightScale
        ),
        tempoThresholdScale: clampRuntimeSetting("tempoThresholdScale", storedTempoThresholdScale),
        noiseCeiling: clampRuntimeSetting("noiseCeiling", storedNoiseCeiling),
      });
      const storedAutoThemeEnabled = window.localStorage.getItem("soundscape.autoTheme.enabled");
      if (storedAutoThemeEnabled === "true" || storedAutoThemeEnabled === "false") {
        setAutoThemeEnabled(storedAutoThemeEnabled === "true");
      }
      const storedAutoThemeSectionBeats = Number(
        window.localStorage.getItem("soundscape.autoTheme.sectionBeats") ?? ""
      );
      if (AUTO_THEME_SECTION_BEAT_OPTIONS.includes(storedAutoThemeSectionBeats as 16 | 32 | 64)) {
        setAutoThemeSectionBeats(storedAutoThemeSectionBeats);
      }
      const storedAutoPlayDemoOnLaunch = window.localStorage.getItem("soundscape.autoPlayDemoOnLaunch");
      if (storedAutoPlayDemoOnLaunch === "true" || storedAutoPlayDemoOnLaunch === "false") {
        setAutoPlayDemoOnLaunch(storedAutoPlayDemoOnLaunch === "true");
      }
    } catch {
      // localStorage unavailable (e.g., Safari private browsing)
    }
  }, [setDenoisingProfile, setPromptAccent, setReactivityProfile, setMotionPaceProfile, setRuntimeTuning]);

  useEffect(() => {
    try {
      window.localStorage.setItem("soundscape.aspectRatio.mode", aspectRatio.mode);
      window.localStorage.setItem("soundscape.aspectRatio.width", String(aspectRatio.resolution.width));
      window.localStorage.setItem("soundscape.aspectRatio.height", String(aspectRatio.resolution.height));
    } catch {
      // localStorage unavailable
    }
  }, [aspectRatio]);

  useEffect(() => {
    try { window.localStorage.setItem("soundscape.pipeline", selectedPipeline); } catch { /* storage unavailable */ }
  }, [selectedPipeline]);

  useEffect(() => {
    try { window.localStorage.setItem("soundscape.preprocessor", selectedPreprocessor); } catch { /* storage unavailable */ }
  }, [selectedPreprocessor]);

  useEffect(() => {
    try { window.localStorage.setItem("soundscape.denoisingProfile", denoisingProfileId); } catch { /* storage unavailable */ }
  }, [denoisingProfileId]);

  useEffect(() => {
    try { window.localStorage.setItem("soundscape.reactivityProfile", reactivityProfileId); } catch { /* storage unavailable */ }
  }, [reactivityProfileId]);

  useEffect(() => {
    try { window.localStorage.setItem("soundscape.motionPaceProfile", motionPaceProfileId); } catch { /* storage unavailable */ }
  }, [motionPaceProfileId]);

  useEffect(() => {
    try {
      window.localStorage.setItem("soundscape.promptAccent.text", promptAccent.text);
      window.localStorage.setItem("soundscape.promptAccent.weight", String(promptAccent.weight));
    } catch { /* storage unavailable */ }
  }, [promptAccent]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "soundscape.runtimeTuning.beatBoostScale",
        String(runtimeTuning.beatBoostScale)
      );
      window.localStorage.setItem(
        "soundscape.runtimeTuning.spikeBoostScale",
        String(runtimeTuning.spikeBoostScale)
      );
      window.localStorage.setItem(
        "soundscape.runtimeTuning.spikeVariationWeightScale",
        String(runtimeTuning.spikeVariationWeightScale)
      );
      window.localStorage.setItem(
        "soundscape.runtimeTuning.tempoThresholdScale",
        String(runtimeTuning.tempoThresholdScale)
      );
      window.localStorage.setItem(
        "soundscape.runtimeTuning.noiseCeiling",
        String(runtimeTuning.noiseCeiling)
      );
    } catch {
      // storage unavailable
    }
  }, [runtimeTuning]);

  useEffect(() => {
    try { window.localStorage.setItem("soundscape.autoTheme.enabled", String(autoThemeEnabled)); } catch { /* storage unavailable */ }
  }, [autoThemeEnabled]);

  useEffect(() => {
    try { window.localStorage.setItem("soundscape.autoTheme.sectionBeats", String(autoThemeSectionBeats)); } catch { /* storage unavailable */ }
  }, [autoThemeSectionBeats]);

  useEffect(() => {
    try { window.localStorage.setItem("soundscape.autoPlayDemoOnLaunch", String(autoPlayDemoOnLaunch)); } catch { /* storage unavailable */ }
  }, [autoPlayDemoOnLaunch]);

  useEffect(() => {
    if (!scopeStream) {
      attemptedNoFrameRecoveryRef.current = false;
      codecStrategyRef.current = "vp8-preferred";
      connectionProfileRef.current = "modern";
      previousFrameSampleRef.current = null;
      setVideoStats({ width: 0, height: 0, totalFrames: null, droppedFrames: null, fps: null });
      return;
    }

    const intervalId = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const qualityApiVideo = video as HTMLVideoElement & {
        getVideoPlaybackQuality?: () => { totalVideoFrames?: number; droppedVideoFrames?: number };
        webkitDecodedFrameCount?: number;
        webkitDroppedFrameCount?: number;
      };

      let totalFrames: number | null = null;
      let droppedFrames: number | null = null;
      let fps: number | null = null;

      if (typeof qualityApiVideo.getVideoPlaybackQuality === "function") {
        const quality = qualityApiVideo.getVideoPlaybackQuality();
        totalFrames = quality.totalVideoFrames ?? null;
        droppedFrames = quality.droppedVideoFrames ?? null;
      } else if (typeof qualityApiVideo.webkitDecodedFrameCount === "number") {
        totalFrames = qualityApiVideo.webkitDecodedFrameCount;
        droppedFrames = qualityApiVideo.webkitDroppedFrameCount ?? 0;
      }

      if (totalFrames !== null) {
        const now = performance.now();
        const previousSample = previousFrameSampleRef.current;
        if (previousSample) {
          const deltaFrames = totalFrames - previousSample.totalFrames;
          const deltaSeconds = (now - previousSample.timestamp) / 1000;
          if (deltaSeconds > 0 && deltaFrames >= 0) {
            fps = deltaFrames / deltaSeconds;
          }
        }
        previousFrameSampleRef.current = { timestamp: now, totalFrames };
      }

      setVideoStats({ width: video.videoWidth, height: video.videoHeight, totalFrames, droppedFrames, fps });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [scopeStream]);

  // Notify parent of connection changes
  useEffect(() => {
    onConnectionChange?.(!!scopeStream);
  }, [scopeStream, onConnectionChange]);

  const videoInputSource = useMemo<ScopeInputSourceConfig | undefined>(() => {
    if (ndiEnabled) {
      return {
        enabled: true,
        source_type: "ndi",
        source_name: ndiStreamName.trim(),
      };
    }
    if (spoutEnabled) {
      return {
        enabled: true,
        source_type: "spout",
        source_name: spoutStreamName.trim(),
      };
    }
    return undefined;
  }, [ndiEnabled, ndiStreamName, spoutEnabled, spoutStreamName]);

  const shouldApplyPreprocessor = useMemo(
    () => selectedPreprocessor !== NO_PREPROCESSOR && !!videoInputSource,
    [selectedPreprocessor, videoInputSource]
  );

  const loadParams = useMemo(() => {
    const params: Record<string, unknown> = {
      width: aspectRatio.resolution.width,
      height: aspectRatio.resolution.height,
    };
    if (selectedPipeline === "longlive") {
      // RTX 5090 Optimization for Longlive (32GB VRAM, High Compute)
      params.vace_enabled = false; // Disable VACE to maximize performance
      params.vae_type = "lightvae"; // Best balance of speed and visual fidelity
      params.quantization = null; // Uncompressed weights for highest quality (fits comfortably in 32GB)
      params.lora_merge_mode = "permanent_merge"; // Maximize inference FPS
    }

    // External video input mode requires VACE for LongLive processing.
    if (videoInputSource) {
      if (selectedPipeline === "longlive") {
        params.vace_enabled = true;
      }
    }
    return params;
  }, [aspectRatio, selectedPipeline, videoInputSource]);

  const pipelineIdsForConnect = useMemo(() => {
    if (shouldApplyPreprocessor) {
      return [selectedPreprocessor, selectedPipeline];
    }
    return [selectedPipeline];
  }, [selectedPreprocessor, selectedPipeline, shouldApplyPreprocessor]);

  const initialParameters = useMemo(() => {
    if (!currentTheme) return undefined;
    const basePrompt = [
      currentTheme.basePrompt,
      ...currentTheme.styleModifiers,
      "calm atmosphere, gentle flow",
    ].join(", ");
    const composedPrompts = composePromptEntries(basePrompt);
    const promptInterpolationMethod = composedPrompts.length === 2 ? "slerp" : "linear";
    const params = {
      pipeline_ids: pipelineIdsForConnect,
      input_mode: videoInputSource ? "video" : "text",
      prompts: composedPrompts,
      prompt_interpolation_method: promptInterpolationMethod,
      denoising_step_list: [...activeDenoisingSteps],
      manage_cache: true,
      kv_cache_attention_bias: 0.1, // Reduced from 0.3 to prevent strong initial prompts from bleeding/sticking too long
      recording: false,
      ...(videoInputSource
        ? {
          input_source: videoInputSource,
          vace_use_input_video: true,
        }
        : {}),
    };
    console.log("[Scope] initialParameters:", JSON.stringify(params, null, 2));
    return params;
  }, [activeDenoisingSteps, composePromptEntries, currentTheme, pipelineIdsForConnect, videoInputSource]);

  const legacyInitialParameters = useMemo(() => {
    if (!currentTheme) return undefined;
    const basePrompt = [
      currentTheme.basePrompt,
      ...currentTheme.styleModifiers,
      "calm atmosphere, gentle flow",
    ].join(", ");
    const params = {
      pipeline_ids: pipelineIdsForConnect,
      input_mode: videoInputSource ? "video" : "text",
      prompts: composePromptEntries(basePrompt),
      manage_cache: true,
      ...(videoInputSource
        ? {
          input_source: videoInputSource,
          vace_use_input_video: true,
        }
        : {}),
    };
    console.log("[Scope] legacyInitialParameters:", JSON.stringify(params, null, 2));
    return params;
  }, [composePromptEntries, currentTheme, pipelineIdsForConnect, videoInputSource]);

  const stopPlaybackForDisconnect = useCallback(() => {
    stop();
    stopAmbient();
    setIsPlaying(false);
    const audioElement = audioElementRef.current;
    if (audioElement) {
      audioElement.pause();
    }
  }, [stop, stopAmbient]);

  const handleScopeDisconnect = useCallback(() => {
    stopPlaybackForDisconnect();
    setScopeStream(null);
    setDataChannel(null);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, [setDataChannel, stopPlaybackForDisconnect]);

  const handleScopeInterrupted = useCallback(() => {
    setScopeStream(null);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const {
    connectionState,
    statusMessage,
    error,
    peerConnection,
    connect,
    disconnect,
    clearError,
  } = useScopeConnection({
    scopeClient,
    pipelineIds: pipelineIdsForConnect,
    pipelineId: selectedPipeline,
    loadParams,
    initialParameters,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectBaseDelay: RECONNECT_BASE_DELAY_MS,
    setupPeerConnection: (connection) => {
      scopePcRef.current = connection;
      // Scope uses aiortc which requires VP8 codec — VP9/AV1/H264 cause "connected but black" video.
      // Direction must be sendrecv — recvonly prevents aiortc from starting its frame output loop.
      const transceiver = connection.addTransceiver("video", { direction: "sendrecv" });
      const codecs = RTCRtpReceiver.getCapabilities("video")?.codecs ?? [];
      const vp8Codecs = codecs.filter(c => c.mimeType.toLowerCase() === "video/vp8");
      if (vp8Codecs.length > 0) {
        transceiver.setCodecPreferences(vp8Codecs);
      } else {
        console.warn("[Scope] VP8 not in receiver capabilities — codec negotiation left to browser, video may be black");
      }
    },
    onStream: (stream) => {
      console.log("[Scope] Stream received, video tracks:", stream.getVideoTracks().length);
      setScopeStream(stream);
    },
    onDataChannelOpen: (channel) => {
      scopeDataChannelRef.current = channel;
      setDataChannel(channel);
      if (!isPlaying) {
        startAmbient();
      }
    },
    onDataChannelClose: () => {
      scopeDataChannelRef.current = null;
      setDataChannel(null);
      stopAmbient();
    },
    onConnectionInterrupted: handleScopeInterrupted,
    onDisconnect: handleScopeDisconnect,
    reconnectOnDataChannelClose: true,
    reconnectOnStreamStopped: true,
  });

  const isConnecting = connectionState === "connecting" || connectionState === "reconnecting";
  const hasPipelineSelection = selectedPipeline.trim().length > 0;
  const isNdiValid = !ndiEnabled || ndiStreamName.trim().length > 0;
  const isSpoutValid = !spoutEnabled || spoutStreamName.trim().length > 0;
  const isNdiAvailable = !ndiEnabled || scopeCapabilities.ndiAvailable;
  const isSpoutAvailable = !spoutEnabled || scopeCapabilities.spoutAvailable;

  const canConnect =
    !isConnecting &&
    hasPipelineSelection &&
    isNdiValid &&
    isSpoutValid &&
    isNdiAvailable &&
    isSpoutAvailable;
  const showConnectedControls = connectionState === "connected" && showControls;

  useEffect(() => {
    if (!showConnectedControls) {
      setShowAudioMenu(false);
      setShowSettingsMenu(false);
    }
  }, [showConnectedControls]);

  useEffect(() => {
    if (!showConnectedControls) return;

    const handleMenuEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!showAudioMenu && !showSettingsMenu) return;
      event.preventDefault();
      setShowAudioMenu(false);
      setShowSettingsMenu(false);
    };

    window.addEventListener("keydown", handleMenuEscape);
    return () => window.removeEventListener("keydown", handleMenuEscape);
  }, [showConnectedControls, showAudioMenu, showSettingsMenu]);

  useEffect(() => {
    if (connectionState !== "connected" || !scopeStream) return;
    if (!shouldAutoPlayDemoOnNextConnectRef.current) return;

    const controls = transportControlsRef.current;
    if (!controls) return;

    shouldAutoPlayDemoOnNextConnectRef.current = false;
    if (controls.isPlaying()) return;

    void controls.togglePlayPause().catch((error) => {
      console.warn("[Soundscape] Demo autoplay failed:", error);
    });
  }, [connectionState, scopeStream, transportControlsVersion]);

  const scopeReadiness = useMemo(() => {
    if (!hasResolvedInitialScopeHealth) {
      return null;
    }
    if (scopeHealth?.status === "ok") {
      return { label: "Online", textClass: "text-scope-cyan", dotClass: "bg-scope-cyan" };
    }
    return { label: "Offline", textClass: "text-red-300", dotClass: "bg-red-400" };
  }, [scopeHealth, hasResolvedInitialScopeHealth]);

  const connectionSummary = useMemo(() => {
    switch (connectionState) {
      case "connected":
        return { label: "Live", textClass: "text-scope-cyan", dotClass: "bg-scope-cyan" };
      case "connecting":
        return { label: "Connecting", textClass: "text-white/70", dotClass: "bg-white/50" };
      case "reconnecting":
        return { label: "Reconnecting", textClass: "text-white/70", dotClass: "bg-white/50" };
      case "failed":
        return { label: "Failed", textClass: "text-red-300", dotClass: "bg-red-400" };
      default:
        return { label: "Standby", textClass: "text-white/70", dotClass: "bg-white/50" };
    }
  }, [connectionState]);
  const scopeErrorTitle = error?.userFriendly?.title ?? null;
  const scopeErrorDescription = error?.userFriendly?.description ?? null;
  const scopeErrorSuggestion = error?.userFriendly?.suggestion ?? null;
  const soundscapeSyncError = soundscapeState.error ?? null;

  useEffect(() => {
    if (!error) return;
    if (error.code === "HEALTH_CHECK_FAILED" || error.code === "PIPELINE_LOAD_FAILED") {
      void refreshScopeDiagnostics();
    }
  }, [error, refreshScopeDiagnostics]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && peerConnection) {
      (window as unknown as { debugPeerConnection: RTCPeerConnection }).debugPeerConnection = peerConnection;
    }
  }, [peerConnection]);

  useEffect(() => {
    if (!scopeStream || connectionState !== "connected") {
      return;
    }

    // Give the pipeline generous warmup time before attempting recovery.
    // A freshly-loaded pipeline needs time to generate the first frame —
    // triggering reset_cache or legacy reconnect too early causes the server's
    // input loop to error when the PC is closed underneath it.
    const timeoutId = setTimeout(() => {
      const video = videoRef.current;
      if (!video || attemptedNoFrameRecoveryRef.current) {
        return;
      }

      const hasDecodedFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      const hasDimensions = video.videoWidth > 0 && video.videoHeight > 0;

      if (hasDecodedFrame && hasDimensions) {
        return;
      }

      attemptedNoFrameRecoveryRef.current = true;
      codecStrategyRef.current = "browser-default";
      connectionProfileRef.current = "legacy-minimal";
      console.warn("[Scope] Connected without decoded frames after 20s. Retrying once with legacy-minimal profile.");
      void connect({
        pipelineId: selectedPipeline,
        pipelineIds: pipelineIdsForConnect,
        loadParams,
        initialParameters: legacyInitialParameters,
      });
    }, 20000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    scopeStream,
    connectionState,
    connect,
    selectedPipeline,
    pipelineIdsForConnect,
    loadParams,
    legacyInitialParameters,
  ]);

  const handleDisconnectScope = useCallback((userInitiated = false) => {
    disconnect(true);
    setHasLaunched(false);
    shouldAutoPlayDemoOnNextConnectRef.current = false;
    if (userInitiated) {
      clearError();
    }
    console.log("[Soundscape] Disconnected from Scope", userInitiated ? "(user)" : "(connection lost)");
  }, [clearError, disconnect]);

  useEffect(() => {
    if (onRegisterDisconnect) {
      onRegisterDisconnect(() => handleDisconnectScope(true));
    }
  }, [onRegisterDisconnect, handleDisconnectScope]);

  const handleConnectScope = useCallback(async () => {
    clearError();
    setHasLaunched(true);
    shouldAutoPlayDemoOnNextConnectRef.current = autoPlayDemoOnLaunch;
    const diagnostics = await refreshScopeDiagnostics();

    const pipelineIds =
      diagnostics.resolvedPreprocessor !== NO_PREPROCESSOR
        ? [diagnostics.resolvedPreprocessor, diagnostics.resolvedPipeline]
        : [diagnostics.resolvedPipeline];

    await connect({
      pipelineId: diagnostics.resolvedPipeline || selectedPipeline,
      pipelineIds: diagnostics.isHealthy ? pipelineIds : [selectedPipeline],
    });
  }, [autoPlayDemoOnLaunch, clearError, refreshScopeDiagnostics, connect, selectedPipeline]);

  const handleResumeVideoPlayback = useCallback(async () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    try {
      await videoElement.play();
      setVideoAutoplayBlocked(false);
    } catch (error) {
      console.warn("[Soundscape] Video playback retry failed:", error);
    }
  }, []);

  const dropPercentage =
    videoStats.totalFrames && videoStats.totalFrames > 0 && videoStats.droppedFrames !== null
      ? (videoStats.droppedFrames / videoStats.totalFrames) * 100
      : null;

  const performanceStatus = useMemo(() => {
    if (dropPercentage === null && videoStats.fps === null) {
      return { label: "Sampling", color: "text-white/70", dotColor: "bg-white/50" };
    }
    if (
      (dropPercentage !== null && dropPercentage >= CRITICAL_DROPPED_FRAME_PERCENT) ||
      (videoStats.fps !== null && videoStats.fps < WARNING_FPS_THRESHOLD * 0.7)
    ) {
      return { label: "Critical", color: "text-red-300", dotColor: "bg-red-400" };
    }
    if (
      (dropPercentage !== null && dropPercentage >= WARNING_DROPPED_FRAME_PERCENT) ||
      (videoStats.fps !== null && videoStats.fps < WARNING_FPS_THRESHOLD)
    ) {
      return { label: "Warning", color: "text-amber-300", dotColor: "bg-amber-400" };
    }
    return { label: "Healthy", color: "text-scope-cyan", dotColor: "bg-scope-cyan" };
  }, [dropPercentage, videoStats.fps]);

  const startRecordingClip = useCallback(() => {
    if (!scopeStream || typeof MediaRecorder === "undefined") {
      setRecordingError("Recording is not available for this browser/session.");
      return;
    }

    const supportedMimeTypes = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const selectedMimeType = supportedMimeTypes.find((mt) => MediaRecorder.isTypeSupported(mt)) ?? "";

    try {
      if (recordedClipUrl) URL.revokeObjectURL(recordedClipUrl);

      recordingChunksRef.current = [];
      setRecordingError(null);
      setRecordedClipUrl(null);
      setRecordedClipMimeType(null);
      setRecordedClipSeconds(null);

      const recorder = selectedMimeType
        ? new MediaRecorder(scopeStream, { mimeType: selectedMimeType })
        : new MediaRecorder(scopeStream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecordingError("Recording failed. Try reconnecting and starting again.");
      };
      recorder.onstop = () => {
        const chunks = recordingChunksRef.current;
        if (chunks.length === 0) return;
        const mimeType = recorder.mimeType || "video/webm";
        const clipBlob = new Blob(chunks, { type: mimeType });
        setRecordedClipUrl(URL.createObjectURL(clipBlob));
        setRecordedClipMimeType(mimeType);
        if (recordingStartRef.current) {
          setRecordedClipSeconds((Date.now() - recordingStartRef.current) / 1000);
        }
      };

      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      recorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : "Failed to start recording.");
      setIsRecording(false);
    }
  }, [recordedClipUrl, scopeStream]);

  const stopRecordingClip = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state !== "inactive") recorder.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (scopeStream) return;
    stopRecordingClip();
  }, [scopeStream, stopRecordingClip]);

  useEffect(() => {
    return () => {
      stopRecordingClip();
      if (recordedClipUrl) URL.revokeObjectURL(recordedClipUrl);
    };
  }, [recordedClipUrl, stopRecordingClip]);

  // Prevent accidental tab close during recording
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isRecording) {
        event.preventDefault();
        event.returnValue = "Recording in progress. Are you sure you want to leave?";
        return event.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRecording]);

  useEffect(() => {
    if (!hotkeysEnabled) {
      return;
    }

    const handleGlobalHotkeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" || target.isContentEditable);
      const isInteractiveControl =
        !!target &&
        (target.tagName === "BUTTON" ||
          target.tagName === "A" ||
          target.closest('[role="dialog"]') !== null);

      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (isTextInput || isInteractiveControl || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === " ") {
        event.preventDefault();
        void transportControlsRef.current?.togglePlayPause();
        return;
      }

      // Fullscreen toggle with 'f' key
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen();
        } else {
          void document.exitFullscreen();
        }
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        const theme = presetThemes[Number(event.key) - 1];
        if (theme) setTheme(theme.id);
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        if (presetThemes.length === 0) return;

        const currentIndex = presetThemes.findIndex((theme) => theme.id === currentTheme?.id);
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex =
          currentIndex >= 0
            ? (currentIndex + direction + presetThemes.length) % presetThemes.length
            : direction > 0
              ? 0
              : presetThemes.length - 1;

        const nextTheme = presetThemes[nextIndex];
        if (nextTheme) {
          setTheme(nextTheme.id);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalHotkeys);
    return () => window.removeEventListener("keydown", handleGlobalHotkeys);
  }, [currentTheme?.id, hotkeysEnabled, presetThemes, setTheme]);

  useEffect(() => {
    if (!autoThemeEnabled || !isPlaying || !scopeStream || !soundscapeState.analysis) {
      processedBeatTimestampRef.current = 0;
      autoThemeBeatCounterRef.current = 0;
      return;
    }

    const beat = soundscapeState.analysis.beat;
    if (!beat.lastBeatTime) return;
    if (beat.lastBeatTime === processedBeatTimestampRef.current) return;

    const previousBeatTimestamp = processedBeatTimestampRef.current;
    processedBeatTimestampRef.current = beat.lastBeatTime;

    let beatIncrement = 1;
    const hasReliableTempo =
      typeof beat.bpm === "number" &&
      Number.isFinite(beat.bpm) &&
      beat.confidence >= AUTO_THEME_BPM_CONFIDENCE_THRESHOLD &&
      beat.bpm >= AUTO_THEME_BEAT_ESTIMATE_MIN_BPM &&
      beat.bpm <= AUTO_THEME_BEAT_ESTIMATE_MAX_BPM;
    const bpmForEstimate = hasReliableTempo ? beat.bpm : null;

    if (bpmForEstimate !== null && previousBeatTimestamp > 0) {
      const beatIntervalMs = 60000 / bpmForEstimate;
      const elapsedMs = beat.lastBeatTime - previousBeatTimestamp;
      beatIncrement = Math.max(
        1,
        Math.min(
          AUTO_THEME_MAX_ESTIMATED_BEAT_INCREMENT,
          Math.round(elapsedMs / beatIntervalMs)
        )
      );
    }

    autoThemeBeatCounterRef.current += beatIncrement;

    if (autoThemeBeatCounterRef.current % autoThemeSectionBeats !== 0) return;

    const currentIndex = presetThemes.findIndex((t) => t.id === currentTheme?.id);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % presetThemes.length : 0;
    const nextTheme = presetThemes[nextIndex];
    if (nextTheme) setTheme(nextTheme.id);
  }, [autoThemeEnabled, autoThemeSectionBeats, currentTheme?.id, isPlaying, presetThemes, scopeStream, setTheme, soundscapeState.analysis]);

  // ====================================================================
  // RENDER
  // ====================================================================

  if (!mounted) {
    return null;
  }

  return (
    <div className="h-full w-full flex flex-col relative z-0 bg-black overflow-hidden font-sans">
      {/* ALWAYS-PRESENT VIDEO LAYER (solves WebRTC mounting issues on Safari/iOS) */}
      <div
        className={`absolute inset-0 z-0 flex items-center justify-center transition-opacity duration-1000 ${connectionState === "connected" ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
      >
        <div className={`absolute inset-0 p-4 md:p-8 flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${showControls && connectionState === "connected" ? 'pb-[180px] md:pb-[140px]' : ''}`}>
          {/* Magical fantastical frame - sized to video aspect ratio */}
          <div
            className="relative rounded-[1.75rem] shadow-[0_0_80px_rgba(6,182,212,0.15)] transition-all duration-700"
            style={{
              aspectRatio: `${aspectRatio.resolution.width} / ${aspectRatio.resolution.height}`,
              maxWidth: '100%',
              maxHeight: '100%',
              width: aspectRatio.mode === '16:9' ? '100%' : 'auto',
              height: aspectRatio.mode === '9:16' ? '100%' : 'auto',
            }}
          >
            {/* Outer glow layers */}
            <div className={`absolute -inset-4 rounded-[2.5rem] bg-gradient-to-r from-scope-purple/40 via-scope-cyan/30 to-scope-magenta/40 blur-2xl opacity-70 ${isPlaying ? 'animate-pulse' : ''}`} />
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-scope-cyan/50 via-transparent to-scope-purple/50 blur-lg" />

            {/* Frame border with gradient */}
            <div className="absolute inset-0 rounded-[1.75rem] p-[2px] bg-gradient-to-br from-scope-cyan/80 via-scope-purple/60 to-scope-magenta/80">
              <div className="w-full h-full rounded-[calc(1.75rem-2px)] bg-black/90" />
            </div>

            {/* Video container */}
            <div className="absolute inset-[3px] rounded-[calc(1.75rem-3px)] overflow-hidden bg-black ring-1 ring-white/10">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={sharpenEnabled ? {
                  imageRendering: "crisp-edges",
                } : undefined}
              />
            </div>

            {videoAutoplayBlocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[calc(1.75rem-3px)] z-30">
                <button type="button" onClick={() => { void handleResumeVideoPlayback(); }} className="px-8 py-4 rounded-full glass-radiant bg-scope-cyan/20 border border-scope-cyan/50 text-sm uppercase tracking-widest text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:bg-scope-cyan/30 hover:scale-105 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan font-bold">
                  Tap to Start Stream
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TELEMETRY OVERLAY HAS BEEN MOVED TO SETTINGS MENU */}



      {/* FOREGROUND UI STATES */}
      <div className={`absolute inset-0 z-20 transition-all duration-700 ${connectionState === "connected" ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>

        {/* Background Ambience when disconnected */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.1),rgba(0,0,0,0.8)_60%)] pointer-events-none" />

        {isConnecting || connectionState === "connected" ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="glass-radiant p-10 rounded-3xl max-w-sm w-full text-center border border-scope-cyan/20 shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-fade-in relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-scope-cyan/10 to-transparent opacity-50 pointer-events-none" />
              <div className="mb-8 flex justify-center relative">
                <div className="absolute inset-0 rounded-full bg-scope-cyan/20 blur-xl animate-pulse" />
                <svg width="60" height="60" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)] animate-pulse">
                  <path d="M28 22V52" stroke="url(#initGrad)" strokeWidth="4" strokeLinecap="round" />
                  <path d="M52 18V48" stroke="url(#initGrad)" strokeWidth="4" strokeLinecap="round" />
                  <path d="M28 22L52 18" stroke="url(#initGrad)" strokeWidth="4" strokeLinecap="round" />
                  <ellipse cx="22" cy="54" rx="8" ry="6" fill="url(#initGrad)" transform="rotate(-20 22 54)" />
                  <ellipse cx="46" cy="50" rx="8" ry="6" fill="url(#initGrad)" transform="rotate(-20 46 50)" />
                  <defs><linearGradient id="initGrad" x1="16" y1="14" x2="56" y2="58" gradientUnits="userSpaceOnUse"><stop stopColor="#06b6d4" /><stop offset="0.5" stopColor="#8b5cf6" /><stop offset="1" stopColor="#ec4899" /></linearGradient></defs>
                </svg>
              </div>
              <div role="status" aria-live="polite" aria-atomic="true">
                <h2 className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-scope-cyan to-scope-purple mb-3 tracking-widest font-bold" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}>
                  {connectionState === "reconnecting" ? "RECONNECTING" : connectionState === "connected" ? "CONNECTED" : "INITIALIZING"}
                </h2>
                <p className="text-white/70 text-sm font-medium mb-6 uppercase tracking-wider">
                  {connectionState === "connected" ? "Link established. Synchronizing scene..." : statusMessage || "Establishing secure stream..."}
                </p>
              </div>
              <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                <div className={`h-full bg-gradient-to-r from-scope-cyan via-scope-purple to-scope-magenta rounded-full transition-all duration-700 ease-out ${connectionState === "connected" ? "w-full" : "w-[80%] animate-pulse"}`} />
              </div>
            </div>
          </div>
        ) : hasLaunched && (connectionState === "failed" || scopeHealth?.status !== "ok") ? (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none">
            <div className="glass-radiant p-8 rounded-3xl max-w-[26rem] w-full text-center border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] animate-fade-in relative pointer-events-auto backdrop-blur-md bg-black/40">
              <h2 className="text-xl text-red-400 mb-3 tracking-widest font-bold drop-shadow-md" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}>
                CONNECTION FAILED
              </h2>
              <p className="text-white/70 text-sm font-medium mb-6 leading-relaxed">
                {scopeErrorDescription || "Unable to establish a link with the Soundscape Generation Engine. The server might be offline."}
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={() => { void handleConnectScope(); }} className="w-full py-3 rounded-xl text-sm uppercase tracking-widest font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-500/20 text-red-100 hover:bg-red-500/30 border border-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                  Retry Connection
                </button>
                <button onClick={() => setHasLaunched(false)} className="w-full py-3 text-xs text-white/50 hover:text-white/90 uppercase tracking-widest transition-colors font-semibold">
                  Back to Configuration
                </button>
              </div>
            </div>
          </div>
        ) : !hasLaunched ? (
          <div className="absolute inset-0 flex flex-col md:flex-row p-4 md:p-8 gap-6 lg:gap-12 justify-center items-center pointer-events-auto overflow-y-auto md:overflow-hidden w-full max-w-7xl mx-auto">

            {/* Left Column: Intro & Branding */}
            <div className="flex-1 w-full max-w-lg lg:pr-12 flex flex-col justify-center overflow-visible">
              <h1 className="text-5xl md:text-7xl text-transparent bg-clip-text bg-gradient-to-r from-scope-cyan to-scope-purple mb-6 font-bold tracking-normal drop-shadow-[0_0_30px_rgba(6,182,212,0.3)] flex flex-col overflow-visible min-w-max" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif', lineHeight: '1.2' }}>
                <span className="pb-1" style={{ paddingRight: '0.1em' }}>MetaDJ</span>
                <span className="pb-2" style={{ paddingRight: '0.1em' }}>Soundscape</span>
              </h1>
              <p className="text-lg text-white/60 mb-10 leading-relaxed font-light">
                Where music meets imagination. A real-time engine that sculpts dynamic visual experiences directly from the energy of your music.
              </p>

              <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-h-[20px]">
                  {scopeReadiness && (
                    <>
                      <div className={`w-3 h-3 rounded-full ${scopeReadiness.dotClass} shadow-[0_0_10px_currentColor]`} />
                      <span className={`text-sm font-bold uppercase tracking-wider ${scopeReadiness.textClass}`}>{scopeReadiness.label}</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isDiagnosticsLoading) return;
                    void refreshScopeDiagnostics();
                  }}
                  className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold rounded-lg bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all border border-white/10 hover:border-scope-cyan/30 focus:outline-none focus:ring-2 focus:ring-scope-cyan"
                >
                  Refresh
                </button>
              </div>

              {diagnosticsError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-[0_0_15px_rgba(245,158,11,0.08)]"
                >
                  <p className="text-amber-300 font-bold text-xs uppercase tracking-wider mb-1">
                    Scope Diagnostics Warning
                  </p>
                  <p className="text-amber-100/85 text-[11px] leading-relaxed">{diagnosticsError}</p>
                </div>
              )}
            </div>

            {/* Right Column: Configuration Panel */}
            <div className="w-full max-w-xl lg:max-w-2xl shrink-0 flex flex-col glass-radiant rounded-3xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-visible">
              <div className="p-5 md:p-6 overflow-y-auto max-h-[82vh] md:max-h-[72vh] fancy-scrollbar">
                <div className="space-y-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 items-start">

                  {/* Pipeline Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold tracking-[0.2em] text-scope-cyan/70 uppercase border-b border-white/5 pb-2 flex items-center gap-2">
                      Pipeline Config
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold ml-1">Main Pipeline</label>
                        <div className="relative">
                          <select
                            value={selectedPipeline}
                            onChange={(e) => setSelectedPipeline(e.target.value)}
                            className="w-full appearance-none bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-scope-cyan/50 focus:ring-1 focus:ring-scope-cyan/50 transition-all cursor-pointer font-medium"
                          >
                            {mainPipelineOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold ml-1">View Format</label>
                        <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
                          <AspectRatioToggle
                            current={aspectRatio}
                            onChange={setAspectRatio}
                            disabled={isConnecting}
                          />
                        </div>
                      </div>

                      {/* Input Streams Configuration (Moved to balance layout) */}
                      <div className="md:col-span-2 pt-2">
                        <div className="flex items-center gap-4 text-xs text-scope-cyan/70 uppercase tracking-widest font-semibold mb-4">
                          <span>Input Streams</span>
                          <div className="h-px flex-1 bg-gradient-to-r from-scope-cyan/20 to-transparent" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {/* NDI Stream */}
                          <div className={`p-3 rounded-xl border transition-all relative ${ndiEnabled ? 'bg-scope-cyan/10 border-scope-cyan/30' : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/20'}`}>
                            {ndiEnabled && scopeCapabilities.ndiAvailable && (
                              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-scope-cyan animate-pulse shadow-[0_0_5px_#06b6d4]" />
                                <span className="text-[8px] font-bold text-scope-cyan tracking-widest uppercase">Active</span>
                              </div>
                            )}
                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                              <input type="checkbox" className="sr-only" checked={ndiEnabled} onChange={(e) => {
                                const c = e.target.checked;
                                setNdiEnabled(c);
                                if (c) setSpoutEnabled(false);
                              }} />
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${ndiEnabled ? 'bg-scope-cyan border-scope-cyan text-black' : 'border-white/30 bg-black/50'} `}>
                                {ndiEnabled && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              </div>
                              <span className={`text-xs font-semibold ${ndiEnabled ? 'text-scope-cyan' : 'text-white/70'}`}>NDI Stream</span>
                            </label>
                            {ndiEnabled && (
                              <input
                                type="text"
                                value={ndiStreamName}
                                onChange={(e) => setNdiStreamName(e.target.value)}
                                placeholder="Enter NDI Source Name"
                                className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:border-scope-cyan/50 focus:ring-1 focus:ring-scope-cyan/50 outline-none transition-all placeholder:text-white/30 mt-1"
                              />
                            )}
                          </div>

                          {/* Spout Stream */}
                          <div className={`p-3 rounded-xl border transition-all relative ${spoutEnabled ? 'bg-scope-cyan/10 border-scope-cyan/30' : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/20'}`}>
                            {spoutEnabled && scopeCapabilities.spoutAvailable && (
                              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-scope-cyan animate-pulse shadow-[0_0_5px_#06b6d4]" />
                                <span className="text-[8px] font-bold text-scope-cyan tracking-widest uppercase">Active</span>
                              </div>
                            )}
                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                              <input type="checkbox" className="sr-only" checked={spoutEnabled} onChange={(e) => {
                                const c = e.target.checked;
                                setSpoutEnabled(c);
                                if (c) setNdiEnabled(false);
                              }} />
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${spoutEnabled ? 'bg-scope-cyan border-scope-cyan text-black' : 'border-white/30 bg-black/50'} `}>
                                {spoutEnabled && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              </div>
                              <span className={`text-xs font-semibold ${spoutEnabled ? 'text-scope-cyan' : 'text-white/70'}`}>Spout Stream</span>
                            </label>
                            {spoutEnabled && (
                              <input
                                type="text"
                                value={spoutStreamName}
                                onChange={(e) => setSpoutStreamName(e.target.value)}
                                placeholder="Enter Spout Source Name"
                                className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:border-scope-cyan/50 focus:ring-1 focus:ring-scope-cyan/50 outline-none transition-all placeholder:text-white/30 mt-1"
                              />
                            )}
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold ml-1">
                            Video Preprocessor
                          </label>
                          <div className="relative">
                            <select
                              value={selectedPreprocessor}
                              onChange={(e) => setSelectedPreprocessor(e.target.value)}
                              disabled={preprocessorOptions.length === 0 || !videoInputSource}
                              className={`w-full appearance-none bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-scope-cyan/50 focus:ring-1 focus:ring-scope-cyan/50 transition-all cursor-pointer disabled:opacity-50 font-medium ${(preprocessorOptions.length === 0 || !videoInputSource) ? "text-white/30 cursor-not-allowed" : "text-white"}`}
                            >
                              <option value={NO_PREPROCESSOR}>None</option>
                              {preprocessorOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>


                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-xs text-scope-purple/70 uppercase tracking-widest font-semibold">
                      <span>Generation Profile</span>
                      <div className="h-px flex-1 bg-gradient-to-r from-scope-purple/20 to-transparent" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="block relative group">
                        <span className="block text-[10px] font-mono text-white/50 uppercase tracking-[0.2em] font-bold mb-2 group-hover:text-scope-purple/80 transition-colors">Denoising</span>
                        <div className="relative">
                          <select value={denoisingProfileId} onChange={(e) => handleDenoisingProfileChange(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:border-scope-purple/50 focus:ring-1 focus:ring-scope-purple/50 transition-all outline-none appearance-none group-hover:bg-black/60">
                            <option value="speed">Speed</option>
                            <option value="balanced">Balanced</option>
                            <option value="quality">Quality</option>
                          </select>
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-white/30 group-hover:text-scope-purple/60 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </div>
                        </div>
                      </label>
                      <label className="block relative group">
                        <span className="block text-[10px] font-mono text-white/50 uppercase tracking-[0.2em] font-bold mb-2 group-hover:text-scope-purple/80 transition-colors">Reactivity</span>
                        <div className="relative">
                          <select value={reactivityProfileId} onChange={(e) => handleReactivityProfileChange(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:border-scope-purple/50 focus:ring-1 focus:ring-scope-purple/50 transition-all outline-none appearance-none group-hover:bg-black/60">
                            <option value="cinematic">Cinematic</option>
                            <option value="balanced">Balanced</option>
                            <option value="kinetic">Kinetic</option>
                          </select>
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-white/30 group-hover:text-scope-purple/60 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </div>
                        </div>
                      </label>
                      <label className="block relative group">
                        <span className="block text-[10px] font-mono text-white/50 uppercase tracking-[0.2em] font-bold mb-2 group-hover:text-scope-purple/80 transition-colors">Motion Pace</span>
                        <div className="relative">
                          <select value={motionPaceProfileId} onChange={(e) => handleMotionPaceProfileChange(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:border-scope-purple/50 focus:ring-1 focus:ring-scope-purple/50 transition-all outline-none appearance-none group-hover:bg-black/60">
                            {Object.entries(MOTION_PACE_PROFILES).map(([id, profile]) => (
                              <option key={id} value={id}>
                                {profile.label}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-white/30 group-hover:text-scope-purple/60 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </div>
                        </div>
                      </label>
                    </div>

                    <label className="block relative group">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] font-mono text-white/50 uppercase tracking-[0.2em] font-bold group-hover:text-scope-purple/80 transition-colors">Accent Weight</span>
                        <span className="text-[10px] text-scope-purple font-mono bg-scope-purple/10 px-2 py-0.5 rounded border border-scope-purple/20">{promptAccent.weight.toFixed(2)}</span>
                      </div>
                      <input type="range" min={0.05} max={1} step={0.05} value={promptAccent.weight} onChange={(e) => handlePromptAccentWeightChange(Number(e.target.value))} className="w-full accent-scope-purple cursor-pointer" />
                    </label>

                    <details className="group rounded-xl border border-white/10 bg-black/35 p-3">
                      <summary className="flex items-center justify-between cursor-pointer list-none">
                        <span className="text-[10px] font-mono text-scope-purple/80 uppercase tracking-[0.2em] font-bold">
                          Advanced Runtime Controls
                        </span>
                        <span className="text-[10px] text-white/50 group-open:hidden">Expand</span>
                        <span className="text-[10px] text-white/50 hidden group-open:inline">Collapse</span>
                      </summary>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="block">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-bold">Beat Boost</span>
                            <span className="text-[10px] text-scope-cyan font-mono">{runtimeTuning.beatBoostScale.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={RUNTIME_TUNING_BOUNDS.beatBoostScale.min}
                            max={RUNTIME_TUNING_BOUNDS.beatBoostScale.max}
                            step={0.05}
                            value={runtimeTuning.beatBoostScale}
                            onChange={(e) => handleRuntimeTuningChange("beatBoostScale", Number(e.target.value))}
                            className="w-full accent-scope-cyan cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-bold">Spike Boost</span>
                            <span className="text-[10px] text-scope-cyan font-mono">{runtimeTuning.spikeBoostScale.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={RUNTIME_TUNING_BOUNDS.spikeBoostScale.min}
                            max={RUNTIME_TUNING_BOUNDS.spikeBoostScale.max}
                            step={0.05}
                            value={runtimeTuning.spikeBoostScale}
                            onChange={(e) => handleRuntimeTuningChange("spikeBoostScale", Number(e.target.value))}
                            className="w-full accent-scope-cyan cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-bold">Variation Blend</span>
                            <span className="text-[10px] text-scope-cyan font-mono">{runtimeTuning.spikeVariationWeightScale.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={RUNTIME_TUNING_BOUNDS.spikeVariationWeightScale.min}
                            max={RUNTIME_TUNING_BOUNDS.spikeVariationWeightScale.max}
                            step={0.05}
                            value={runtimeTuning.spikeVariationWeightScale}
                            onChange={(e) =>
                              handleRuntimeTuningChange(
                                "spikeVariationWeightScale",
                                Number(e.target.value)
                              )
                            }
                            className="w-full accent-scope-cyan cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-bold">Motion Bias</span>
                            <span className="text-[10px] text-scope-cyan font-mono">{runtimeTuning.tempoThresholdScale.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={RUNTIME_TUNING_BOUNDS.tempoThresholdScale.min}
                            max={RUNTIME_TUNING_BOUNDS.tempoThresholdScale.max}
                            step={0.01}
                            value={runtimeTuning.tempoThresholdScale}
                            onChange={(e) => handleRuntimeTuningChange("tempoThresholdScale", Number(e.target.value))}
                            className="w-full accent-scope-cyan cursor-pointer"
                          />
                        </label>

                        <label className="block md:col-span-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-bold">Noise Ceiling</span>
                            <span className="text-[10px] text-scope-cyan font-mono">{runtimeTuning.noiseCeiling.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={RUNTIME_TUNING_BOUNDS.noiseCeiling.min}
                            max={RUNTIME_TUNING_BOUNDS.noiseCeiling.max}
                            step={0.01}
                            value={runtimeTuning.noiseCeiling}
                            onChange={(e) => handleRuntimeTuningChange("noiseCeiling", Number(e.target.value))}
                            className="w-full accent-scope-cyan cursor-pointer"
                          />
                        </label>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-[10px] text-white/45 uppercase tracking-[0.12em]">
                          Live updates, no reconnect required.
                        </p>
                        <button
                          type="button"
                          onClick={handleRuntimeTuningReset}
                          className="px-3 py-1.5 rounded-lg border border-white/15 bg-black/30 text-[10px] uppercase tracking-[0.12em] font-bold text-white/75 hover:text-white hover:border-scope-cyan/40 transition-all"
                        >
                          Reset
                        </button>
                      </div>
                    </details>

                  </div>

                  {soundscapeSyncError && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="md:col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 animate-fade-in shadow-[0_0_15px_rgba(245,158,11,0.08)]"
                    >
                      <p className="text-amber-300 font-bold text-xs uppercase tracking-wider mb-1">
                        Parameter Sync Warning
                      </p>
                      <p className="text-amber-100/85 text-[11px] leading-relaxed">{soundscapeSyncError}</p>
                    </div>
                  )}

                  {scopeErrorTitle && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="md:col-span-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 relative animate-fade-in shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                    >
                      <button type="button" onClick={clearError} className="absolute top-2 right-2 text-red-400 hover:text-red-300">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <p className="text-red-400 font-bold text-xs uppercase tracking-wider mb-1">{scopeErrorTitle}</p>
                      {scopeErrorDescription && <p className="text-red-200/80 text-[11px] leading-relaxed">{scopeErrorDescription}</p>}
                      {scopeErrorSuggestion && <p className="text-red-100/75 text-[11px] leading-relaxed mt-2">{scopeErrorSuggestion}</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 md:p-6 bg-black/40 border-t border-white/5">
                <div className="mb-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-scope-cyan/80 font-bold">
                        Autoplay Demo Song
                      </p>
                      <p className="text-[11px] text-white/60 mt-1">
                        Start demo audio automatically after launch.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoPlayDemoOnLaunch}
                      onClick={() => setAutoPlayDemoOnLaunch((previous) => !previous)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan ${autoPlayDemoOnLaunch
                        ? "border-scope-cyan/70 bg-scope-cyan/40"
                        : "border-white/25 bg-white/10"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${autoPlayDemoOnLaunch ? "translate-x-6" : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { void handleConnectScope(); }}
                  disabled={!canConnect}
                  className={`w-full py-4 rounded-2xl text-[13px] uppercase tracking-[0.25em] font-black transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-scope-cyan overflow-hidden relative group ${canConnect
                    ? 'bg-gradient-to-r from-scope-cyan to-scope-purple text-white shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:shadow-[0_0_60px_rgba(139,92,246,0.6)] hover:scale-[1.02]'
                    : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                    }`}
                >
                  {canConnect && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] group-hover:animate-shimmer" />
                      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20 pointer-events-none" />
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors pointer-events-none" />
                    </>
                  )}
                  <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">{isConnecting ? "CONNECTING..." : "LAUNCH SOUNDSCAPE"}</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* FLOATING CONTROLS DOCK - Bottom (Theme Picker) */}
      {showConnectedControls && (
        <div className="absolute bottom-6 left-0 right-0 z-40 w-full px-6 md:px-12 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex justify-center items-center translate-y-0 opacity-100">
          <div className="w-full max-w-[calc(100vw-4rem)] md:max-w-7xl">
            <ThemeSelector themes={presetThemes} currentTheme={currentTheme} onThemeChange={setTheme} compact />
          </div>
        </div>
      )}

      {/* FLOATING ACTION BUTTONS (FABs) */}
      {showConnectedControls && (
        <>
          {/* LEFT: MUSIC AND SETTINGS */}
          <div className="absolute bottom-6 left-6 z-50 flex gap-4">

            {/* Music/Audio Menu & FAB */}
            <div className="flex flex-col justify-end items-start gap-3">
              <div
                id="soundscape-audio-menu"
                role="dialog"
                aria-modal="false"
                aria-label="Audio controls"
                aria-hidden={!showAudioMenu}
                className={`transition-all duration-300 origin-bottom-left ease-[cubic-bezier(0.16,1,0.3,1)] absolute bottom-full mb-3 left-0 ${showAudioMenu
                  ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                  }`}
              >
                <div className="glass-radiant w-80 rounded-2xl p-4 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/70">Audio Controls</span>
                  </div>
                  {/* Music Player */}
                  <div className="w-full bg-black/20 rounded-xl p-2 border border-white/5">
                    <AudioPlayer onAudioElement={handleAudioElement} onPlayStateChange={handlePlayStateChange} onRegisterControls={handleRegisterAudioControls} compact />
                  </div>
                  {/* Analysis Meter */}
                  {isPlaying && (
                    <div className="w-full bg-black/20 rounded-xl p-3 border border-white/5">
                      <AnalysisMeter analysis={soundscapeState.analysis} parameters={soundscapeParameters} compact />
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setShowAudioMenu(!showAudioMenu); setShowSettingsMenu(false); }}
                className={`relative z-50 w-[3.25rem] h-[3.25rem] flex items-center justify-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan ${showAudioMenu ? 'bg-scope-purple text-white shadow-[0_0_20px_rgba(139,92,246,0.6)] border-scope-purple/50 scale-105' : 'glass-radiant hover:border-white/20 text-white/80 hover:bg-white/10 hover:text-white hover:scale-105'}`}
                aria-label="Toggle Audio Controls"
                aria-expanded={showAudioMenu}
                aria-controls="soundscape-audio-menu"
                aria-haspopup="dialog"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              </button>
            </div>

          </div>

          {/* RIGHT: SETTINGS & TELEMETRY */}
          <div className="absolute bottom-6 right-6 z-50 flex flex-col justify-end items-end gap-3">
            {showSettingsMenu && (
              <div
                id="soundscape-settings-menu"
                role="dialog"
                aria-modal="false"
                aria-label="Settings and telemetry"
                className="transition-all duration-300 origin-bottom-right ease-[cubic-bezier(0.16,1,0.3,1)] absolute bottom-full mb-3 right-0 opacity-100 scale-100 translate-y-0 pointer-events-auto"
              >
                <div className="glass-radiant w-64 rounded-2xl p-4 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className={`flex items-center gap-2 text-[10px] uppercase font-mono tracking-[0.2em] font-bold ${connectionSummary.textClass}`}>
                      <span className={`w-2 h-2 rounded-full ${connectionSummary.dotClass} ${connectionState === 'connected' ? 'animate-pulse shadow-[0_0_8px_currentColor]' : ''}`} />
                      {connectionSummary.label}
                    </span>
                  </div>

                  {/* Telemetry Display */}
                  <div className="space-y-2 text-[11px] tabular-nums font-medium">
                    <div className="flex justify-between"><span className="text-white/50">Mode</span><span className="text-white/90">{runtimeModeLabel}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">Signal</span><span className="text-white/90 text-right max-w-[9rem] truncate">{runtimeSignalLabel}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">Pipeline</span><span className="text-white/90 truncate ml-2">{activePipelineChain}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">Resolution</span><span className="text-white/90">{videoStats.width > 0 ? `${videoStats.width}x${videoStats.height}` : "..."}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">FPS</span><span className="text-white/90">{videoStats.fps !== null ? videoStats.fps.toFixed(1) : "..."}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">Drop Rate</span><span className="text-white/90">{dropPercentage !== null ? `${dropPercentage.toFixed(1)}%` : "..."}</span></div>
                    <div className="flex justify-between items-center pt-1 mt-1 border-t border-white/5">
                      <span className="text-white/50">Status</span>
                      <span className={`font-bold flex items-center gap-1.5 ${performanceStatus.color}`}>
                        <span className={`w-2 h-2 rounded-full ${performanceStatus.dotColor}`} aria-hidden="true" />
                        {performanceStatus.label}
                      </span>
                    </div>
                  </div>

                  {/* Recording Row */}
                  <div className="flex gap-2">
                    {!isRecording ? (
                      <button type="button" onClick={startRecordingClip} className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 py-2 text-[10px] uppercase tracking-widest font-bold text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Record</button>
                    ) : (
                      <button type="button" onClick={stopRecordingClip} className="flex-1 rounded-lg border border-red-500/50 bg-red-500/30 py-2 text-[10px] uppercase tracking-widest font-bold text-red-100 hover:bg-red-500/40 transition-all animate-pulse focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Stop REC</button>
                    )}
                    {recordedClipUrl && (
                      <a href={recordedClipUrl} download={`clip-${Date.now()}.webm`} className="flex-1 text-center flex items-center justify-center rounded-lg border border-scope-cyan/30 bg-scope-cyan/10 py-2 text-[10px] uppercase tracking-widest font-bold text-scope-cyan hover:bg-scope-cyan/20 hover:border-scope-cyan/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan">Save</a>
                    )}
                  </div>
                  {recordedClipSeconds !== null && (
                    <p className="text-[10px] text-white/60">
                      Last clip length: {recordedClipSeconds.toFixed(1)}s
                    </p>
                  )}
                  {recordingError && (
                    <p role="alert" aria-live="assertive" className="text-[10px] text-red-300">
                      {recordingError}
                    </p>
                  )}

                  <div className="border-t border-white/10 -mb-2" />

                  {/* Disconnect Button */}
                  <button
                    type="button"
                    onClick={handleScopeDisconnect}
                    className="w-full mt-1 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all text-[10px] font-bold font-mono tracking-[0.2em] uppercase border border-red-500/20"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => { setShowSettingsMenu(!showSettingsMenu); setShowAudioMenu(false); }}
              className={`w-[3.25rem] h-[3.25rem] rounded-full flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan ${showSettingsMenu ? 'bg-scope-cyan text-black shadow-[0_0_20px_rgba(6,182,212,0.6)] border-scope-cyan/50 scale-105' : 'glass-radiant hover:border-white/20 text-white/80 hover:bg-white/10 hover:text-white hover:scale-105'}`}
              aria-label="Toggle Settings Menu"
              aria-expanded={showSettingsMenu}
              aria-controls="soundscape-settings-menu"
              aria-haspopup="dialog"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
