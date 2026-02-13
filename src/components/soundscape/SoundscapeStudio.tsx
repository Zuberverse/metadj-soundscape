/**
 * Soundscape Studio Component
 * Video-first layout with collapsible controls
 */

"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  useSoundscape,
  DEFAULT_ASPECT_RATIO,
  DENOISING_PROFILES,
  REACTIVITY_PROFILES,
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

// Reconnection configuration
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;
const WARNING_DROPPED_FRAME_PERCENT = 5;
const CRITICAL_DROPPED_FRAME_PERCENT = 12;
const WARNING_FPS_THRESHOLD = 10;

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
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">{title}</span>
          {badge}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-white/30 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
}

export function SoundscapeStudio({
  onConnectionChange,
  sharpenEnabled: sharpenEnabledProp,
  showControls: showControlsProp,
  onControlsToggle,
  onRegisterDisconnect,
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

  // UI state - use props if provided (controlled), otherwise internal state (uncontrolled)
  const [showControlsInternal, setShowControlsInternal] = useState(true);

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
  const [showTelemetry, setShowTelemetry] = useState(true);
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

  // Soundscape hook
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
    initialTheme: "neon-foundry",
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
      videoElement.srcObject = scopeStream;
      const playPromise = videoElement.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            setVideoAutoplayBlocked(false);
          })
          .catch((err) => {
            setVideoAutoplayBlocked(true);
            console.warn("[Soundscape] Video autoplay blocked:", err.message);
          });
      } else {
        setVideoAutoplayBlocked(false);
      }
      return;
    }

    setVideoAutoplayBlocked(false);
    if (videoElement.srcObject) {
      videoElement.pause();
      videoElement.srcObject = null;
    }
  }, [scopeStream]);

  useEffect(() => {
    void refreshScopeDiagnostics();
  }, [refreshScopeDiagnostics]);

  useEffect(() => {
    try {
      const storedPipeline = window.localStorage.getItem("soundscape.pipeline");
      if (storedPipeline) {
        setSelectedPipeline(storedPipeline);
      }
      const storedPreprocessor = window.localStorage.getItem("soundscape.preprocessor");
      if (storedPreprocessor) {
        setSelectedPreprocessor(storedPreprocessor);
      }
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
    if (!scopeStream) {
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
    return {
      prompts: composePromptEntries(basePrompt),
      noise_scale: currentTheme.ranges.noiseScale.min,
      denoising_step_list: [...activeDenoisingSteps],
      manage_cache: true,
      paused: false,
    };
  }, [activeDenoisingSteps, composePromptEntries, currentTheme]);

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
    reconnectBaseDelay: RECONNECT_DELAY_MS,
    setupPeerConnection: (connection) => {
      connection.addTransceiver("video");
    },
    onStream: (stream) => {
      setScopeStream(stream);
    },
    onDataChannelOpen: (channel) => {
      setDataChannel(channel);
      if (!isPlaying) {
        startAmbient();
      }
    },
    onDataChannelClose: () => {
      setDataChannel(null);
      stopAmbient();
    },
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
      return { label: "Sampling", color: "text-white/50", dotColor: "bg-white/30" };
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

  useEffect(() => {
    const handleGlobalHotkeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" || target.isContentEditable);

      if (isTextInput || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === " ") {
        event.preventDefault();
        void transportControlsRef.current?.togglePlayPause();
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        const theme = presetThemes[Number(event.key) - 1];
        if (theme) setTheme(theme.id);
      }
    };

    window.addEventListener("keydown", handleGlobalHotkeys);
    return () => window.removeEventListener("keydown", handleGlobalHotkeys);
  }, [presetThemes, setTheme]);

  useEffect(() => {
    if (!autoThemeEnabled || !isPlaying || !scopeStream || !soundscapeState.analysis) {
      processedBeatTimestampRef.current = 0;
      autoThemeBeatCounterRef.current = 0;
      return;
    }

    const beat = soundscapeState.analysis.beat;
    if (!beat.isBeat || !beat.lastBeatTime) return;
    if (beat.lastBeatTime === processedBeatTimestampRef.current) return;

    processedBeatTimestampRef.current = beat.lastBeatTime;
    autoThemeBeatCounterRef.current += 1;

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
    <div className="h-full flex flex-col">
      {/* VIDEO HERO */}
      <div className="flex-1 min-h-0 relative bg-black">
        {scopeStream ? (
          /* Connected: Video with telemetry overlay */
          <div className="absolute inset-0 p-3 pt-2 pb-12 md:p-4 md:pt-2 md:pb-14 flex items-center justify-center">
            {/* Telemetry overlay -- dismissible */}
            {showTelemetry && (
              <div className="absolute top-3 left-3 md:left-4 glass bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 z-20 max-w-[280px] animate-fade-in">
                <p className="sr-only" role="status" aria-live="polite">
                  Scope stream connected. Active pipeline {activePipelineChain}.
                </p>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-scope-cyan/80">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-scope-cyan animate-pulse" aria-hidden="true" />
                    <span className="font-semibold">Live</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTelemetry(false)}
                    className="p-1 text-white/30 hover:text-white/60 transition-colors duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-scope-cyan rounded"
                    aria-label="Hide telemetry overlay"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-1 text-[10px] tabular-nums">
                  <div className="flex justify-between"><span className="text-white/40">Pipeline</span><span className="text-white/75 font-medium truncate ml-2 max-w-[140px]">{activePipelineChain}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Resolution</span><span className="text-white/75 font-medium">{videoStats.width > 0 ? `${videoStats.width}x${videoStats.height}` : "..."}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">FPS</span><span className="text-white/75 font-medium">{videoStats.fps !== null ? videoStats.fps.toFixed(1) : "..."}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/40">Performance</span>
                    <span className={`font-semibold flex items-center gap-1.5 ${performanceStatus.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${performanceStatus.dotColor}`} aria-hidden="true" />
                      {performanceStatus.label}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-white/8 flex items-center gap-1.5">
                  {!isRecording ? (
                    <button type="button" onClick={startRecordingClip} aria-label="Start recording clip" className="rounded-lg border border-red-400/25 bg-red-500/10 px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-red-200 hover:bg-red-500/20 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Record</button>
                  ) : (
                    <button type="button" onClick={stopRecordingClip} aria-label="Stop recording clip" className="rounded-lg border border-red-400/35 bg-red-500/20 px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-red-100 hover:bg-red-500/30 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 animate-status-pulse">Stop</button>
                  )}
                  {recordedClipUrl && (
                    <a href={recordedClipUrl} download={`soundscape-clip-${Date.now()}.webm`} className="rounded-lg border border-scope-cyan/25 bg-scope-cyan/10 px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-scope-cyan hover:bg-scope-cyan/20 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan">Download</a>
                  )}
                  {recordedClipSeconds !== null && <span className="text-[9px] text-white/35 ml-1">{recordedClipSeconds.toFixed(1)}s</span>}
                </div>
                {recordingError && <p className="text-[9px] text-amber-300/80 mt-1">{recordingError}</p>}
              </div>
            )}

            {/* Show telemetry button when hidden */}
            {!showTelemetry && (
              <button type="button" onClick={() => setShowTelemetry(true)} className="absolute top-3 left-3 md:left-4 z-20 p-2 glass bg-black/50 rounded-lg border border-white/10 text-white/40 hover:text-white/70 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan" aria-label="Show telemetry overlay">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            )}

            {/* Video frame */}
            <div
              className="relative"
              style={{
                aspectRatio: `${aspectRatio.resolution.width} / ${aspectRatio.resolution.height}`,
                maxWidth: '100%',
                maxHeight: '100%',
                width: aspectRatio.mode === '16:9' ? '100%' : 'auto',
                height: aspectRatio.mode === '9:16' ? '100%' : 'auto',
              }}
            >
              <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-scope-purple/25 via-scope-cyan/15 to-scope-magenta/25 blur-xl opacity-50 animate-pulse" aria-hidden="true" />
              <div className="absolute -inset-0.5 rounded-[1.25rem] bg-gradient-to-br from-scope-cyan/30 via-transparent to-scope-purple/30 blur-md" aria-hidden="true" />
              <div className="absolute inset-0 rounded-xl p-[2px] bg-gradient-to-br from-scope-cyan/50 via-scope-purple/30 to-scope-magenta/50">
                <div className="w-full h-full rounded-[calc(0.75rem-2px)] bg-black/90" />
              </div>
              <div className="absolute inset-[2px] rounded-[calc(0.75rem-2px)] overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={sharpenEnabled ? { filter: "contrast(1.08) saturate(1.05)", imageRendering: "crisp-edges" } : undefined}
                />
              </div>
              {videoAutoplayBlocked && (
                <button type="button" onClick={() => { void handleResumeVideoPlayback(); }} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-xl glass bg-black/70 border border-white/20 text-xs uppercase tracking-wider text-white/85 hover:bg-black/80 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan">
                  Tap to start video
                </button>
              )}
            </div>
          </div>
        ) : isConnecting ? (
          /* Connecting state */
          <div className="absolute inset-0 flex items-center justify-center px-4 py-6">
            <div className="glass-radiant text-center p-8 rounded-2xl max-w-sm w-full animate-fade-in">
              <div className="mb-5 flex justify-center">
                <svg width="48" height="48" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_12px_rgba(6,182,212,0.4)] animate-pulse" aria-hidden="true">
                  <path d="M28 22V52" stroke="url(#initGrad)" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M52 18V48" stroke="url(#initGrad)" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M28 22L52 18" stroke="url(#initGrad)" strokeWidth="4" strokeLinecap="round" />
                  <path d="M28 28L52 24" stroke="url(#initGrad)" strokeWidth="3" strokeLinecap="round" />
                  <ellipse cx="22" cy="54" rx="7" ry="5" fill="url(#initGrad)" transform="rotate(-20 22 54)" />
                  <ellipse cx="46" cy="50" rx="7" ry="5" fill="url(#initGrad)" transform="rotate(-20 46 50)" />
                  <defs><linearGradient id="initGrad" x1="16" y1="14" x2="56" y2="58" gradientUnits="userSpaceOnUse"><stop stopColor="#06b6d4" /><stop offset="0.5" stopColor="#8b5cf6" /><stop offset="1" stopColor="#ec4899" /></linearGradient></defs>
                </svg>
              </div>
              <h2 className="text-lg text-white mb-2 tracking-wide" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}>
                {connectionState === "reconnecting" ? "Reconnecting" : "Connecting"}
              </h2>
              <p className="text-scope-cyan/80 text-sm font-medium mb-4" role="status" aria-live="polite">{statusMessage || "Establishing connection..."}</p>
              {connectionState === "reconnecting" && <p className="text-[10px] text-white/40 mb-3">Attempt {reconnectAttempts + 1} of {MAX_RECONNECT_ATTEMPTS}</p>}
              <div className="w-40 h-1 bg-white/5 rounded-full mx-auto overflow-hidden"><div className="h-full bg-gradient-to-r from-scope-purple via-scope-cyan to-scope-magenta animate-pulse rounded-full w-2/3" /></div>
            </div>
          </div>
        ) : (
          /* Disconnected: Pre-connect setup */
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar overscroll-contain">
            <div className="min-h-full flex items-start justify-center px-3 py-4 sm:px-4 sm:py-6">
              <div className="glass-radiant text-center w-full max-w-2xl px-5 py-6 sm:px-6 sm:py-7 rounded-2xl animate-fade-in">
                <h2 className="text-xl sm:text-2xl text-white mb-1.5 tracking-wide bg-gradient-to-r from-scope-cyan via-scope-purple to-scope-magenta bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}>
                  Soundscape
                </h2>
                <p className="text-white/40 mb-6 text-sm">Real-time AI visuals from your audio</p>

                {/* Output Format */}
                <div className="mb-5">
                  <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] mb-2.5 font-semibold">Output Format</p>
                  <div className="flex justify-center"><AspectRatioToggle current={aspectRatio} onChange={setAspectRatio} disabled={false} /></div>
                </div>

                {/* Collapsible sections */}
                <div className="space-y-2 text-left mb-6">
                  {/* Scope Readiness */}
                  <CollapsibleSection
                    title="Scope Readiness"
                    defaultOpen={true}
                    badge={
                      <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider ${scopeHealth?.status === "ok" ? "text-scope-cyan" : "text-red-300"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${scopeHealth?.status === "ok" ? "bg-scope-cyan" : "bg-red-400"}`} />
                        {scopeHealth?.status === "ok" ? "Online" : "Offline"}
                      </span>
                    }
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-end">
                        <button type="button" onClick={() => { void refreshScopeDiagnostics(); }} disabled={isDiagnosticsLoading || isConnecting} className="px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/8 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan">
                          {isDiagnosticsLoading ? "Checking..." : "Refresh"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                        <span className="text-white/40">Server</span>
                        <span className={scopeHealth?.status === "ok" ? "text-scope-cyan font-semibold" : "text-red-300 font-semibold"}>{scopeHealth?.status === "ok" ? "Online" : "Offline"}</span>
                        <span className="text-white/40">Pipeline State</span>
                        <span className="text-white/70">{pipelineStatus?.status ?? "unknown"}</span>
                        <span className="text-white/40">Version</span>
                        <span className="text-white/70">{scopeHealth?.version ?? "n/a"}</span>
                        <span className="text-white/40">GPU</span>
                        <span className="text-white/70 truncate">{scopeCapabilities.hardwareSummary}</span>
                        <span className="text-white/40">VRAM</span>
                        <span className="text-white/70">{scopeCapabilities.totalVramGb ? `${scopeCapabilities.freeVramGb?.toFixed(1) ?? "?"}/${scopeCapabilities.totalVramGb.toFixed(1)} GB` : "n/a"}</span>
                        <span className="text-white/40">Models</span>
                        <span className={scopeCapabilities.modelReady === true ? "text-scope-cyan font-semibold" : scopeCapabilities.modelReady === false ? "text-amber-300 font-semibold" : "text-white/60"}>
                          {scopeCapabilities.modelReady === null ? "Unknown" : scopeCapabilities.modelReady ? "Ready" : "Not ready"}
                        </span>
                      </div>
                      {isScopeOffline && (
                        <div className="rounded-xl border border-amber-300/25 bg-amber-400/8 p-3 space-y-2">
                          <p className="text-[10px] uppercase tracking-wider text-amber-200 font-semibold">Scope Offline</p>
                          <p className="text-[10px] text-amber-100/80 leading-relaxed">Audio analysis and theme switching work locally. Start the Scope server to stream visuals.</p>
                          <button type="button" onClick={handleCopyScopeCommand} className="rounded-lg border border-amber-300/30 bg-black/20 px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-amber-100 hover:bg-black/30 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                            {copyCommandStatus === "copied" ? "Copied" : "Copy health command"}
                          </button>
                        </div>
                      )}
                      {diagnosticsError && <p className="text-[10px] text-amber-300/80 font-medium" role="alert">{diagnosticsError}</p>}
                      {lastScopeCheckAt && <p className="text-[10px] text-white/25">Last check: {new Date(lastScopeCheckAt).toLocaleTimeString()}</p>}
                    </div>
                  </CollapsibleSection>

                  {/* Pipeline Selection */}
                  <CollapsibleSection title="Pipeline" defaultOpen={true}>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="pipeline-select" className="block text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5">Main Pipeline</label>
                        <select id="pipeline-select" value={selectedPipeline} disabled={isConnecting} onChange={(e) => setSelectedPipeline(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-scope-cyan/40 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                          {mainPipelineOptions.map((p) => <option key={p.id} value={p.id} className="bg-scope-bg">{p.name}</option>)}
                        </select>
                      </div>
                      {preprocessorOptions.length > 0 && (
                        <div>
                          <label htmlFor="preprocessor-select" className="block text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5">Preprocessor</label>
                          <select id="preprocessor-select" value={selectedPreprocessor} disabled={isConnecting} onChange={(e) => setSelectedPreprocessor(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-scope-cyan/40 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                            <option value={NO_PREPROCESSOR} className="bg-scope-bg">None</option>
                            {preprocessorOptions.map((p) => <option key={p.id} value={p.id} className="bg-scope-bg">{p.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPipelineDescriptor.supportsVace === true && <span className="rounded-md bg-scope-cyan/8 border border-scope-cyan/20 px-2 py-1 text-[10px] text-scope-cyan font-medium">VACE</span>}
                        {selectedPipelineDescriptor.supportsLora === true && <span className="rounded-md bg-scope-purple/8 border border-scope-purple/20 px-2 py-1 text-[10px] text-scope-purple font-medium">LoRA</span>}
                        {typeof selectedPipelineDescriptor.estimatedVramGb === "number" && <span className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-white/60 font-medium">{selectedPipelineDescriptor.estimatedVramGb} GB</span>}
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Generation Controls -- collapsed by default */}
                  <CollapsibleSection title="Generation Controls" defaultOpen={false}>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-[10px] text-white/45 font-medium">
                          Denoising
                          <select value={denoisingProfileId} disabled={isConnecting} onChange={(e) => handleDenoisingProfileChange(e.target.value)} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-black/30 border border-white/10 text-[11px] text-white focus:outline-none focus:border-scope-cyan/40 transition-colors duration-200 disabled:opacity-40">
                            <option value="speed" className="bg-scope-bg">Speed</option>
                            <option value="balanced" className="bg-scope-bg">Balanced</option>
                            <option value="quality" className="bg-scope-bg">Quality</option>
                          </select>
                        </label>
                        <label className="text-[10px] text-white/45 font-medium">
                          Reactivity
                          <select value={reactivityProfileId} disabled={isConnecting} onChange={(e) => handleReactivityProfileChange(e.target.value)} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-black/30 border border-white/10 text-[11px] text-white focus:outline-none focus:border-scope-cyan/40 transition-colors duration-200 disabled:opacity-40">
                            <option value="cinematic" className="bg-scope-bg">Cinematic</option>
                            <option value="balanced" className="bg-scope-bg">Balanced</option>
                            <option value="kinetic" className="bg-scope-bg">Kinetic</option>
                          </select>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-[10px] text-white/45 font-medium">
                          Auto Theme
                          <select value={autoThemeEnabled ? "on" : "off"} disabled={isConnecting} onChange={(e) => setAutoThemeEnabled(e.target.value === "on")} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-black/30 border border-white/10 text-[11px] text-white focus:outline-none focus:border-scope-cyan/40 transition-colors duration-200 disabled:opacity-40">
                            <option value="off" className="bg-scope-bg">Off</option>
                            <option value="on" className="bg-scope-bg">On</option>
                          </select>
                        </label>
                        <label className="text-[10px] text-white/45 font-medium">
                          Section Beats
                          <select value={autoThemeSectionBeats} disabled={!autoThemeEnabled || isConnecting} onChange={(e) => setAutoThemeSectionBeats(Number(e.target.value))} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-black/30 border border-white/10 text-[11px] text-white focus:outline-none focus:border-scope-cyan/40 transition-colors duration-200 disabled:opacity-40">
                            <option value={16} className="bg-scope-bg">16 beats</option>
                            <option value={32} className="bg-scope-bg">32 beats</option>
                            <option value={64} className="bg-scope-bg">64 beats</option>
                          </select>
                        </label>
                      </div>
                      <label className="block text-[10px] text-white/45 font-medium">
                        Prompt Accent
                        <input type="text" value={promptAccent.text} onChange={(e) => handlePromptAccentTextChange(e.target.value)} disabled={isConnecting} maxLength={500} placeholder="volumetric haze, prismatic bloom..." className="mt-1 w-full px-2.5 py-2 rounded-lg bg-black/30 border border-white/10 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-scope-cyan/40 transition-colors duration-200 disabled:opacity-40" />
                      </label>
                      <label className="block text-[10px] text-white/45 font-medium">
                        Accent Weight ({promptAccent.weight.toFixed(2)})
                        <input type="range" min={0.05} max={1} step={0.05} value={promptAccent.weight} disabled={isConnecting} onChange={(e) => handlePromptAccentWeightChange(Number(e.target.value))} className="mt-1 w-full accent-scope-cyan" aria-label={`Accent weight: ${promptAccent.weight.toFixed(2)}`} />
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {PROMPT_ACCENT_PRESETS.map((preset) => (
                          <button key={preset} type="button" onClick={() => handleApplyPromptAccentPreset(preset)} disabled={isConnecting} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] uppercase tracking-wider font-medium text-white/60 hover:bg-white/10 hover:text-white/80 disabled:opacity-40 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan">+ {preset}</button>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/30">Active denoising: [{activeDenoisingSteps.join(", ")}]</p>
                    </div>
                  </CollapsibleSection>
                </div>

                {/* Keyboard shortcuts */}
                <p className="text-[9px] text-white/20 mb-4 uppercase tracking-wider">
                  <span className="text-white/35">Space</span> play/pause <span className="mx-2 text-white/10">|</span> <span className="text-white/35">1-9</span> theme presets
                </p>

                {/* Connect button */}
                <button type="button" onClick={() => { void handleConnectScope(); }} disabled={!canConnect} className="px-8 py-3.5 glass bg-scope-cyan/15 hover:bg-scope-cyan/25 text-scope-cyan border border-scope-cyan/35 rounded-xl text-sm uppercase tracking-[0.12em] font-semibold transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}>
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
                <p className="text-[10px] text-white/25 mt-2 font-medium">{activePipelineChain}</p>

                {/* Error display */}
                {scopeErrorTitle && (
                  <div className="mt-5 glass bg-red-500/8 border border-red-500/20 rounded-xl p-4 text-left relative animate-fade-in" role="alert">
                    <button type="button" onClick={clearError} className="absolute top-2.5 right-2.5 p-1 text-red-400/50 hover:text-red-400 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded" aria-label="Dismiss error">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <p className="text-red-400 font-semibold text-sm pr-6">{scopeErrorTitle}</p>
                    {scopeErrorDescription && <p className="text-red-400/70 text-xs mt-1">{scopeErrorDescription}</p>}
                    {scopeErrorSuggestion && <p className="text-white/40 text-xs mt-2 italic">{scopeErrorSuggestion}</p>}
                    {reconnectAttempts >= MAX_RECONNECT_ATTEMPTS && (
                      <button type="button" onClick={retry} className="mt-3 text-sm text-scope-cyan hover:underline font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan rounded">Retry Connection</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toggle Controls Button -- only when connected and controls hidden */}
        {!showControls && scopeStream && (
          <button type="button" onClick={handleToggleControls} aria-expanded={showControls} aria-controls="soundscape-controls" className="absolute bottom-3 right-3 px-3 py-2 min-h-[40px] glass bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/75 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-white/10 hover:border-white/20 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black">
            Show Controls
          </button>
        )}
      </div>

      {/* CONTROLS DOCK */}
      {showControls && (
        <div id="soundscape-controls" className="flex-none glass-radiant border-t border-white/8">
          <div className="px-4 pt-2 flex justify-end">
            <button type="button" onClick={handleToggleControls} aria-expanded={showControls} aria-controls="soundscape-controls" className="px-3 py-1.5 min-h-[36px] bg-white/5 hover:bg-white/8 text-white/45 hover:text-white/65 text-[9px] font-semibold uppercase tracking-wider rounded-lg border border-white/8 hover:border-white/15 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black">
              Hide Controls
            </button>
          </div>
          <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-5">
            {/* Music Source */}
            <div className="flex items-center gap-2.5 md:min-w-[280px]">
              <h3 className="text-[10px] uppercase tracking-[0.15em] text-scope-cyan/50 font-semibold whitespace-nowrap" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}>Music</h3>
              <AudioPlayer onAudioElement={handleAudioElement} onPlayStateChange={handlePlayStateChange} onRegisterControls={handleRegisterAudioControls} compact />
            </div>

            <div className="hidden md:block w-px h-8 bg-white/8" aria-hidden="true" />

            {/* Theme Selector */}
            <div className="flex-1 flex items-center gap-2.5 min-w-0">
              <h3 className="text-[10px] uppercase tracking-[0.15em] text-scope-cyan/50 font-semibold whitespace-nowrap" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}>Theme</h3>
              <div className="flex-1 min-w-0 space-y-1">
                <ThemeSelector themes={presetThemes} currentTheme={currentTheme} onThemeChange={setTheme} compact />
                {connectionState !== "connected" && <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium">Theme applies on next connect</p>}
              </div>
            </div>

            <div className="hidden xl:block w-px h-8 bg-white/8" aria-hidden="true" />

            {/* Analysis + status */}
            <div className="w-full xl:w-auto xl:min-w-[300px] space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/35 uppercase tracking-wider font-medium">Pipeline</span>
                <span className="text-white/70 font-semibold">{activePipelineChain}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/35 uppercase tracking-wider font-medium">Profiles</span>
                <span className="text-white/70 font-medium capitalize">{denoisingProfileId} / {reactivityProfileId}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/35 uppercase tracking-wider font-medium">Auto Theme</span>
                <span className={`font-semibold ${autoThemeEnabled ? "text-scope-cyan" : "text-white/40"}`}>{autoThemeEnabled ? `On / ${autoThemeSectionBeats} beats` : "Off"}</span>
              </div>
              {promptAccent.text && <div className="text-[10px] text-white/50 truncate">Accent: <span className="text-white/70">{promptAccent.text}</span></div>}
              <AnalysisMeter analysis={soundscapeState.analysis} parameters={soundscapeParameters} compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
