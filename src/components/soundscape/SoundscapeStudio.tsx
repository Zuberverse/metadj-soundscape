/**
 * Soundscape Studio Component
 * Video-first layout with collapsible controls
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  useSoundscape,
  DEFAULT_ASPECT_RATIO,
  DENOISING_PROFILES,
  MAX_RECONNECT_ATTEMPTS,
  REACTIVITY_PROFILES,
  RECONNECT_BASE_DELAY_MS,
  type DenoisingProfileId,
  type ReactivityProfileId,
} from "@/lib/soundscape";
import type { AspectRatioConfig } from "@/lib/soundscape";
import { getScopeClient, useScopeConnection } from "@/lib/scope";
import type { HealthResponse, PipelineDescriptor, PipelineStatusResponse } from "@/lib/scope";
import { AudioPlayer, type AudioPlayerControls } from "./AudioPlayer";
import { ThemeSelector } from "./ThemeSelector";
import { AspectRatioToggle } from "./AspectRatioToggle";
import { AnalysisMeter } from "./AnalysisMeter";

// Default pipeline for Soundscape (longlive = stylized, smooth transitions)
const DEFAULT_PIPELINE = "longlive";
const NO_PREPROCESSOR = "__none__";
const PROMPT_ACCENT_PRESETS = [
  "volumetric god rays",
  "cinematic bokeh",
  "prismatic particles",
  "holographic fog",
];
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
}

/**
 * Collapsible section for the pre-connect panel.
 * Reduces cognitive load by hiding advanced settings behind expandable headers.
 */
function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  badge,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-inset"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">{title}</span>
          {badge}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-white/60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
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
  /** Callback to toggle controls visibility */
  onControlsToggle?: () => void;
  /** Callback to register the disconnect handler with the parent */
  onRegisterDisconnect?: (disconnectFn: () => void) => void;
  /** Whether global hotkeys should be active */
  hotkeysEnabled?: boolean;
}

