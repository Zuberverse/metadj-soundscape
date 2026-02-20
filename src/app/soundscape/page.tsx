/**
 * Soundscape Page
 * Audio-reactive AI video generation powered by Daydream Scope
 */

"use client";

import { SoundscapeStudio } from "@/components/soundscape";

export default function SoundscapePage() {
  return (
    <div className="min-h-dvh h-dvh flex flex-col bg-scope-bg overflow-hidden relative">
      {/* Subtle ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-50">
        <div className="glow-bg bg-scope-cyan/10 top-[-30%] right-[-20%]" />
        <div className="glow-bg bg-scope-purple/10 bottom-[-30%] left-[-20%] animation-delay-2000" />
      </div>

      <main id="main-content" className="relative z-10 flex-1 min-h-0 flex flex-col">
        <SoundscapeStudio />
      </main>
    </div>
  );
}
