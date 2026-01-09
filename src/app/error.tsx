"use client";

import Link from "next/link";
import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[Scope] Route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center px-6">
      <div className="glow-bg bg-scope-purple/15 top-1/4 left-1/4" />
      <div className="glow-bg bg-scope-cyan/10 bottom-1/3 right-1/3 animation-delay-2000" />

      <div className="glass-radiant rounded-[2.5rem] border border-white/10 shadow-2xl p-10 max-w-xl w-full text-center">
        <div className="text-4xl mb-4 animate-float text-white/70">!</div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3">
          Signal Interrupted
        </p>
        <h1 className="font-display text-2xl text-white mb-3 chisel-gradient">
          Something drifted off-course
        </h1>
        <p className="text-white/60 text-sm leading-relaxed mb-6">
          Try re-syncing the session. If the issue persists, restart the app or return to the home bay.
        </p>
        {process.env.NODE_ENV === "development" && (
          <div className="text-left text-[11px] text-white/50 bg-black/40 border border-white/10 rounded-2xl p-4 mb-6">
            <p className="text-[10px] break-words">{error.message}</p>
            {error.digest && (
              <p className="text-[10px] text-white/30 mt-2">Digest: {error.digest}</p>
            )}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="px-6 py-3 glass bg-scope-cyan/20 hover:bg-scope-cyan/30 text-scope-cyan border border-scope-cyan/40 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]"
          >
            Retry Sync
          </button>
          <Link
            href="/"
            className="px-6 py-3 glass bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all duration-300"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
