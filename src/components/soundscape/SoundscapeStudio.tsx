/**
 * Soundscape Studio Component
 * Video-first layout with collapsible controls
 */

"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSoundscape, DEFAULT_ASPECT_RATIO, DENOISING_STEPS } from "@/lib/soundscape";
import type { AspectRatioConfig } from "@/lib/soundscape";
import { getScopeClient, useScopeConnection } from "@/lib/scope";
import { AudioPlayer } from "./AudioPlayer";
import { ThemeSelector } from "./ThemeSelector";
import { AspectRatioToggle } from "./AspectRatioToggle";

// Default pipeline for Soundscape (longlive = stylized, smooth transitions)
const DEFAULT_PIPELINE = "longlive";

// Reconnection configuration
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

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

  // Soundscape hook
  const {
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

  // Handle audio element connection
  const handleAudioElement = useCallback(
    async (element: HTMLAudioElement | null) => {
      if (element) {
        try {
          await connectAudio(element);
          setAudioReady(true);
        } catch (error) {
          console.error("Failed to connect audio:", error);
        }
      } else {
        disconnectAudio();
        setAudioReady(false);
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

  // Connect video stream to element
  useEffect(() => {
    if (videoRef.current && scopeStream) {
      videoRef.current.srcObject = scopeStream;
      videoRef.current.play().catch((err) => {
        console.warn("[Soundscape] Video autoplay blocked:", err.message);
      });
    }
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
    if (DEFAULT_PIPELINE === "longlive") {
      params.vace_enabled = false;
    }
    return params;
  }, [aspectRatio]);

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

  const handleScopeDisconnect = useCallback(() => {
    setScopeStream(null);
    setDataChannel(null);
    stopAmbient();
  }, [setDataChannel, stopAmbient]);

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
    scopeClient: getScopeClient(),
    pipelineId: DEFAULT_PIPELINE,
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
  // Use user-friendly error messages for display
  const scopeErrorTitle = error?.userFriendly?.title ?? null;
  const scopeErrorDescription = error?.userFriendly?.description ?? null;
  const scopeErrorSuggestion = error?.userFriendly?.suggestion ?? null;

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && peerConnection) {
      (window as unknown as { debugPeerConnection: RTCPeerConnection }).debugPeerConnection = peerConnection;
    }
  }, [peerConnection]);

  // Disconnect from Scope
  const handleDisconnectScope = useCallback((userInitiated = false) => {
    stopAmbient();
    setDataChannel(null);
    setScopeStream(null);
    disconnect(true);
    if (userInitiated) {
      clearError();
    }
    console.log("[Soundscape] Disconnected from Scope", userInitiated ? "(user)" : "(connection lost)");
  }, [clearError, disconnect, setDataChannel, stopAmbient]);

  // Register disconnect handler with parent for header button
  useEffect(() => {
    if (onRegisterDisconnect) {
      onRegisterDisconnect(() => handleDisconnectScope(true));
    }
  }, [onRegisterDisconnect, handleDisconnectScope]);

  const handleConnectScope = useCallback(() => {
    clearError();
    connect();
  }, [clearError, connect]);

  return (
    <div className="h-full flex flex-col">
      {/* VIDEO HERO - Takes most of the space with padding for controls */}
      <div className="flex-1 min-h-0 relative bg-black">
        {scopeStream ? (
          /* Video with padding and magical frame - adapts to aspect ratio */
          <div className="absolute inset-0 p-4 pt-14 pb-14 flex items-center justify-center">
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
              <h1
                className="text-2xl text-white mb-3 tracking-wide bg-gradient-to-r from-scope-cyan via-scope-purple to-scope-magenta bg-clip-text text-transparent"
                style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
              >
                Soundscape
              </h1>
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

              <button
                type="button"
                onClick={() => handleConnectScope()}
                className="px-10 py-4 glass bg-scope-cyan/20 hover:bg-scope-cyan/30 text-scope-cyan border border-scope-cyan/40 rounded-2xl text-sm uppercase tracking-[0.15em] transition-all duration-500 hover:scale-105 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
              >
                Connect to Scope
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
          <div className="flex items-center gap-6 px-4 py-3">
            {/* Music Source */}
            <div className="flex items-center gap-3">
              <h3 className="font-display text-[10px] uppercase tracking-[0.15em] text-scope-cyan/60">Music</h3>
              <AudioPlayer
                onAudioElement={handleAudioElement}
                onPlayStateChange={handlePlayStateChange}
                compact
              />
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-white/10" aria-hidden="true" />

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
          </div>
        </div>
      )}
    </div>
  );
}
