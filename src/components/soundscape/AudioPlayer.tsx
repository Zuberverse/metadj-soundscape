/**
 * Audio Player Component
 * Supports demo track playback and live microphone input.
 */

"use client";

import { useRef, useState, useCallback, useEffect, useId, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

// Demo track path (in public folder)
const DEMO_TRACK = {
  path: "/audio/metaversal-odyssey.mp3",
  name: "Metaversal Odyssey",
  artist: "MetaDJ",
};

type AudioSourceMode = "demo" | "mic";
type MicrophoneState = "idle" | "requesting" | "active" | "error";

export interface AudioPlayerControls {
  togglePlayPause: () => Promise<void>;
  restart: () => Promise<void>;
  isPlaying: () => boolean;
  sourceMode: () => AudioSourceMode;
  setVolume: (volume: number) => void;
  getVolume: () => number;
}

/**
 * Props for the AudioPlayer component.
 */
interface AudioPlayerProps {
  /**
   * Callback to receive the audio element reference.
   * Called with the element when audio is ready, null on cleanup.
   */
  onAudioElement: (element: HTMLAudioElement | null) => void;
  /**
   * Callback fired when playback state changes.
   * @param isPlaying - True when audio is playing
   */
  onPlayStateChange: (isPlaying: boolean) => void;
  /** Disable all playback controls (default: false) */
  disabled?: boolean;
  /** Use compact dock layout instead of full player (default: false) */
  compact?: boolean;
  /** Optional registration hook for keyboard transport controls */
  onRegisterControls?: (controls: AudioPlayerControls | null) => void;
  /** Show volume control (default: true in compact mode) */
  showVolume?: boolean;
}

export function AudioPlayer({
  onAudioElement,
  onPlayStateChange,
  disabled = false,
  compact = false,
  onRegisterControls,
  showVolume = true,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasConnectedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  const demoSourceButtonRef = useRef<HTMLButtonElement | null>(null);
  const micSourceButtonRef = useRef<HTMLButtonElement | null>(null);
  const compactVolumeButtonRef = useRef<HTMLButtonElement | null>(null);
  const compactVolumePanelId = useId();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sourceMode, setSourceMode] = useState<AudioSourceMode>("demo");
  const [micState, setMicState] = useState<MicrophoneState>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const stopMicStream = useCallback(() => {
    const stream = micStreamRef.current;
    if (!stream) return;

    stream.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    setMicState("idle");
  }, []);

  const configureDemoSource = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.srcObject = null;
    audio.src = DEMO_TRACK.path;
    audio.loop = true;
    audio.muted = isMuted;
    audio.volume = volume;
    audio.preload = "metadata";
    audio.currentTime = 0;
    setCurrentTime(0);
    setMicError(null);
  }, [isMuted, volume]);

  const ensureMicSource = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) {
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState("error");
      setMicError("Microphone capture is not supported in this browser.");
      return false;
    }

    if (!micStreamRef.current) {
      setMicState("requesting");
      setMicError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        micStreamRef.current = stream;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Microphone permission was denied.";
        setMicState("error");
        setMicError(message);
        return false;
      }
    }

    audio.pause();
    audio.src = "";
    audio.srcObject = micStreamRef.current;
    audio.loop = false;
    audio.muted = true;
    audio.preload = "none";

    setCurrentTime(0);
    setDuration(0);
    setMicState("active");
    return true;
  }, []);

  const ensureAudioConnected = useCallback(async () => {
    if (!audioRef.current || hasConnectedRef.current) {
      return;
    }
    await onAudioElement(audioRef.current);
    hasConnectedRef.current = true;
  }, [onAudioElement]);

  const handlePlay = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      if (sourceMode === "mic") {
        const ready = await ensureMicSource();
        if (!ready) {
          onPlayStateChange(false);
          setIsPlaying(false);
          return;
        }
      } else {
        configureDemoSource();
      }

      await ensureAudioConnected();
      await audioRef.current.play();
      setIsPlaying(true);
      onPlayStateChange(true);
    } catch (error) {
      console.error("[AudioPlayer] Failed to start playback:", error);
      setIsPlaying(false);
      onPlayStateChange(false);
    }
  }, [configureDemoSource, ensureAudioConnected, ensureMicSource, onPlayStateChange, sourceMode]);

  const handlePause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
    onPlayStateChange(false);
  }, [onPlayStateChange]);

  const handleRestart = useCallback(async () => {
    if (!audioRef.current) return;

    if (sourceMode === "demo") {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }

    if (!isPlayingRef.current) {
      await handlePlay();
    }
  }, [handlePlay, sourceMode]);

  const togglePlayPause = useCallback(async () => {
    if (isPlayingRef.current) {
      handlePause();
      return;
    }
    await handlePlay();
  }, [handlePause, handlePlay]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && sourceMode === "demo" && !isDraggingRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, [sourceMode]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current && sourceMode === "demo") {
      setDuration(audioRef.current.duration);
    }
  }, [sourceMode]);

  const handleSeek = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioRef.current && sourceMode === "demo") {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    },
    [sourceMode]
  );

  // Click on progress bar to seek
  const handleProgressBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || !audioRef.current || sourceMode !== "demo" || disabled) {
        return;
      }
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const newTime = clickPosition * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration, sourceMode, disabled]
  );

  const handleSourceChange = useCallback(
    async (mode: AudioSourceMode) => {
      if (mode === sourceMode) return;

      const wasPlaying = isPlayingRef.current;
      handlePause();

      if (mode === "demo") {
        stopMicStream();
        configureDemoSource();
        setSourceMode("demo");
      } else {
        setSourceMode("mic");
        const ready = await ensureMicSource();
        if (!ready) {
          return;
        }
      }

      if (wasPlaying) {
        await handlePlay();
      }
    },
    [configureDemoSource, ensureMicSource, handlePause, handlePlay, sourceMode, stopMicStream]
  );

  const handleSourceSwitcherKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      let nextMode: AudioSourceMode | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextMode = sourceMode === "demo" ? "mic" : "demo";
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextMode = sourceMode === "mic" ? "demo" : "mic";
      } else if (event.key === "Home") {
        nextMode = "demo";
      } else if (event.key === "End") {
        nextMode = "mic";
      }

      if (!nextMode) return;
      event.preventDefault();
      void handleSourceChange(nextMode);
      if (nextMode === "demo") {
        demoSourceButtonRef.current?.focus();
      } else {
        micSourceButtonRef.current?.focus();
      }
    },
    [disabled, handleSourceChange, sourceMode]
  );

  const handleVolumeChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      if (audioRef.current) {
        audioRef.current.volume = newVolume;
      }
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
        if (audioRef.current) {
          audioRef.current.muted = false;
        }
      }
    },
    [isMuted]
  );

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioRef.current.muted = newMuted;
  }, [isMuted]);

  const handleVolumePanelKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setShowVolumeSlider(false);
      compactVolumeButtonRef.current?.focus();
    },
    []
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!onRegisterControls) return;

    onRegisterControls({
      togglePlayPause,
      restart: handleRestart,
      isPlaying: () => isPlayingRef.current,
      sourceMode: () => sourceMode,
      setVolume: (v: number) => {
        setVolume(v);
        if (audioRef.current) {
          audioRef.current.volume = v;
        }
      },
      getVolume: () => volume,
    });

    return () => {
      onRegisterControls(null);
    };
  }, [handleRestart, onRegisterControls, sourceMode, togglePlayPause, volume]);

  useEffect(() => {
    return () => {
      stopMicStream();
      if (hasConnectedRef.current) {
        onAudioElement(null);
        hasConnectedRef.current = false;
      }
    };
  }, [onAudioElement, stopMicStream]);

  useEffect(() => {
    if (micState === "error") {
      retryButtonRef.current?.focus();
    }
  }, [micState]);

  const sourceSwitcher = (
    <div
      className="flex items-center gap-0 rounded-lg border border-white/10 bg-white/[0.03] p-0.5 overflow-hidden flex-shrink-0"
      role="radiogroup"
      aria-label="Audio source"
      onKeyDown={handleSourceSwitcherKeyDown}
    >
      <button
        ref={demoSourceButtonRef}
        type="button"
        role="radio"
        aria-checked={sourceMode === "demo"}
        tabIndex={sourceMode === "demo" ? 0 : -1}
        onClick={() => {
          void handleSourceChange("demo");
        }}
        disabled={disabled}
        className={`px-2 py-1 min-h-[36px] lg:min-h-[44px] text-[9px] lg:text-[10px] font-semibold uppercase tracking-wider rounded-md transition-colors duration-300 ${sourceMode === "demo"
          ? "bg-scope-cyan/20 text-scope-cyan"
          : "text-white/45 hover:text-white/70"
          }`}
      >
        Demo
      </button>
      <button
        ref={micSourceButtonRef}
        type="button"
        role="radio"
        aria-checked={sourceMode === "mic"}
        tabIndex={sourceMode === "mic" ? 0 : -1}
        onClick={() => {
          void handleSourceChange("mic");
        }}
        disabled={disabled}
        className={`px-2 py-1 min-h-[36px] lg:min-h-[44px] text-[9px] lg:text-[10px] font-semibold uppercase tracking-wider rounded-md transition-colors duration-300 ${sourceMode === "mic"
          ? "bg-scope-purple/20 text-scope-purple"
          : "text-white/45 hover:text-white/70"
          }`}
      >
        Mic
      </button>
    </div>
  );

  const volumeControl = (
    <div className="relative">
      <button
        ref={compactVolumeButtonRef}
        type="button"
        onClick={() => setShowVolumeSlider(!showVolumeSlider)}
        onMouseEnter={() => setShowVolumeSlider(true)}
        onFocus={() => setShowVolumeSlider(true)}
        aria-label={showVolumeSlider ? "Hide volume controls" : "Show volume controls"}
        aria-expanded={showVolumeSlider}
        aria-controls={compactVolumePanelId}
        aria-haspopup="dialog"
        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-colors duration-300 border bg-white/5 text-white/60 border-white/15 hover:bg-white/10 hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black"
      >
        {isMuted || volume === 0 ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : volume < 0.5 ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      {showVolumeSlider && (
        <div
          id={compactVolumePanelId}
          role="dialog"
          aria-modal="false"
          aria-label="Volume controls"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 glass bg-black/80 rounded-xl border border-white/10"
          onMouseLeave={() => setShowVolumeSlider(false)}
          onKeyDown={handleVolumePanelKeyDown}
        >
          <button
            type="button"
            onClick={toggleMute}
            className="mb-2 w-full min-h-[44px] rounded-md border border-white/15 bg-white/5 px-2.5 py-2 text-[10px] uppercase tracking-wider text-white/80 hover:bg-white/10 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan"
          >
            {isMuted || volume === 0 ? "Unmute" : "Mute"}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-24 accent-scope-cyan"
            aria-label="Volume"
          />
        </div>
      )}
    </div>
  );

  // Compact mode for dock
  if (compact) {
    return (
      <div className="flex flex-col gap-4 w-full p-2">
        {/* Track Title and Progress Row */}
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-mono tracking-[0.2em] font-bold text-scope-cyan opacity-80 mb-0.5">
                {sourceMode === "demo" ? "Now Playing" : "Capture"}
              </span>
              <p className="font-bold text-white text-sm tracking-wide truncate drop-shadow-sm">
                {sourceMode === "demo" ? DEMO_TRACK.name : "Live Microphone Input"}
              </p>
            </div>
            {sourceMode === "demo" && duration > 0 && (
              <p className="text-xs text-white/50 tabular-nums font-mono font-bold mt-auto self-end">
                <span className="text-white/90">{formatTime(currentTime)}</span> <span className="text-white/20 mx-1">/</span> {formatTime(duration)}
              </p>
            )}
            {sourceMode === "mic" && (
              <div className="flex items-center gap-2 self-end mb-1">
                <div className={`w-2 h-2 rounded-full ${micState === 'active' ? 'bg-scope-purple animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.8)]' : 'bg-amber-400'}`} />
                <p className={`text-[10px] font-mono tracking-[0.2em] font-bold uppercase ${micState === "active" ? "text-scope-purple" :
                  micState === "requesting" ? "text-white/50 animate-pulse" :
                    micState === "error" ? "text-red-400" :
                      "text-white/40"
                  }`} role={micState === "error" ? "alert" : "status"}>
                  {micState === "requesting" ? "Requesting..." :
                    micState === "active" ? "Listening" :
                      micState === "error" && micError ? "Error" :
                        "Ready"}
                </p>
              </div>
            )}
          </div>

          {/* Mini progress bar for compact mode */}
          {sourceMode === "demo" && duration > 0 && (
            <div
              ref={progressBarRef}
              className="relative h-2 rounded-full cursor-pointer group overflow-hidden bg-black/40 border border-white/10 shadow-inner mt-1"
              onClick={handleProgressBarClick}
            >
              <input
                type="range"
                min={0}
                max={duration}
                value={currentTime}
                onChange={handleSeek}
                disabled={disabled}
                className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                aria-label="Seek audio position"
              />
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-scope-purple via-scope-cyan to-scope-cyan rounded-full transition-all duration-[50ms]"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/40 blur-[2px]" />
              </div>
            </div>
          )}
        </div>

        {/* Transport Controls Row */}
        <div className="flex items-center justify-between w-full pt-1">
          {/* Left: Play/Restart/Volume */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={() => {
                void togglePlayPause();
              }}
              disabled={disabled}
              aria-label={isPlaying ? "Pause audio" : "Play audio"}
              className={`
                w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 border focus:outline-none focus:ring-2 focus:ring-scope-cyan group hover:scale-105 shadow-lg
                ${isPlaying
                  ? "bg-gradient-to-br from-scope-purple to-scope-cyan text-white shadow-[0_0_20px_rgba(139,92,246,0.5)] border-transparent"
                  : "glass bg-white/10 text-white border-white/20 hover:bg-white/15"}
                ${disabled ? "opacity-40 cursor-not-allowed" : ""}
              `}
            >
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="drop-shadow-md">
                  <rect x="6" y="4" width="4" height="16" rx="1.5" />
                  <rect x="14" y="4" width="4" height="16" rx="1.5" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="drop-shadow-md translate-x-[2px]">
                  <path d="M7 4.5v15L19.5 12z" />
                </svg>
              )}
            </button>

            {/* Restart */}
            <button
              type="button"
              onClick={() => {
                void handleRestart();
              }}
              disabled={disabled}
              aria-label="Restart track"
              className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-scope-cyan
                ${disabled ? "opacity-40 cursor-not-allowed" : ""}
              `}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>

            {showVolume && <div className="ml-1">{volumeControl}</div>}
          </div>

          {/* Right: Source Switcher */}
          <div>
            {sourceSwitcher}
          </div>
        </div>

        {/* Audio element */}
        <audio
          ref={audioRef}
          src={sourceMode === "demo" ? DEMO_TRACK.path : undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          loop={sourceMode === "demo"}
          preload={sourceMode === "demo" ? "metadata" : "none"}
          muted={sourceMode === "mic" || isMuted}
          playsInline
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-lg mx-auto">
      {/* Demo Track Display */}
      <div className="glass-radiant rounded-3xl p-5 border border-white/10 relative overflow-hidden group shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-scope-purple/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 relative z-10 w-full">
          <div className="w-16 h-16 bg-gradient-to-br from-scope-purple via-scope-purple/80 to-scope-cyan rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[0_0_30px_rgba(139,92,246,0.3)] group-hover:scale-105 transition-transform duration-500">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-lg">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="text-[10px] uppercase tracking-widest text-scope-cyan font-bold opacity-80">Line In</span>
            <p className="font-bold text-white text-base tracking-wide truncate drop-shadow-sm">
              {sourceMode === "demo" ? DEMO_TRACK.name : "Live Microphone Input"}
            </p>
            <p className="text-[11px] font-medium text-white/50 uppercase tracking-widest mt-0.5">
              {sourceMode === "demo" ? DEMO_TRACK.artist : "Local Capture Device"}
            </p>
          </div>
          <div className="mt-3 sm:mt-0 self-start sm:self-auto">
            {sourceSwitcher}
          </div>
        </div>
      </div>

      {/* Audio Element */}
      <audio
        ref={audioRef}
        src={sourceMode === "demo" ? DEMO_TRACK.path : undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        loop={sourceMode === "demo"}
        preload={sourceMode === "demo" ? "metadata" : "none"}
        muted={sourceMode === "mic" || isMuted}
        playsInline
      />

      {/* Playback Controls */}
      <div className="space-y-6 pt-2">
        {sourceMode === "demo" ? (
          <div className="space-y-3 px-2">
            <div
              ref={progressBarRef}
              className="relative h-2.5 group cursor-pointer bg-black/50 border border-white/10 rounded-full overflow-visible shadow-inner"
              onClick={handleProgressBarClick}
            >
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                disabled={disabled}
                className="peer absolute inset-0 w-full h-full bg-transparent rounded-full appearance-none cursor-pointer z-20 opacity-0"
                aria-label="Seek audio position"
              />
              <div className="absolute inset-0 rounded-full z-0 overflow-hidden peer-focus-visible:ring-2 peer-focus-visible:ring-scope-cyan peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black">
                <div
                  className="h-full bg-gradient-to-r from-scope-purple via-scope-purple to-scope-cyan rounded-full transition-all duration-[50ms]"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                >
                  <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/30 blur-[4px]" />
                </div>
              </div>
              <div
                className="absolute top-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)] z-10 transition-all duration-[50ms] border-[3px] border-scope-cyan pointer-events-none opacity-0 group-hover:opacity-100 peer-focus-visible:opacity-100 scale-90 group-hover:scale-100"
                style={{
                  left: `calc(${(currentTime / (duration || 1)) * 100}% - 8px)`,
                  transform: "translateY(-50%)",
                }}
                aria-hidden="true"
              />
            </div>
            <div className="flex justify-between text-[11px] font-bold font-mono tracking-widest text-white/50">
              <span className="text-white/80">{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        ) : (
          <div className="glass-radiant p-4 rounded-2xl border border-white/5 flex items-start gap-4 mx-2">
            <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${micState === 'active' ? 'bg-scope-purple shadow-[0_0_12px_rgba(139,92,246,0.8)] animate-pulse' : micState === 'error' ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]' : 'bg-amber-400'}`} />
            <div className="flex-1">
              <p className={`text-xs uppercase tracking-widest font-bold ${micState === "requesting" ? "text-white/50 animate-pulse" :
                micState === "active" ? "text-scope-purple" :
                  micState === 'error' ? "text-red-400" :
                    "text-white/40"
                }`} role="status" aria-live="polite">
                {micState === "requesting" ? "Requesting access..." :
                  micState === "active" ? "Active stream" :
                    micState === "error" ? "Connection Event" :
                      "Standby"}
              </p>
              {micError && (
                <div className="mt-2 text-[11px] text-white/60 leading-relaxed max-w-sm">
                  {micError.includes("Permission") || micError.includes("denied")
                    ? "Microphone access denied. Check your browser permissions and retry."
                    : micError.includes("not supported")
                      ? "Microphone not supported in this browser environment."
                      : micError}
                  <button
                    ref={retryButtonRef}
                    type="button"
                    onClick={() => void handleSourceChange("mic")}
                    className="mt-3 block text-xs uppercase tracking-widest font-bold text-scope-cyan hover:text-white transition-colors focus:outline-none"
                  >
                    Retry Connection
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Primary Controls Row */}
        <div className="flex items-center justify-between pt-4 px-2">
          {/* Main Play Button */}
          <button
            type="button"
            onClick={() => {
              void togglePlayPause();
            }}
            disabled={disabled}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center text-2xl
              transition-all duration-300 relative group
              focus:outline-none focus:ring-4 focus:ring-scope-cyan/30
              ${disabled
                ? "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                : isPlaying
                  ? "bg-gradient-to-br from-scope-purple to-scope-cyan text-white shadow-[0_0_30px_rgba(139,92,246,0.6)] scale-105"
                  : "glass bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 hover:border-white/20"}
            `}
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            {isPlaying && (
              <div
                className="absolute inset-0 rounded-full border border-white/40 animate-ping opacity-20"
                aria-hidden="true"
              />
            )}
            {isPlaying ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-lg" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-lg translate-x-[2px]" aria-hidden="true">
                <path d="M7 4.5v15L19.5 12z" />
              </svg>
            )}
          </button>

          {/* Volume Control for full mode */}
          {showVolume && (
            <div className="flex items-center gap-4 glass bg-black/40 border border-white/5 rounded-2xl px-5 py-3 flex-1 max-w-[240px]">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors focus:outline-none"
              >
                {isMuted || volume === 0 ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : volume < 0.5 ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>
              <div className="flex-1 relative flex items-center group/vol">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-full absolute inset-0 opacity-0 cursor-pointer z-10"
                  aria-label="Volume"
                />
                <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-scope-cyan rounded-full transition-all duration-75 shadow-[0_0_10px_rgba(6,182,212,0.5)] group-hover/vol:bg-white"
                    style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
