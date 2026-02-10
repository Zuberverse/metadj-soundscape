/**
 * Soundscape Studio Component
 * Video-first layout with collapsible controls
 */

"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSoundscape, DEFAULT_ASPECT_RATIO, DENOISING_STEPS } from "@/lib/soundscape";
import type { AspectRatioConfig } from "@/lib/soundscape";
import { getScopeClient, useScopeConnection } from "@/lib/scope";
import type { HealthResponse, PipelineDescriptor, PipelineStatusResponse } from "@/lib/scope";
import { AudioPlayer } from "./AudioPlayer";
import { ThemeSelector } from "./ThemeSelector";
import { AspectRatioToggle } from "./AspectRatioToggle";
import { AnalysisMeter } from "./AnalysisMeter";

// Default pipeline for Soundscape (longlive = stylized, smooth transitions)
const DEFAULT_PIPELINE = "longlive";
const NO_PREPROCESSOR = "__none__";
const DEFAULT_PIPELINE_DESCRIPTOR: PipelineDescriptor = {
  id: DEFAULT_PIPELINE,
  name: "LongLive",
  usage: [],
  source: "unknown",
};

// Reconnection configuration
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

interface VideoStats {
  width: number;
  height: number;
  totalFrames: number | null;
  droppedFrames: number | null;
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
  } = useSoundscape({
    initialTheme: "neon-foundry", // Start with Foundry instead of Cosmic to avoid default flash
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

  const refreshScopeDiagnostics = useCallback(async () => {
    setIsDiagnosticsLoading(true);
    setDiagnosticsError(null);

    try {
      const health = await scopeClient.checkHealth();
      setScopeHealth(health);
      setLastScopeCheckAt(Date.now());

      if (health.status !== "ok") {
        setPipelineStatus(null);
        setDiagnosticsError("Scope server unavailable. Verify SCOPE_API_URL and server health.");
        setAvailablePipelines([DEFAULT_PIPELINE_DESCRIPTOR]);
        return;
      }

      const [pipelines, status] = await Promise.all([
        scopeClient.getPipelineDescriptors(),
        scopeClient.getPipelineStatus(),
      ]);

      setPipelineStatus(status);

      if (pipelines.length > 0) {
        const sorted = [...pipelines].sort((a, b) => a.name.localeCompare(b.name));
        const mainPipelines = sorted.filter((pipeline) => !isPreprocessorPipeline(pipeline));
        const preprocessors = sorted.filter((pipeline) => isPreprocessorPipeline(pipeline));

        setAvailablePipelines(sorted);
        setSelectedPipeline((current) => {
          const currentExists = mainPipelines.some((pipeline) => pipeline.id === current);
          if (currentExists) return current;
          if (mainPipelines.some((pipeline) => pipeline.id === DEFAULT_PIPELINE)) {
            return DEFAULT_PIPELINE;
          }
          return mainPipelines[0]?.id ?? DEFAULT_PIPELINE;
        });
        setSelectedPreprocessor((current) => {
          if (current === NO_PREPROCESSOR) return current;
          if (preprocessors.some((pipeline) => pipeline.id === current)) {
            return current;
          }
          return NO_PREPROCESSOR;
        });
      } else {
        setDiagnosticsError("Connected to Scope, but no pipeline schemas were returned.");
        setAvailablePipelines([DEFAULT_PIPELINE_DESCRIPTOR]);
        setSelectedPipeline((current) => current || DEFAULT_PIPELINE);
        setSelectedPreprocessor(NO_PREPROCESSOR);
      }
    } catch (error) {
      setDiagnosticsError(
        error instanceof Error ? error.message : "Failed to refresh Scope diagnostics"
      );
    } finally {
      setIsDiagnosticsLoading(false);
    }
  }, [scopeClient, isPreprocessorPipeline]);

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
    const storedPipeline = window.localStorage.getItem("soundscape.pipeline");
    if (storedPipeline) {
      setSelectedPipeline(storedPipeline);
    }
    const storedPreprocessor = window.localStorage.getItem("soundscape.preprocessor");
    if (storedPreprocessor) {
      setSelectedPreprocessor(storedPreprocessor);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("soundscape.pipeline", selectedPipeline);
  }, [selectedPipeline]);

  useEffect(() => {
    window.localStorage.setItem("soundscape.preprocessor", selectedPreprocessor);
  }, [selectedPreprocessor]);

  useEffect(() => {
    if (!scopeStream) {
      setVideoStats({
        width: 0,
        height: 0,
        totalFrames: null,
        droppedFrames: null,
      });
      return;
    }

    const intervalId = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const qualityApiVideo = video as HTMLVideoElement & {
        getVideoPlaybackQuality?: () => {
          totalVideoFrames?: number;
          droppedVideoFrames?: number;
        };
        webkitDecodedFrameCount?: number;
        webkitDroppedFrameCount?: number;
      };

      let totalFrames: number | null = null;
      let droppedFrames: number | null = null;

      if (typeof qualityApiVideo.getVideoPlaybackQuality === "function") {
        const quality = qualityApiVideo.getVideoPlaybackQuality();
        totalFrames = quality.totalVideoFrames ?? null;
        droppedFrames = quality.droppedVideoFrames ?? null;
      } else if (typeof qualityApiVideo.webkitDecodedFrameCount === "number") {
        totalFrames = qualityApiVideo.webkitDecodedFrameCount;
        droppedFrames = qualityApiVideo.webkitDroppedFrameCount ?? 0;
      }

      setVideoStats({
        width: video.videoWidth,
        height: video.videoHeight,
        totalFrames,
        droppedFrames,
      });
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
      prompts: [{ text: basePrompt, weight: 1.0 }],
      noise_scale: currentTheme.ranges.noiseScale.min,
      denoising_step_list: [...DENOISING_STEPS],
      manage_cache: true,
      paused: false,
    };
  }, [currentTheme]);

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
  const canConnect =
    !isConnecting &&
    !isDiagnosticsLoading &&
    scopeHealth?.status === "ok" &&
    !diagnosticsError;
  // Use user-friendly error messages for display
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

  // Disconnect from Scope
  const handleDisconnectScope = useCallback((userInitiated = false) => {
    disconnect(true);
    if (userInitiated) {
      clearError();
    }
    console.log("[Soundscape] Disconnected from Scope", userInitiated ? "(user)" : "(connection lost)");
  }, [clearError, disconnect]);

  // Register disconnect handler with parent for header button
  useEffect(() => {
    if (onRegisterDisconnect) {
      onRegisterDisconnect(() => handleDisconnectScope(true));
    }
  }, [onRegisterDisconnect, handleDisconnectScope]);

  const handleConnectScope = useCallback(async () => {
    clearError();
    await refreshScopeDiagnostics();
    await connect();
  }, [clearError, refreshScopeDiagnostics, connect]);

  const handleResumeVideoPlayback = useCallback(async () => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

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

  return (
    <div className="h-full flex flex-col">
      {/* VIDEO HERO - Takes most of the space with padding for controls */}
      <div className="flex-1 min-h-0 relative bg-black">
        {scopeStream ? (
          /* Video with padding and magical frame - adapts to aspect ratio */
          <div className="absolute inset-0 p-4 pt-14 pb-14 flex items-center justify-center">
            {/* Live scope telemetry */}
            <div className="absolute top-16 left-4 md:left-6 glass bg-black/55 border border-white/15 rounded-xl px-3 py-2 z-20 max-w-[75vw]">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-scope-cyan/80">
                <span className="inline-block w-2 h-2 rounded-full bg-scope-cyan animate-pulse" />
                Stream Live
              </div>
              <div className="mt-1 text-[10px] text-white/70 font-medium truncate">
                Pipeline: <span className="text-white">{activePipelineChain}</span>
              </div>
              <div className="text-[10px] text-white/70 tabular-nums">
                Video:{" "}
                {videoStats.width > 0 && videoStats.height > 0
                  ? `${videoStats.width}×${videoStats.height}`
                  : "waiting for frames"}
              </div>
              {dropPercentage !== null && (
                <div className="text-[10px] text-white/70 tabular-nums">
                  Dropped Frames: {dropPercentage.toFixed(1)}%
                </div>
              )}
            </div>

            {/* Magical fantastical frame - sized to video aspect ratio */}
            <div
              className="relative"
              style={{
                // Use aspect ratio to determine frame size
                // For 16:9: width-constrained on wide screens, height-constrained on tall
                // For 9:16: height-constrained on most screens
                aspectRatio: `${aspectRatio.resolution.width} / ${aspectRatio.resolution.height}`,
                maxWidth: '100%',
                maxHeight: '100%',
                // Ensure frame fills available space while maintaining aspect ratio
                width: aspectRatio.mode === '16:9' ? '100%' : 'auto',
                height: aspectRatio.mode === '9:16' ? '100%' : 'auto',
              }}
            >
              {/* Outer glow layers */}
              <div className="absolute -inset-2 rounded-[2rem] bg-gradient-to-r from-scope-purple/30 via-scope-cyan/20 to-scope-magenta/30 blur-xl opacity-60 animate-pulse" />
              <div className="absolute -inset-1 rounded-[1.75rem] bg-gradient-to-br from-scope-cyan/40 via-transparent to-scope-purple/40 blur-md" />

              {/* Frame border with gradient */}
              <div className="absolute inset-0 rounded-[1.5rem] p-[2px] bg-gradient-to-br from-scope-cyan/60 via-scope-purple/40 to-scope-magenta/60">
                <div className="w-full h-full rounded-[calc(1.5rem-2px)] bg-black/90" />
              </div>

              {/* Video container */}
              <div className="absolute inset-[3px] rounded-[calc(1.5rem-3px)] overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={sharpenEnabled ? {
                    filter: "contrast(1.08) saturate(1.05)",
                    imageRendering: "crisp-edges",
                  } : undefined}
                />
              </div>

              {videoAutoplayBlocked && (
                <button
                  type="button"
                  onClick={() => {
                    void handleResumeVideoPlayback();
                  }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl glass bg-black/65 border border-white/20 text-xs uppercase tracking-wider text-white/85 hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan"
                >
                  Tap to start video
                </button>
              )}
            </div>
          </div>
        ) : isConnecting ? (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Ambient glow background */}
            <div className="glow-bg bg-scope-purple/20 top-1/4 left-1/4" />
            <div className="glow-bg bg-scope-cyan/15 bottom-1/4 right-1/4 animation-delay-2000" />
            <div className="glass-radiant text-center p-8 rounded-3xl max-w-sm">
              {/* Animated Music Notes Icon */}
              <div className="mb-5 animate-float flex justify-center">
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 80 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="drop-shadow-[0_0_16px_rgba(6,182,212,0.5)] animate-pulse"
                  aria-hidden="true"
                >
                  <path d="M28 22V52" stroke="url(#initNoteGradient)" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M52 18V48" stroke="url(#initNoteGradient)" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M28 22L52 18" stroke="url(#initNoteGradient)" strokeWidth="4" strokeLinecap="round" />
                  <path d="M28 28L52 24" stroke="url(#initNoteGradient)" strokeWidth="3" strokeLinecap="round" />
                  <ellipse cx="22" cy="54" rx="7" ry="5" fill="url(#initNoteGradient)" transform="rotate(-20 22 54)" />
                  <ellipse cx="46" cy="50" rx="7" ry="5" fill="url(#initNoteGradient)" transform="rotate(-20 46 50)" />
                  <path d="M64 8L66 14L72 16L66 18L64 24L62 18L56 16L62 14L64 8Z" fill="url(#initSparkle)" opacity="0.9" />
                  <path d="M10 20L11.5 24.5L16 26L11.5 27.5L10 32L8.5 27.5L4 26L8.5 24.5L10 20Z" fill="url(#initSparkle)" opacity="0.8" />
                  <defs>
                    <linearGradient id="initNoteGradient" x1="16" y1="14" x2="56" y2="58" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#06b6d4" /><stop offset="0.5" stopColor="#8b5cf6" /><stop offset="1" stopColor="#ec4899" />
                    </linearGradient>
                    <linearGradient id="initSparkle" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#fcd34d" /><stop offset="1" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h2
                className="text-xl text-white mb-2 tracking-wide"
                style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
              >
                Initializing
              </h2>
              <p className="text-scope-cyan/80 text-sm font-medium mb-4">
                {statusMessage || "Connecting..."}
              </p>
              <div className="w-48 h-1.5 glass bg-white/5 rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-gradient-to-r from-scope-purple via-scope-cyan to-scope-magenta animate-pulse rounded-full w-2/3" />
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Ambient glow background */}
            <div className="glow-bg bg-scope-purple/15 top-1/3 left-1/3" />
            <div className="glow-bg bg-scope-cyan/10 bottom-1/3 right-1/3 animation-delay-2000" />
            <div className="glass-radiant text-center max-w-md px-8 py-10 rounded-3xl">
              {/* Double Music Notes with Sparkles Icon */}
              <div className="mb-6 animate-float flex justify-center">
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 80 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                  aria-hidden="true"
                >
                  {/* Left note stem */}
                  <path
                    d="M28 22V52"
                    stroke="url(#noteGradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  {/* Right note stem */}
                  <path
                    d="M52 18V48"
                    stroke="url(#noteGradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  {/* Connecting beam */}
                  <path
                    d="M28 22L52 18"
                    stroke="url(#noteGradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  {/* Second beam for eighth notes */}
                  <path
                    d="M28 28L52 24"
                    stroke="url(#noteGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Left note head (ellipse) */}
                  <ellipse cx="22" cy="54" rx="7" ry="5" fill="url(#noteGradient)" transform="rotate(-20 22 54)" />
                  {/* Right note head (ellipse) */}
                  <ellipse cx="46" cy="50" rx="7" ry="5" fill="url(#noteGradient)" transform="rotate(-20 46 50)" />

                  {/* Sparkle top-right - larger */}
                  <path
                    d="M64 8L66 14L72 16L66 18L64 24L62 18L56 16L62 14L64 8Z"
                    fill="url(#sparkleGold)"
                    opacity="0.95"
                  />
                  {/* Sparkle top-left - medium */}
                  <path
                    d="M10 20L11.5 24.5L16 26L11.5 27.5L10 32L8.5 27.5L4 26L8.5 24.5L10 20Z"
                    fill="url(#sparkleGold)"
                    opacity="0.85"
                  />
                  {/* Sparkle bottom-right - medium */}
                  <path
                    d="M68 50L69.5 54.5L74 56L69.5 57.5L68 62L66.5 57.5L62 56L66.5 54.5L68 50Z"
                    fill="url(#sparkleGold)"
                    opacity="0.75"
                  />
                  {/* Sparkle bottom-left - smaller */}
                  <path
                    d="M6 62L7 65L10 66L7 67L6 70L5 67L2 66L5 65L6 62Z"
                    fill="url(#sparkleGold)"
                    opacity="0.6"
                  />

                  <defs>
                    <linearGradient id="noteGradient" x1="16" y1="14" x2="56" y2="58" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#06b6d4" />
                      <stop offset="0.5" stopColor="#8b5cf6" />
                      <stop offset="1" stopColor="#ec4899" />
                    </linearGradient>
                    <linearGradient id="sparkleGold" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#fcd34d" />
                      <stop offset="1" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h2
                className="text-2xl text-white mb-3 tracking-wide bg-gradient-to-r from-scope-cyan via-scope-purple to-scope-magenta bg-clip-text text-transparent"
                style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
              >
                Soundscape
              </h2>
              <p className="text-white/50 mb-6 text-sm leading-relaxed">
                Generate real-time AI visuals from your audio with Daydream Scope
              </p>

              {/* Aspect Ratio Selection - must be set before connecting */}
              <div className="mb-6">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Output Format</p>
                <div className="flex justify-center">
                  <AspectRatioToggle
                    current={aspectRatio}
                    onChange={setAspectRatio}
                    disabled={false}
                  />
                </div>
              </div>

              {/* Scope Diagnostics + Pipeline Selection */}
              <div className="mb-6 glass bg-black/35 border border-white/10 rounded-2xl p-4 text-left">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-white/35 uppercase tracking-widest">Scope Readiness</p>
                  <button
                    type="button"
                    onClick={() => {
                      void refreshScopeDiagnostics();
                    }}
                    disabled={isDiagnosticsLoading || isConnecting}
                    className="px-2 py-1 text-[9px] uppercase tracking-widest rounded-lg glass bg-white/8 text-white/60 border border-white/15 hover:bg-white/12 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan"
                  >
                    {isDiagnosticsLoading ? "Checking..." : "Refresh"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                  <span className="text-white/45 uppercase tracking-wide">Server</span>
                  <span className={scopeHealth?.status === "ok" ? "text-scope-cyan font-medium" : "text-red-300 font-medium"}>
                    {scopeHealth?.status === "ok" ? "Online" : "Offline"}
                  </span>
                  <span className="text-white/45 uppercase tracking-wide">Pipeline State</span>
                  <span className="text-white/80">{pipelineStatus?.status ?? "unknown"}</span>
                  <span className="text-white/45 uppercase tracking-wide">Scope Version</span>
                  <span className="text-white/80">{scopeHealth?.version ?? "n/a"}</span>
                </div>

                <div className="mt-3">
                  <label
                    htmlFor="pipeline-select"
                    className="block text-[10px] text-white/45 uppercase tracking-wide mb-1"
                  >
                    Pipeline
                  </label>
                  <select
                    id="pipeline-select"
                    value={selectedPipeline}
                    disabled={isConnecting}
                    onChange={(event) => setSelectedPipeline(event.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {mainPipelineOptions.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id} className="bg-scope-bg">
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                </div>

                {preprocessorOptions.length > 0 && (
                  <div className="mt-3">
                    <label
                      htmlFor="preprocessor-select"
                      className="block text-[10px] text-white/45 uppercase tracking-wide mb-1"
                    >
                      Preprocessor
                    </label>
                    <select
                      id="preprocessor-select"
                      value={selectedPreprocessor}
                      disabled={isConnecting}
                      onChange={(event) => setSelectedPreprocessor(event.target.value)}
                      className="w-full px-3 py-2 rounded-xl glass bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value={NO_PREPROCESSOR} className="bg-scope-bg">
                        None
                      </option>
                      {preprocessorOptions.map((pipeline) => (
                        <option key={pipeline.id} value={pipeline.id} className="bg-scope-bg">
                          {pipeline.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1.5">
                  <p className="text-[10px] text-white/45 uppercase tracking-wide">Selected Pipeline Details</p>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/55">Name</span>
                    <span className="text-white/85">{selectedPipelineDescriptor.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/55">Estimated VRAM</span>
                    <span className="text-white/85">
                      {typeof selectedPipelineDescriptor.estimatedVramGb === "number"
                        ? `${selectedPipelineDescriptor.estimatedVramGb} GB`
                        : "n/a"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/55">Source</span>
                    <span className="text-white/85 capitalize">{selectedPipelineDescriptor.source}</span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {selectedPipelineDescriptor.supportsVace === true && (
                      <span className="rounded-md border border-scope-cyan/40 bg-scope-cyan/10 px-1.5 py-0.5 text-[9px] text-scope-cyan">
                        VACE
                      </span>
                    )}
                    {selectedPipelineDescriptor.supportsLora === true && (
                      <span className="rounded-md border border-scope-purple/40 bg-scope-purple/10 px-1.5 py-0.5 text-[9px] text-scope-purple">
                        LoRA
                      </span>
                    )}
                    {selectedPipelineDescriptor.usage.length > 0 && (
                      <span className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[9px] text-white/70">
                        {selectedPipelineDescriptor.usage.join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                {diagnosticsError && (
                  <p className="mt-2 text-[10px] text-red-300">{diagnosticsError}</p>
                )}
                {lastScopeCheckAt && (
                  <p className="mt-2 text-[10px] text-white/35">
                    Last check: {new Date(lastScopeCheckAt).toLocaleTimeString()}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleConnectScope();
                }}
                disabled={!canConnect}
                className="px-10 py-4 glass bg-scope-cyan/20 hover:bg-scope-cyan/30 text-scope-cyan border border-scope-cyan/40 rounded-2xl text-sm uppercase tracking-[0.15em] transition-all duration-500 hover:scale-105 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
              >
                {isConnecting ? "Connecting..." : `Connect • ${activePipelineChain}`}
              </button>
              {scopeErrorTitle && (
                <div className="mt-6 glass bg-red-500/10 border border-red-500/30 rounded-xl p-4 relative" role="alert">
                  {/* Dismiss button */}
                  <button
                    type="button"
                    onClick={clearError}
                    className="absolute top-2 right-2 p-1 text-red-400/60 hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                    aria-label="Dismiss error"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {/* User-friendly error display */}
                  <p className="text-red-400 font-semibold text-sm pr-6">{scopeErrorTitle}</p>
                  {scopeErrorDescription && (
                    <p className="text-red-400/80 text-xs mt-1">{scopeErrorDescription}</p>
                  )}
                  {scopeErrorSuggestion && (
                    <p className="text-white/50 text-xs mt-2 italic">{scopeErrorSuggestion}</p>
                  )}
                  {reconnectAttempts >= MAX_RECONNECT_ATTEMPTS && (
                    <button
                      type="button"
                      onClick={retry}
                      className="mt-3 text-sm text-scope-cyan hover:underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan rounded"
                    >
                      Retry Connection
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Toggle Controls Button - only shows when controls are hidden */}
        {!showControls && (
          <button
            type="button"
            onClick={handleToggleControls}
            aria-expanded={showControls}
            aria-controls="soundscape-controls"
            className="absolute bottom-3 right-3 px-3 py-1.5 glass bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 text-[9px] font-medium uppercase tracking-wide rounded border border-white/10 hover:border-scope-purple/30 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black"
          >
            Show Controls
          </button>
        )}
      </div>

      {/* COMPACT CONTROLS DOCK - Bottom */}
      {showControls && (
        <div id="soundscape-controls" className="flex-none glass-radiant border-t border-scope-purple/20">
          <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-6">
            {/* Music Source */}
            <div className="flex items-center gap-3 md:min-w-[280px]">
              <h3 className="font-display text-[10px] uppercase tracking-[0.15em] text-scope-cyan/60">Music</h3>
              <AudioPlayer
                onAudioElement={handleAudioElement}
                onPlayStateChange={handlePlayStateChange}
                compact
              />
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-8 bg-white/10" aria-hidden="true" />

            {/* Theme Selector */}
            <div className="flex-1 flex items-center gap-3">
              <h3 className="font-display text-[10px] uppercase tracking-[0.15em] text-scope-cyan/60 whitespace-nowrap">Theme</h3>
              <ThemeSelector
                themes={presetThemes}
                currentTheme={currentTheme}
                onThemeChange={setTheme}
                compact
              />
            </div>

            {/* Divider */}
            <div className="hidden xl:block w-px h-8 bg-white/10" aria-hidden="true" />

            {/* Analysis + active pipeline */}
            <div className="w-full xl:w-auto xl:min-w-[320px] space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/45 uppercase tracking-wide">Active Pipeline</span>
                <span className="text-white/80 font-medium">{activePipelineChain}</span>
              </div>
              <AnalysisMeter
                analysis={soundscapeState.analysis}
                parameters={soundscapeParameters}
                compact
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
