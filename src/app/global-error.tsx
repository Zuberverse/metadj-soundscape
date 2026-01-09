"use client";

import Link from "next/link";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Scope] Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center px-6">
        <div className="glow-bg bg-scope-magenta/15 top-1/4 right-1/4" />
        <div className="glow-bg bg-scope-cyan/10 bottom-1/3 left-1/3 animation-delay-2000" />

        <main className="glass-radiant rounded-[2.5rem] border border-white/10 shadow-2xl p-10 max-w-xl w-full text-center">
          <div className="text-4xl mb-4 animate-float text-white/70">!</div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3">
            Core Systems Offline
          </p>
          <h1 className="font-display text-2xl text-white mb-3 chisel-gradient">
            Global exception caught
          </h1>
          <p className="text-white/60 text-sm leading-relaxed mb-6">
            The root layout failed to initialize. Retry the boot sequence or return to base.
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
              className="px-6 py-3 glass bg-scope-magenta/20 hover:bg-scope-magenta/30 text-white border border-scope-magenta/40 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all duration-300 hover:shadow-[0_0_20px_rgba(217,70,239,0.3)]"
            >
              Retry Boot
            </button>
            <Link
              href="/"
              className="px-6 py-3 glass bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all duration-300"
            >
              Return Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
