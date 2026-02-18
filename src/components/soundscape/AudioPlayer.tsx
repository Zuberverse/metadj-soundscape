/**
 * Audio Player Component
 * Supports demo track playback and live microphone input.
 */

"use client";

import { useRef, useState, useCallback, useEffect, type ChangeEvent } from "react";

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
      className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5"
      role="radiogroup"
      aria-label="Audio source"
    >
      <button
        type="button"
        role="radio"
        aria-checked={sourceMode === "demo"}
        onClick={() => {
          void handleSourceChange("demo");
        }}
        disabled={disabled}
        className={`px-2.5 py-1.5 min-h-[32px] text-[10px] font-semibold uppercase tracking-wider rounded-md transition-colors duration-300 ${
          sourceMode === "demo"
            ? "bg-scope-cyan/20 text-scope-cyan"
            : "text-white/45 hover:text-white/70"
        }`}
      >
        Demo
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={sourceMode === "mic"}
        onClick={() => {
          void handleSourceChange("mic");
        }}
        disabled={disabled}
        className={`px-2.5 py-1.5 min-h-[32px] text-[10px] font-semibold uppercase tracking-wider rounded-md transition-colors duration-300 ${
          sourceMode === "mic"
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
        type="button"
        onClick={() => setShowVolumeSlider(!showVolumeSlider)}
        onMouseEnter={() => setShowVolumeSlider(true)}
        aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
        className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition-colors duration-300 border bg-white/5 text-white/60 border-white/15 hover:bg-white/10 hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black"
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
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 glass bg-black/80 rounded-xl border border-white/10"
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
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
      <div className="flex items-center gap-2">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={() => {
            void togglePlayPause();
          }}
          disabled={disabled}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          className={`
            w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition-colors duration-300 border
            focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black
            ${isPlaying
              ? "bg-scope-purple/25 text-white border-scope-purple/40 shadow-[0_0_10px_rgba(139,92,246,0.25)]"
              : "bg-scope-purple/15 text-white/90 border-scope-purple/30 hover:bg-scope-purple/25"}
            ${disabled ? "opacity-40 cursor-not-allowed" : ""}
          `}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
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
            w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition-colors duration-300 border
            bg-white/5 text-white/60 border-white/15 hover:bg-white/10 hover:text-white/80
            focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black
            ${disabled ? "opacity-40 cursor-not-allowed" : ""}
          `}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 4v6h6" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>

        {/* Track info with integrated progress bar */}
        <div className="flex-1 min-w-0 px-1">
          <div className="flex items-center justify-between mb-1">
            <p
              className="text-[11px] text-white/85 truncate font-medium"
              style={{ fontFamily: "var(--font-cinzel), Cinzel, serif" }}
            >
              {sourceMode === "demo" ? DEMO_TRACK.name : "Live Microphone"}
            </p>
            {sourceMode === "demo" && duration > 0 && (
              <p className="text-[10px] text-white/50 tabular-nums font-medium ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </p>
            )}
          </div>
          
          {/* Mini progress bar for compact mode */}
          {sourceMode === "demo" && duration > 0 && (
            <div 
              ref={progressBarRef}
              className="relative h-1 bg-white/10 rounded-full cursor-pointer group"
              onClick={handleProgressBarClick}
            >
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-scope-purple to-scope-cyan rounded-full transition-all duration-100"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration}
                value={currentTime}
                onChange={handleSeek}
                disabled={disabled}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Seek audio position"
              />
            </div>
          )}
          
          {sourceMode === "mic" && (
            <div className="flex items-center gap-2">
              <p className={`text-[10px] font-medium ${
                micState === "active" ? "text-scope-purple/70" :
                micState === "requesting" ? "text-white/45 animate-status-pulse" :
                micState === "error" ? "text-amber-300/80" :
                "text-white/35"
              }`} role={micState === "error" ? "alert" : "status"} aria-live={micState === "error" ? "assertive" : "polite"}>
                {micState === "requesting" ? "Requesting permission..." :
                 micState === "active" ? "Listening" :
                 micState === "error" && micError ? micError :
                 "Microphone ready"}
              </p>
              {micState === "error" && (
                <button
                  ref={retryButtonRef}
                  type="button"
                  aria-label="Retry microphone access"
                  onClick={() => void handleSourceChange("mic")}
                  className="text-[9px] uppercase tracking-wider font-semibold text-scope-cyan hover:text-scope-cyan/80 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan rounded px-1"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        {sourceSwitcher}
        
        {showVolume && volumeControl}

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
    <div className="space-y-5">
      {/* Demo Track Display */}
      <div className="glass rounded-xl p-4 border-white/8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-scope-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-scope-purple to-scope-cyan rounded-xl flex items-center justify-center flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <p className="font-semibold text-white text-sm tracking-tight truncate">
              {sourceMode === "demo" ? DEMO_TRACK.name : "Live Microphone Input"}
            </p>
            <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
              {sourceMode === "demo" ? DEMO_TRACK.artist : "Capture"}
            </p>
          </div>
          {sourceSwitcher}
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
      <div className="space-y-4">
        {/* Play/Pause Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              void togglePlayPause();
            }}
            disabled={disabled}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center text-2xl
              transition-colors duration-300 relative
              focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black
              ${disabled
                ? "bg-white/5 text-white/10 cursor-not-allowed"
                : isPlaying
                  ? "bg-scope-purple text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                  : "bg-scope-purple/80 hover:bg-scope-purple text-white"}
            `}
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            {/* Pulsing ring when active - opacity only */}
            {isPlaying && (
              <div
                className="absolute inset-0 rounded-full border-2 border-scope-purple animate-ping opacity-15"
                aria-hidden="true"
              />
            )}
            {isPlaying ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {sourceMode === "demo" ? (
          <div className="space-y-2 px-1">
            <div 
              ref={progressBarRef}
              className="relative h-2 group cursor-pointer"
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
              <div className="absolute inset-0 bg-white/5 rounded-full z-0 overflow-hidden peer-focus-visible:ring-2 peer-focus-visible:ring-scope-cyan/70 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-black">
                <div
                  className="h-full bg-gradient-to-r from-scope-purple to-scope-cyan rounded-full transition-all duration-100"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
              </div>
              <div
                className="absolute top-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md z-10 transition-all duration-100 border-2 border-scope-cyan pointer-events-none opacity-0 group-hover:opacity-100 peer-focus-visible:opacity-100"
                style={{
                  left: `calc(${(currentTime / (duration || 1)) * 100}% - 7px)`,
                  transform: "translateY(-50%)",
                }}
                aria-hidden="true"
              />
            </div>
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-white/40">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 px-1">
            <p className={`text-[10px] uppercase tracking-widest font-medium ${
              micState === "requesting" ? "text-white/45 animate-status-pulse" :
              micState === "active" ? "text-scope-purple/70" :
              "text-white/35"
            }`} role="status" aria-live="polite">
              {micState === "requesting" ? "Requesting microphone permission..." :
               micState === "active" ? "Live microphone analysis active" :
               "Microphone ready"}
            </p>
            {micError && (
              <div className="flex items-center gap-2" role="alert" aria-live="assertive">
                <p className="text-[10px] text-amber-300/80 font-medium">
                  {micError.includes("Permission") || micError.includes("denied")
                    ? "Microphone access denied. Check browser permissions and try again."
                    : micError.includes("not supported")
                    ? "Microphone not supported in this browser. Try Chrome or Edge."
                    : micError}
                </p>
                <button
                  ref={retryButtonRef}
                  type="button"
                  aria-label="Retry microphone access"
                  onClick={() => void handleSourceChange("mic")}
                  className="text-[9px] uppercase tracking-wider font-semibold text-scope-cyan hover:text-scope-cyan/80 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan rounded px-1"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Volume Control for full mode */}
        {showVolume && (
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white/80 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : volume < 0.5 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="flex-1 accent-scope-cyan"
              aria-label="Volume"
            />
            <span className="text-[10px] text-white/40 w-8 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
