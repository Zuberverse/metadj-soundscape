import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center px-6">
      <div className="glow-bg bg-scope-purple/15 top-1/4 left-1/4" />
      <div className="glow-bg bg-scope-cyan/10 bottom-1/3 right-1/3 animation-delay-2000" />

      <main className="glass-radiant rounded-[2.5rem] border border-white/10 shadow-2xl p-10 max-w-xl w-full text-center">
        <div className="text-5xl mb-4 font-black tracking-[0.2em] text-white/70">404</div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3">
          Signal Not Found
        </p>
        <h1 className="font-display text-2xl text-white mb-3 chisel-gradient">
          This route is off the map
        </h1>
        <p className="text-white/60 text-sm leading-relaxed mb-6">
          The page you are looking for does not exist. Return to base or launch one of the studios.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 glass bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all duration-300"
          >
            Return Home
          </Link>
          <Link
            href="/soundscape"
            className="px-6 py-3 glass bg-scope-cyan/20 hover:bg-scope-cyan/30 text-scope-cyan border border-scope-cyan/40 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]"
          >
            Open Soundscape
          </Link>
        </div>
      </main>
    </div>
  );
}
