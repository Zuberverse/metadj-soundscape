/**
 * Soundscape Page
 * Audio-reactive AI video generation powered by Daydream Scope
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { SoundscapeStudio } from "@/components/soundscape";

export default function SoundscapePage() {
  const [isConnected, setIsConnected] = useState(false);
  const [sharpenEnabled, setSharpenEnabled] = useState(true);
  const [showControls, setShowControls] = useState(true);

  // Ref to hold disconnect function from SoundscapeStudio
  const disconnectRef = useRef<(() => void) | null>(null);

  // Called by SoundscapeStudio to register its disconnect handler
  const handleRegisterDisconnect = useCallback((disconnectFn: () => void) => {
    disconnectRef.current = disconnectFn;
  }, []);

  // Called by header disconnect button
  const handleDisconnect = useCallback(() => {
    disconnectRef.current?.();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-scope-bg overflow-hidden relative">
      {/* Subtle ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-50">
        <div className="glow-bg bg-scope-cyan/10 top-[-30%] right-[-20%]" />
        <div className="glow-bg bg-scope-purple/10 bottom-[-30%] left-[-20%] animation-delay-2000" />
      </div>

      {/* Header */}
      <header
        className="relative z-50 flex items-center justify-between px-4 md:px-6 h-12 border-b border-white/8 glass"
        role="banner"
      >
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <h1
            className="text-base font-semibold tracking-wide bg-gradient-to-r from-scope-cyan via-scope-purple to-scope-magenta bg-clip-text text-transparent"
            style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
          >
            Soundscape
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
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>

        {/* Right: Action buttons */}
        <nav className="flex items-center gap-1.5" aria-label="Scope controls">
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
    </div>
  );
}