export function SoundscapeStudio({
  onConnectionChange,
  sharpenEnabled: sharpenEnabledProp,
  showControls: showControlsProp,
  onControlsToggle,
  onRegisterDisconnect,
  hotkeysEnabled = true,
}: SoundscapeStudioProps) {
  // Scope connection state
  const [scopeStream, setScopeStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const transportControlsRef = useRef<AudioPlayerControls | null>(null);
  const previousFrameSampleRef = useRef<{ timestamp: number; totalFrames: number } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const processedBeatTimestampRef = useRef<number>(0);
  const autoThemeBeatCounterRef = useRef(0);
  const hideTelemetryButtonRef = useRef<HTMLButtonElement | null>(null);
  const showTelemetryButtonRef = useRef<HTMLButtonElement | null>(null);
  const showControlsButtonRef = useRef<HTMLButtonElement | null>(null);
  const hideControlsButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingToggleFocusRef = useRef<"show-controls" | "hide-controls" | null>(null);
  const scopePcRef = useRef<RTCPeerConnection | null>(null);
  const scopeDataChannelRef = useRef<RTCDataChannel | null>(null);
  const attemptedNoFrameRecoveryRef = useRef(false);
  const codecStrategyRef = useRef<"vp8-preferred" | "browser-default">("vp8-preferred");
  const connectionProfileRef = useRef<"modern" | "legacy-minimal">("modern");

  // UI state - use props if provided (controlled), otherwise internal state (uncontrolled)
  const [showControlsInternal, setShowControlsInternal] = useState(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);

  // Resolve controlled vs uncontrolled state
  const showControls = showControlsProp ?? showControlsInternal;
  const sharpenEnabled = sharpenEnabledProp ?? true;

  const handleToggleControls = useCallback(() => {
    if (onControlsToggle) {
      onControlsToggle();
    } else {
      setShowControlsInternal(prev => !prev);
    }
  }, [onControlsToggle]);

  const handleShowControls = useCallback(() => {
    pendingToggleFocusRef.current = "hide-controls";
    handleToggleControls();
  }, [handleToggleControls]);

  const handleHideControls = useCallback(() => {
    pendingToggleFocusRef.current = "show-controls";
    handleToggleControls();
  }, [handleToggleControls]);

  const handleHideTelemetry = useCallback(() => {
    setShowTelemetry(false);
    requestAnimationFrame(() => {
      showTelemetryButtonRef.current?.focus();
    });
  }, []);

  const handleShowTelemetry = useCallback(() => {
    setShowTelemetry(true);
    requestAnimationFrame(() => {
      hideTelemetryButtonRef.current?.focus();
    });
  }, []);

  const handleRegisterAudioControls = useCallback((controls: AudioPlayerControls | null) => {
    transportControlsRef.current = controls;
  }, []);

  // Aspect ratio state (16:9 widescreen by default)
  const [aspectRatio, setAspectRatio] = useState<AspectRatioConfig>(DEFAULT_ASPECT_RATIO);
  const [selectedPipeline, setSelectedPipeline] = useState(DEFAULT_PIPELINE);
  const [selectedPreprocessor, setSelectedPreprocessor] = useState(NO_PREPROCESSOR);
  const [availablePipelines, setAvailablePipelines] = useState<PipelineDescriptor[]>([
    DEFAULT_PIPELINE_DESCRIPTOR,
  ]);
  const [scopeHealth, setScopeHealth] = useState<HealthResponse | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [lastScopeCheckAt, setLastScopeCheckAt] = useState<number | null>(null);
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
  const [copyCommandStatus, setCopyCommandStatus] = useState<"idle" | "copied" | "error">("idle");
  const [autoThemeEnabled, setAutoThemeEnabled] = useState(false);
  const [autoThemeSectionBeats, setAutoThemeSectionBeats] = useState(32);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [scopeCapabilities, setScopeCapabilities] = useState<ScopeCapabilities>({
    hardwareSummary: "Unknown",
    freeVramGb: null,
    totalVramGb: null,
    modelReady: null,
    loraCount: 0,
    pluginCount: 0,
  });
  const scopeClient = useMemo(() => getScopeClient(), []);

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

  const selectedPipelineDescriptor = useMemo(() => {
    return (
      mainPipelineOptions.find((pipeline) => pipeline.id === selectedPipeline) ??
      availablePipelines.find((pipeline) => pipeline.id === selectedPipeline) ??
      DEFAULT_PIPELINE_DESCRIPTOR
    );
  }, [mainPipelineOptions, availablePipelines, selectedPipeline]);

  const activePipelineChain = useMemo(() => {
    if (selectedPreprocessor !== NO_PREPROCESSOR) {
      return `${selectedPreprocessor} → ${selectedPipeline}`;
    }
    return selectedPipeline;
  }, [selectedPreprocessor, selectedPipeline]);

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
    promptAccent,
    activeDenoisingSteps,
    setDenoisingProfile,
    setReactivityProfile,
    setPromptAccent,
    composePromptEntries,
  } = useSoundscape({
    initialTheme: "astral",
    debug: process.env.NODE_ENV === "development",
  });

  // Track if audio is ready
  const [audioReady, setAudioReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoAutoplayBlocked, setVideoAutoplayBlocked] = useState(false);

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
      if (playing && audioReady) {
        stopAmbient();
        start();
      } else {
        stop();
        if (scopeStream) {
          startAmbient();
        }
      }
    },
    [audioReady, start, stop, startAmbient, stopAmbient, scopeStream]
  );

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

  const handlePromptAccentTextChange = useCallback(
    (value: string) => {
      setPromptAccent(value, promptAccent.weight);
    },
    [setPromptAccent, promptAccent.weight]
  );

  const handlePromptAccentWeightChange = useCallback(
    (weight: number) => {
      setPromptAccent(promptAccent.text, weight);
    },
    [setPromptAccent, promptAccent.text]
  );

  const handleApplyPromptAccentPreset = useCallback(
    (preset: string) => {
      const current = promptAccent.text.trim();
      const next = current ? `${current}, ${preset}` : preset;
      setPromptAccent(next, promptAccent.weight);
    },
    [promptAccent.text, promptAccent.weight, setPromptAccent]
  );

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
    void refreshScopeDiagnostics();
  }, [refreshScopeDiagnostics]);

  const hasHydratedFromStorage = useRef(false);
  useEffect(() => {
    if (hasHydratedFromStorage.current) return;
    hasHydratedFromStorage.current = true;
    try {
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
      const storedAccentText = window.localStorage.getItem("soundscape.promptAccent.text") ?? "";
      const storedAccentWeight = Number(window.localStorage.getItem("soundscape.promptAccent.weight") ?? "0.25");
      const validAccentWeight =
        Number.isFinite(storedAccentWeight) && storedAccentWeight >= 0.05 && storedAccentWeight <= 1
          ? storedAccentWeight
          : 0.25;
      setPromptAccent(storedAccentText, validAccentWeight);
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
    } catch {
      // localStorage unavailable (e.g., Safari private browsing)
    }
  }, [setDenoisingProfile, setPromptAccent, setReactivityProfile]);

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
    try {
      window.localStorage.setItem("soundscape.promptAccent.text", promptAccent.text);
      window.localStorage.setItem("soundscape.promptAccent.weight", String(promptAccent.weight));
    } catch { /* storage unavailable */ }
  }, [promptAccent]);

  useEffect(() => {
    try { window.localStorage.setItem("soundscape.autoTheme.enabled", String(autoThemeEnabled)); } catch { /* storage unavailable */ }
  }, [autoThemeEnabled]);

  useEffect(() => {
    try { window.localStorage.setItem("soundscape.autoTheme.sectionBeats", String(autoThemeSectionBeats)); } catch { /* storage unavailable */ }
  }, [autoThemeSectionBeats]);

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

  useEffect(() => {
    if (pendingToggleFocusRef.current === "show-controls" && !showControls) {
      requestAnimationFrame(() => {
        showControlsButtonRef.current?.focus();
      });
      pendingToggleFocusRef.current = null;
      return;
    }

    if (pendingToggleFocusRef.current === "hide-controls" && showControls) {
      requestAnimationFrame(() => {
        hideControlsButtonRef.current?.focus();
      });
      pendingToggleFocusRef.current = null;
    }
  }, [showControls]);

  const loadParams = useMemo(() => {
    const params: Record<string, unknown> = {
      width: aspectRatio.resolution.width,
      height: aspectRatio.resolution.height,
    };
    if (selectedPipeline === "longlive") {
      params.vace_enabled = false;
    }
    return params;
  }, [aspectRatio, selectedPipeline]);

  const pipelineIdsForConnect = useMemo(() => {
    if (selectedPreprocessor !== NO_PREPROCESSOR) {
      return [selectedPreprocessor, selectedPipeline];
    }
    return [selectedPipeline];
  }, [selectedPreprocessor, selectedPipeline]);

  const initialParameters = useMemo(() => {
    if (!currentTheme) return undefined;
    const basePrompt = [
      currentTheme.basePrompt,
      ...currentTheme.styleModifiers,
      "calm atmosphere, gentle flow",
    ].join(", ");
    const params = {
      pipeline_ids: pipelineIdsForConnect,
      input_mode: "text" as const,
      prompts: composePromptEntries(basePrompt),
      prompt_interpolation_method: "linear" as const,
      denoising_step_list: [...activeDenoisingSteps],
      manage_cache: true,
      kv_cache_attention_bias: 0.3,
      recording: false,
    };
    console.log("[Scope] initialParameters:", JSON.stringify(params, null, 2));
    return params;
  }, [activeDenoisingSteps, composePromptEntries, currentTheme, pipelineIdsForConnect]);

  const legacyInitialParameters = useMemo(() => {
    if (!currentTheme) return undefined;
    const basePrompt = [
      currentTheme.basePrompt,
      ...currentTheme.styleModifiers,
      "calm atmosphere, gentle flow",
    ].join(", ");
    const params = {
      pipeline_ids: pipelineIdsForConnect,
      input_mode: "text" as const,
      prompts: composePromptEntries(basePrompt),
      manage_cache: true,
    };
    console.log("[Scope] legacyInitialParameters:", JSON.stringify(params, null, 2));
    return params;
  }, [composePromptEntries, currentTheme, pipelineIdsForConnect]);

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
    reconnectAttempts,
    peerConnection,
    connect,
    disconnect,
    retry,
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
  const canConnect =
    !isConnecting &&
    !isDiagnosticsLoading &&
    scopeHealth?.status === "ok" &&
    hasPipelineSelection;
  const connectBlockedReason =
    isConnecting
      ? null
      : isDiagnosticsLoading
        ? "Checking Scope readiness..."
        : scopeHealth === null
          ? "Scope readiness not loaded yet. Click Refresh to check server status."
          : !hasPipelineSelection
            ? "Select a main pipeline before connecting."
            : scopeHealth?.status !== "ok"
              ? "Scope server offline. Start Scope and refresh readiness."
              : null;
  const scopeReadiness = useMemo(() => {
    if (scopeHealth?.status === "ok") {
      return { label: "Online", textClass: "text-scope-cyan", dotClass: "bg-scope-cyan" };
    }

    if (scopeHealth === null || isDiagnosticsLoading) {
      return { label: "Checking", textClass: "text-amber-200", dotClass: "bg-amber-300" };
    }

    return { label: "Offline", textClass: "text-red-300", dotClass: "bg-red-400" };
  }, [scopeHealth, isDiagnosticsLoading]);
  const connectionSummary = useMemo(() => {
    switch (connectionState) {
      case "connected":
        return { label: "Live", textClass: "text-scope-cyan", dotClass: "bg-scope-cyan" };
      case "connecting":
        return { label: "Connecting", textClass: "text-amber-200", dotClass: "bg-amber-300" };
      case "reconnecting":
        return { label: "Reconnecting", textClass: "text-amber-200", dotClass: "bg-amber-300" };
      case "failed":
        return { label: "Failed", textClass: "text-red-300", dotClass: "bg-red-400" };
      default:
        return { label: "Standby", textClass: "text-white/70", dotClass: "bg-white/50" };
    }
  }, [connectionState]);
  const scopeErrorTitle = error?.userFriendly?.title ?? null;
  const scopeErrorDescription = error?.userFriendly?.description ?? null;
  const scopeErrorSuggestion = error?.userFriendly?.suggestion ?? null;

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
    const diagnostics = await refreshScopeDiagnostics();
    if (!diagnostics.isHealthy) {
      return;
    }

    const pipelineIds =
      diagnostics.resolvedPreprocessor !== NO_PREPROCESSOR
        ? [diagnostics.resolvedPreprocessor, diagnostics.resolvedPipeline]
        : [diagnostics.resolvedPipeline];

    await connect({
      pipelineId: diagnostics.resolvedPipeline,
      pipelineIds,
    });
  }, [clearError, refreshScopeDiagnostics, connect]);

  const handleCopyScopeCommand = useCallback(async () => {
    const command = "npm run check:scope";
    try {
      await navigator.clipboard.writeText(command);
      setCopyCommandStatus("copied");
    } catch {
      setCopyCommandStatus("error");
    }
  }, []);

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

  const isScopeOffline = scopeHealth !== null && scopeHealth.status !== "ok";

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
    if (copyCommandStatus === "idle") return;
    const timeoutId = setTimeout(() => setCopyCommandStatus("idle"), 1800);
    return () => clearTimeout(timeoutId);
  }, [copyCommandStatus]);

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

  return (
    <div className="h-full w-full flex flex-col relative z-0 bg-black overflow-hidden font-sans">
      {/* ALWAYS-PRESENT VIDEO LAYER (solves WebRTC mounting issues on Safari/iOS) */}
      <div
        className={`absolute inset-0 z-0 flex items-center justify-center transition-opacity duration-1000 ${scopeStream ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
      >
        <div className={`absolute inset-0 p-4 md:p-8 flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${showControls && scopeStream ? 'pb-[180px] md:pb-[140px]' : ''}`}>
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
                  filter: "contrast(1.1) saturate(1.1)",
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

      {/* TELEMETRY OVERLAY */}
      {scopeStream && showTelemetry && (
        <div className={`absolute right-4 glass-radiant bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl p-4 z-40 w-64 animate-fade-in shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${showControls ? 'bottom-24' : 'bottom-20'}`}>
          <p className="sr-only" role="status" aria-live="polite">
            Scope stream connected. Active pipeline {activePipelineChain}.
          </p>
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-scope-cyan/90 font-bold">
              <span className="inline-block w-2 h-2 rounded-full bg-scope-cyan animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" aria-hidden="true" />
              Live Telemetry
            </div>
            <button
              ref={hideTelemetryButtonRef}
              type="button"
              onClick={handleHideTelemetry}
              className="w-8 h-8 text-white/40 hover:text-white/90 hover:bg-white/10 transition-all duration-200 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-scope-cyan"
              aria-label="Hide telemetry"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-2 text-[11px] tabular-nums font-medium">
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
          <div className="mt-4 pt-3 border-t border-white/10 flex gap-2">
            {!isRecording ? (
              <button type="button" onClick={startRecordingClip} className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 py-2 text-[10px] uppercase tracking-widest font-bold text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all focus:outline-none focus:ring-2 focus:ring-red-500">Record</button>
            ) : (
              <button type="button" onClick={stopRecordingClip} className="flex-1 rounded-lg border border-red-500/50 bg-red-500/30 py-2 text-[10px] uppercase tracking-widest font-bold text-red-100 hover:bg-red-500/40 transition-all animate-pulse focus:outline-none focus:ring-2 focus:ring-red-500">Stop REC</button>
            )}
            {recordedClipUrl && (
              <a href={recordedClipUrl} download={`clip-${Date.now()}.webm`} className="flex-1 text-center rounded-lg border border-scope-cyan/30 bg-scope-cyan/10 py-2 text-[10px] uppercase tracking-widest font-bold text-scope-cyan hover:bg-scope-cyan/20 hover:border-scope-cyan/50 transition-all focus:outline-none focus:ring-2 focus:ring-scope-cyan">Save</a>
            )}
          </div>
        </div>
      )}



      {/* FOREGROUND UI STATES */}
      <div className={`absolute inset-0 z-20 transition-all duration-700 ${scopeStream ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>

        {/* Background Ambience when disconnected */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.1),rgba(0,0,0,0.8)_60%)] pointer-events-none" />

        {isConnecting ? (
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
              <h2 className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-scope-cyan to-scope-purple mb-3 tracking-widest font-bold" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}>
                {connectionState === "reconnecting" ? "RECONNECTING" : "INITIALIZING"}
              </h2>
              <p className="text-white/70 text-sm font-medium mb-6 uppercase tracking-wider">{statusMessage || "Establishing secure stream..."}</p>
              <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-scope-cyan via-scope-purple to-scope-magenta animate-pulse rounded-full w-[80%]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col md:flex-row p-4 md:p-8 gap-8 lg:gap-16 justify-center items-center pointer-events-auto overflow-y-auto w-full max-w-6xl mx-auto">

            {/* Left Column: Intro & Branding */}
            <div className="flex-1 w-full max-w-lg lg:pr-12 animate-fade-in">
              <h1 className="text-5xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/50 mb-6 font-bold tracking-tight drop-shadow-lg" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}>
                Daydream Scope
              </h1>
              <p className="text-lg text-white/60 mb-10 leading-relaxed font-light">
                Hardware-accelerated audio-reactive environment. Configure your AI synthesis pipeline and initiate connection.
              </p>

              <div className="space-y-6">
                <button type="button" onClick={() => { void refreshScopeDiagnostics(); }} disabled={isDiagnosticsLoading} className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold rounded-lg bg-white/5 text-whitehover:bg-white/10 hover:text-white transition-all border border-white/10 hover:border-scope-cyan/30 focus:outline-none focus:ring-2 focus:ring-scope-cyan">
                  {isDiagnosticsLoading ? "Scanning..." : "Refresh"}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${scopeReadiness.dotClass} shadow-[0_0_10px_currentColor]`} />
                  <span className={`text-sm font-bold uppercase tracking-wider ${scopeReadiness.textClass}`}>{scopeReadiness.label}</span>
                </div>
                <span className="text-xs text-white/40 font-mono">{scopeCapabilities.totalVramGb ? `${scopeCapabilities.totalVramGb.toFixed(1)} GB VRAM` : "Scanning..."}</span>
              </div>
            </div>

            {/* Right Column: Configuration Panel */}
            <div className="w-full max-w-md shrink-0 flex flex-col glass-radiant rounded-3xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-xs text-scope-cyan/70 uppercase tracking-widest font-semibold">
                    <span>Pipeline Config</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-scope-cyan/20 to-transparent" />
                  </div>

                  <div className="space-y-3">
                    <label className="block">
                      <span className="block text-[10px] text-white/50 uppercase tracking-widest font-bold mb-2">Main Pipeline</span>
                      <select value={selectedPipeline} onChange={(e) => setSelectedPipeline(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-sm text-white focus:border-scope-cyan/50 focus:ring-1 focus:ring-scope-cyan/50 transition-all outline-none appearance-none">
                        {mainPipelineOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </label>

                    <label className="block">
                      <span className="block text-[10px] text-white/50 uppercase tracking-widest font-bold mb-2">Preprocessor</span>
                      <select
                        value={selectedPreprocessor}
                        onChange={(e) => setSelectedPreprocessor(e.target.value)}
                        disabled={preprocessorOptions.length === 0}
                        className={`w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-sm focus:border-scope-cyan/50 focus:ring-1 focus:ring-scope-cyan/50 transition-all outline-none appearance-none ${preprocessorOptions.length === 0 ? 'text-white/30 cursor-not-allowed' : 'text-white'}`}
                      >
                        <option value={NO_PREPROCESSOR}>{preprocessorOptions.length === 0 ? "Loading..." : "None"}</option>
                        {preprocessorOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-xs text-scope-purple/70 uppercase tracking-widest font-semibold">
                    <span>Generation Profile</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-scope-purple/20 to-transparent" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="block text-[10px] text-white/50 uppercase tracking-widest font-bold mb-2">Denoising</span>
                      <select value={denoisingProfileId} onChange={(e) => handleDenoisingProfileChange(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:border-scope-purple/50 outline-none appearance-none">
                        <option value="speed">Speed</option>
                        <option value="balanced">Balanced</option>
                        <option value="quality">Quality</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="block text-[10px] text-white/50 uppercase tracking-widest font-bold mb-2">Reactivity</span>
                      <select value={reactivityProfileId} onChange={(e) => handleReactivityProfileChange(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:border-scope-purple/50 outline-none appearance-none">
                        <option value="cinematic">Cinematic</option>
                        <option value="balanced">Balanced</option>
                        <option value="kinetic">Kinetic</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Accent Weight</span>
                      <span className="text-[10px] text-white/80 font-mono bg-white/10 px-1.5 py-0.5 rounded">{promptAccent.weight.toFixed(2)}</span>
                    </div>
                    <input type="range" min={0.05} max={1} step={0.05} value={promptAccent.weight} onChange={(e) => handlePromptAccentWeightChange(Number(e.target.value))} className="w-full accent-scope-purple" />
                  </label>
                </div>

                {scopeErrorTitle && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 relative animate-fade-in shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <button type="button" onClick={clearError} className="absolute top-2 right-2 text-red-400 hover:text-red-300">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <p className="text-red-400 font-bold text-xs uppercase tracking-wider mb-1">{scopeErrorTitle}</p>
                    {scopeErrorDescription && <p className="text-red-200/80 text-[11px] leading-relaxed">{scopeErrorDescription}</p>}
                  </div>
                )}
              </div>

              <div className="p-6 bg-black/40 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => { void handleConnectScope(); }}
                  disabled={!canConnect}
                  className={`w-full py-4 rounded-xl text-sm uppercase tracking-widest font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-scope-cyan overflow-hidden relative group ${canConnect
                    ? 'bg-scope-cyan text-black hover:bg-white hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]'
                    : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                    }`}
                >
                  {canConnect && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shimmer" />}
                  <span className="relative z-10">{isConnecting ? "Connecting..." : "Initiate Connection"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING CONTROLS DOCK - Bottom (Theme Picker) */}
      <div className={`absolute bottom-6 left-0 right-0 z-40 w-full px-20 md:px-24 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex justify-center items-center ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0 pointer-events-none'}`}>
        <div className="w-full max-w-[calc(100vw-12rem)] md:max-w-6xl">
          <ThemeSelector themes={presetThemes} currentTheme={currentTheme} onThemeChange={setTheme} compact />
        </div>
      </div>

      {/* FLOATING ACTION BUTTONS (FABs) */}
      {scopeStream && showControls && (
        <>
          {/* LEFT: MUSIC AND SETTINGS */}
          <div className="absolute bottom-6 left-6 z-50 flex gap-4">

            {/* Music/Audio Menu & FAB */}
            <div className="flex flex-col justify-end items-start gap-3">
              <div className={`transition-all duration-300 origin-bottom-left ease-[cubic-bezier(0.16,1,0.3,1)] absolute bottom-full mb-3 left-0 ${showAudioMenu ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-8 pointer-events-none'}`}>
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
                className={`relative z-50 w-[3.25rem] h-[3.25rem] flex items-center justify-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 focus:outline-none focus:ring-2 focus:ring-scope-cyan ${showAudioMenu ? 'bg-scope-purple text-white hover:bg-scope-purple/90 hover:shadow-[0_0_20px_rgba(139,92,246,0.6)]' : 'glass-radiant hover:border-white/20 text-white/80 hover:bg-white/10 hover:text-white'}`}
                aria-label="Toggle Audio Controls"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              </button>
            </div>

          </div>

          {/* RIGHT: SETTINGS & TELEMETRY */}
          <div className="absolute bottom-6 right-6 z-50 flex flex-col justify-end items-end gap-3">
            <div className={`transition-all duration-300 origin-bottom-right ease-[cubic-bezier(0.16,1,0.3,1)] absolute bottom-full mb-3 right-0 ${showSettingsMenu ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-8 pointer-events-none'}`}>
              <div className="glass-radiant w-64 rounded-2xl p-4 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className={`flex items-center gap-2 text-[10px] uppercase font-mono tracking-[0.2em] font-bold ${connectionSummary.textClass}`}>
                    <span className={`w-2 h-2 rounded-full ${connectionSummary.dotClass} ${connectionState === 'connected' ? 'animate-pulse shadow-[0_0_8px_currentColor]' : ''}`} />
                    {connectionSummary.label}
                  </span>
                </div>

                {/* Telemetry Toggle */}
                <button
                  type="button"
                  onClick={showTelemetry ? handleHideTelemetry : handleShowTelemetry}
                  className={`w-full py-2.5 rounded-lg transition-all text-[10px] font-bold font-mono tracking-[0.2em] uppercase border ${showTelemetry ? 'bg-scope-cyan/20 text-scope-cyan border-scope-cyan/30 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'}`}
                >
                  {showTelemetry ? "Hide Telemetry" : "Show Telemetry"}
                </button>

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

            <button
              type="button"
              onClick={() => { setShowSettingsMenu(!showSettingsMenu); setShowAudioMenu(false); }}
              className={`w-[3.25rem] h-[3.25rem] rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 focus:outline-none focus:ring-2 focus:ring-scope-cyan ${showSettingsMenu ? 'bg-scope-cyan text-black hover:bg-scope-cyan/90 hover:shadow-[0_0_20px_rgba(6,182,212,0.6)]' : 'glass-radiant hover:border-white/20 text-white/80 hover:bg-white/10 hover:text-white'}`}
              aria-label="Toggle Settings Menu"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
        </>
      )}
    </div >
  );
}
