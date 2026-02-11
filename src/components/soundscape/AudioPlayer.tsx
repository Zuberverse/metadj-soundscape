/**
 * Audio Player Component
 * MVP: Demo track playback only with infinite loop
 * Future: Additional audio sources
 */

"use client";

import { useRef, useState, useCallback, useEffect, type ChangeEvent } from "react";

// Demo track path (in public folder)
const DEMO_TRACK = {
  path: "/audio/metaversal-odyssey.mp3",
  name: "Metaversal Odyssey",
  artist: "MetaDJ",
};

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
}

export function AudioPlayer({
  onAudioElement,
  onPlayStateChange,
  disabled = false,
  compact = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasConnectedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
      await ensureAudioConnected();
      await audioRef.current.play();
      setIsPlaying(true);
      onPlayStateChange(true);
    } catch (error) {
      console.error("[AudioPlayer] Failed to start playback:", error);
      setIsPlaying(false);
      onPlayStateChange(false);
    }
  }, [ensureAudioConnected, onPlayStateChange]);

  const handlePause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
    onPlayStateChange(false);
  }, [onPlayStateChange]);

  const handleRestart = useCallback(async () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    // If not playing, start playback after restart
    if (!isPlaying) {
      try {
        await ensureAudioConnected();
        await audioRef.current.play();
        setIsPlaying(true);
        onPlayStateChange(true);
      } catch (error) {
        console.error("[AudioPlayer] Failed to restart playback:", error);
      }
    }
  }, [isPlaying, ensureAudioConnected, onPlayStateChange]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleSeek = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    },
    []
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    return () => {
      if (hasConnectedRef.current) {
        onAudioElement(null);
        hasConnectedRef.current = false;
      }
    };
  }, [onAudioElement]);

  // Compact mode for dock
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={isPlaying ? handlePause : handlePlay}
          disabled={disabled}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          className={`
            w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-sm transition-all duration-300 border
            focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black
            ${isPlaying
              ? "glass bg-scope-purple/30 text-white border-scope-purple/50 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
              : "glass bg-scope-purple/20 text-white border-scope-purple/40 hover:bg-scope-purple/30"}
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
          onClick={handleRestart}
          disabled={disabled}
          aria-label="Restart track"
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-sm transition-all duration-300 border glass bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 4v6h6" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-white/80 truncate font-medium" style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}>{DEMO_TRACK.name}</p>
          {duration > 0 && (
            <p className="text-[10px] text-white/40 tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</p>
          )}
        </div>

        {/* Hidden audio element with loop */}
        <audio
          ref={audioRef}
          src={DEMO_TRACK.path}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          loop
          preload="metadata"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Track Display */}
      <div className="glass rounded-2xl p-5 border-white/5 relative overflow-hidden group">
        <div className="absolute inset-0 bg-scope-purple/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 bg-gradient-brand rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <p className="font-bold text-white uppercase tracking-tighter text-lg">{DEMO_TRACK.name}</p>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{DEMO_TRACK.artist}</p>
          </div>
          <div className="px-3 py-1.5 glass bg-scope-cyan/10 rounded-lg text-[10px] text-scope-cyan/70 font-bold uppercase tracking-wider">
            ∞ Loop
          </div>
        </div>
      </div>

      {/* Hidden Audio Element with loop */}
      <audio
        ref={audioRef}
        src={DEMO_TRACK.path}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        loop
        preload="metadata"
      />

      {/* Playback Controls */}
      <div className="space-y-6 pt-2">
        {/* Play/Pause Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={disabled}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center text-3xl
              transition-all duration-500 shadow-2xl relative group
              focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-black
              ${disabled
                ? "bg-white/5 text-white/10 cursor-not-allowed"
                : "bg-scope-purple hover:bg-white text-white hover:text-scope-purple hover:shadow-[0_0_40px_rgba(139,92,246,0.4)]"}
              hover:scale-110 active:scale-90
            `}
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            {/* Pulsing ring when active */}
            {isPlaying && (
              <div className="absolute inset-0 rounded-full border-2 border-current animate-ping opacity-20 scale-125" aria-hidden="true" />
            )}
            {isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3 px-2">
          <div className="relative h-2 group">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              disabled={disabled}
              className="peer absolute inset-0 w-full h-full bg-white/5 rounded-full appearance-none cursor-pointer accent-scope-cyan z-20 opacity-0"
              aria-label="Seek audio"
            />
            {/* Visual Progress Track */}
            <div className="absolute inset-0 bg-white/5 rounded-full z-0 overflow-hidden peer-focus-visible:ring-2 peer-focus-visible:ring-scope-cyan/70 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-black">
              <div
                className="h-full bg-gradient-to-r from-scope-purple to-scope-cyan rounded-full transition-all duration-100"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              />
            </div>
            {/* Knob mimic */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg z-10 transition-all duration-100 border-2 border-scope-cyan pointer-events-none group-hover:scale-125 peer-focus-visible:scale-125"
              style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 8px)` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
