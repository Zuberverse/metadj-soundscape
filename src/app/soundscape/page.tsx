/**
 * Soundscape Page
 * Audio-reactive AI video generation powered by Daydream Scope
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SoundscapeStudio } from "@/components/soundscape";

export default function SoundscapePage() {
  const [isConnected, setIsConnected] = useState(false);
  const [sharpenEnabled, setSharpenEnabled] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Ref to hold disconnect function from SoundscapeStudio
  const disconnectRef = useRef<(() => void) | null>(null);
  const helpDialogRef = useRef<HTMLDivElement | null>(null);
  const helpCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Called by SoundscapeStudio to register its disconnect handler
  const handleRegisterDisconnect = useCallback((disconnectFn: () => void) => {
    disconnectRef.current = disconnectFn;
  }, []);

  // Called by header disconnect button
  const handleDisconnect = useCallback(() => {
    disconnectRef.current?.();
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
  }, []);

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Lock body scroll on mount
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    if (!showHelp) {
      return;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    helpCloseButtonRef.current?.focus();

    const handleModalKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHelp();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = helpDialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || !dialog.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleModalKeydown);
    return () => {
      document.removeEventListener("keydown", handleModalKeydown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [closeHelp, showHelp]);

  return (
    <div className="h-screen flex flex-col bg-scope-bg overflow-hidden relative">
      {/* Subtle ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-50">
        <div className="glow-bg bg-scope-cyan/10 top-[-30%] right-[-20%]" />
        <div className="glow-bg bg-scope-purple/10 bottom-[-30%] left-[-20%] animation-delay-2000" />
      </div>

      {/* Header */}
      <header
        className="relative z-50 flex items-center justify-between px-4 md:px-6 h-14 border-b border-white/8 glass"
        role="banner"
      >
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <h1 className="flex items-baseline gap-1.5">
            <span
              className="text-base font-medium tracking-wide text-white/70"
              style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
            >
              MetaDJ
            </span>
            <span
              className="text-lg font-semibold tracking-wide bg-gradient-to-r from-scope-cyan via-scope-purple to-scope-magenta bg-clip-text text-transparent"
              style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
            >
              Soundscape
            </span>
          </h1>
          {/* Connection status badge - always visible */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors duration-500 ${
              isConnected
                ? "bg-scope-cyan/10 border-scope-cyan/30"
                : "bg-white/5 border-white/10"
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="relative flex items-center justify-center">
              <div
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  isConnected
                    ? "bg-scope-cyan shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                    : "bg-white/30"
                }`}
              />
              {isConnected && (
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-scope-cyan animate-ping opacity-30" />
              )}
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider leading-none ${
              isConnected ? 'text-scope-cyan' : 'text-white/40'
            }`}>
              {isConnected ? "Live" : "Standby"}
            </span>
          </div>
        </div>

        {/* Right: Action buttons */}
        <nav className="flex items-center gap-2" aria-label="Scope controls">
          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-pressed={isFullscreen}
            className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 bg-white/5 text-white/60 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-white/15 hover:bg-white/10 hover:text-white/80 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-scope-bg"
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>

          {/* Help button - always visible */}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="Show keyboard shortcuts"
            className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 bg-white/5 text-white/60 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-white/15 hover:bg-white/10 hover:text-white/80 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-scope-bg"
          >
            ?
          </button>

          {isConnected && (
            <>
              {/* Visual enhancement toggle */}
              <button
                type="button"
                onClick={() => setSharpenEnabled(!sharpenEnabled)}
                aria-pressed={sharpenEnabled}
                aria-label={sharpenEnabled ? "Disable visual enhancement" : "Enable visual enhancement"}
                className={`min-h-[36px] min-w-[36px] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-scope-bg ${
                  sharpenEnabled
                    ? "bg-scope-cyan/15 text-scope-cyan border border-scope-cyan/30"
                    : "bg-white/5 text-white/60 border border-white/15 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {sharpenEnabled ? "Enhanced" : "Original"}
              </button>

              {/* Controls visibility toggle */}
              <button
                type="button"
                onClick={() => setShowControls(!showControls)}
                aria-pressed={showControls}
                aria-label={showControls ? "Hide controls panel" : "Show controls panel"}
                className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 bg-white/5 text-white/60 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-white/15 hover:bg-white/10 hover:text-white/80 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-scope-bg"
              >
                {showControls ? "Hide" : "Show"}
              </button>

              {/* Separator */}
              <div className="w-px h-5 bg-white/10 mx-0.5" aria-hidden="true" />

              {/* Disconnect */}
              <button
                type="button"
                onClick={handleDisconnect}
                aria-label="Disconnect from Scope server"
                className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-red-500/25 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 focus-visible:ring-offset-scope-bg"
              >
                Disconnect
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main id="main-content" className="relative z-10 flex-1 min-h-0">
        <SoundscapeStudio
          onConnectionChange={setIsConnected}
          sharpenEnabled={sharpenEnabled}
          showControls={showControls}
          onControlsToggle={() => setShowControls(!showControls)}
          onRegisterDisconnect={handleRegisterDisconnect}
        />
      </main>

      {/* Help Modal */}
      {showHelp && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closeHelp}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-title"
        >
          <div 
            ref={helpDialogRef}
            tabIndex={-1}
            className="glass-radiant rounded-2xl p-6 max-w-md w-full animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 
                id="help-title"
                className="text-lg text-white tracking-wide" 
                style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
              >
                Keyboard Shortcuts
              </h2>
              <button
                ref={helpCloseButtonRef}
                type="button"
                onClick={closeHelp}
                aria-label="Close help"
                className="p-1.5 text-white/40 hover:text-white/70 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/8">
                <span className="text-sm text-white/70">Play / Pause</span>
                <kbd className="px-2 py-1 bg-white/10 rounded text-white/80 font-mono text-xs">Space</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/8">
                <span className="text-sm text-white/70">Theme preset 1-9</span>
                <kbd className="px-2 py-1 bg-white/10 rounded text-white/80 font-mono text-xs">1 - 9</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/8">
                <span className="text-sm text-white/70">Fullscreen toggle</span>
                <kbd className="px-2 py-1 bg-white/10 rounded text-white/80 font-mono text-xs">F</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-white/70">Navigate themes</span>
                <span className="flex gap-1">
                  <kbd className="px-2 py-1 bg-white/10 rounded text-white/80 font-mono text-xs">←</kbd>
                  <kbd className="px-2 py-1 bg-white/10 rounded text-white/80 font-mono text-xs">→</kbd>
                </span>
              </div>
            </div>
            
            <p className="mt-5 text-[11px] text-white/40 leading-relaxed">
              Audio analysis and theme switching work locally. Connect to a Scope server to stream AI-generated visuals.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
