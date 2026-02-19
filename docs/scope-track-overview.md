# MetaDJ Soundscape

**Scope Track Project | Daydream Interactive AI Video Program**
**Last Modified**: 2026-02-10 11:51 ET
**Status**: Historical Reference

MetaDJ Soundscape generates AI visuals that respond to music in real-time. Pick a theme, hit play, and watch the visuals evolve as the music plays. The demo track loops infinitely for seamless audio-reactive generation.

## What It Does

- **Browser-based audio analysis** — Extracts musical features directly in the browser
- **Live parameter mapping** — Translates what it hears into Scope generation parameters frame-by-frame
- **Themed visual presets** — Cosmic Voyage, Neon Foundry, Digital Forest, Synthwave Highway, Crystal Sanctuary

## Why This

Every track tells a different story. Soundscape creates a visual journey that adapts to wherever the music goes—building with the build, breathing in the quiet moments, shifting when the energy shifts. The audience experiences something unique each time because the generation responds to what's actually happening in the audio.

## How It Works

Audio analysis runs in the browser and streams to Scope via WebRTC. A high-VRAM GPU handles inference (RunPod or local). The mapping engine does the translation—musical characteristics drive visual parameters, and beat detection triggers dynamic shifts.

---

*Daydream Scope Track Hackathon | December 2024 – January 2025*

Operational docs now live in:
- `docs/scope.md`
- `docs/api-reference.md`
- `1-system/3-docs/external-tools/ai/daydream/daydream-scope.md`
