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
      {/* Subtle ambient background - less prominent than homepage */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-50">
        <div className="glow-bg bg-scope-cyan/10 top-[-30%] right-[-20%]" />
        <div className="glow-bg bg-scope-purple/10 bottom-[-30%] left-[-20%] animation-delay-2000" />
      </div>

      {/* Header - Minimal but branded */}
      <header className="relative z-50 flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-white/5 glass">
        {/* Left: Branding with gradient */}
        <div className="flex items-center">
          <h1
            className="text-base font-semibold tracking-wide bg-gradient-to-r from-scope-cyan via-scope-purple to-scope-magenta bg-clip-text text-transparent"
            style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
          >
            MetaDJ Soundscape
          </h1>
        </div>

        {/* Right: Controls + Status */}
        <div className="flex items-center gap-2">
          {/* Control buttons - only show when connected */}
          {isConnected && (
            <>
              <button
                type="button"
                onClick={() => setSharpenEnabled(!sharpenEnabled)}
                aria-pressed={sharpenEnabled}
                className={`px-2.5 py-1 text-[9px] font-medium uppercase tracking-wide rounded transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black ${
                  sharpenEnabled
                    ? "glass bg-scope-cyan/20 text-scope-cyan border border-scope-cyan/40"
                    : "glass bg-white/10 text-white/70 border border-white/20 hover:border-white/40"
                }`}
                title="Toggle visual enhancement"
              >
                {sharpenEnabled ? "Enhanced" : "Original"}
              </button>
              <button
                type="button"
                onClick={() => setShowControls(!showControls)}
                className="px-2.5 py-1 glass bg-white/10 text-white/70 text-[9px] font-medium uppercase tracking-wide rounded border border-white/20 hover:border-white/40 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-scope-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-black"
              >
                {showControls ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-2.5 py-1 glass bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] font-medium uppercase tracking-wide rounded border border-red-500/30 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 focus-visible:ring-offset-black"
              >
                Disconnect
              </button>
            </>
          )}

          {/* Connection indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1 glass rounded-full border border-white/10">
            <div className="relative">
              <div
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  isConnected
                    ? "bg-scope-cyan shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                    : "bg-white/30"
                }`}
              />
              {isConnected && (
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-scope-cyan animate-ping opacity-40" />
              )}
            </div>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${
              isConnected ? 'text-scope-cyan' : 'text-white/40'
            }`}>
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content - Full height video experience */}
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
