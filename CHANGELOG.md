# Changelog

**Last Modified**: 2026-02-10 13:36 EST

All notable changes to MetaDJ Soundscape will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Scope diagnostics panel on the connection screen (health, scope version, pipeline status, last check timestamp, manual refresh).
- Dynamic pipeline selection from live Scope schemas before connect.
- Live stream telemetry overlay (active pipeline, resolution, dropped-frame percentage when available).
- Compact audio analysis meters added directly into the bottom controls dock.
- Scope client regression tests covering pipeline load compatibility fallback and schema parsing.
- Scope connection regression test to ensure the app stays in connecting state until the first video track arrives.
- Audio analyzer regression coverage for source-to-analyzer disconnect during teardown.

### Changed
- Initial WebRTC prompt now includes theme style modifiers for better visual consistency at connect time.
- Public docs trimmed for release readiness (Scope brief sanitized; transition timing examples aligned).
- Scope integration now sends canonical `pipeline_ids` for `/api/v1/pipeline/load` with compatibility fallback to legacy `pipeline_id`.
- Scope pipeline status typing expanded to include `not_loaded`.
- WebRTC ICE candidate send/flush failures now emit warnings instead of failing silently.
- Proxy allowlist expanded for current Scope endpoints (`hardware`, `models`, `assets`, `lora`, `plugins`) with stricter segment-boundary matching.
- Scope and Daydream reference docs refreshed to current verified state (`v0.1.0` stable published 2026-02-09; no stable `v1.0` yet).
- Pipeline preparation no longer runs a duplicate health check before load, reducing connection latency.
- Scope connection now transitions to `connected` only after receiving a video track; connection setup remains in `connecting` while waiting for stream frames.
- Video teardown now explicitly pauses the player and clears `srcObject` when Scope disconnects.
- Audio analyzer teardown now disconnects source-to-analyzer links to avoid Web Audio graph accumulation across reconnects.

## [1.0.0] - 2026-01-08

### Added
- **Audio-reactive AI video generation** powered by Daydream Scope and StreamDiffusion
- **Real-time audio analysis** via Meyda.js (RMS, spectral centroid, energy, ZCR)
- **Beat detection** with energy-based tempo tracking
- **5 preset themes** with audio-reactive parameter mapping:
  - Cosmic Voyage — Neon digital space with energy-responsive noise
  - Neon Foundry — Industrial AI interior with beat-driven noise pulses
  - Digital Forest — Bioluminescent nature/tech hybrid
  - Synthwave Highway — Retro-futuristic driving visuals
  - Crystal Sanctuary — Meditative crystalline environments
- **WebRTC streaming** for low-latency GPU-to-browser video delivery
- **Demo track** ("Metaversal Odyssey", MetaDJ Original) with infinite loop playback
- **Aspect ratio toggle** (16:9 widescreen / 9:16 portrait)
- **AnalysisMeter** showing real-time audio feature values
- **ThemeSelector** with visual theme grid
- **Auto-reconnection** with linear backoff (up to 3 attempts)
- **Enhance mode** (post-processing contrast/saturation boost)
- **Test suite** — Coverage for audio analysis, mapping engine, and connection hooks
- **User-friendly error messages** — Structured error handling with title, description, and recovery suggestions
- **JSDoc documentation** — Comprehensive documentation for core classes and components

### Technical
- Next.js 16 + TypeScript + Tailwind 4
- Meyda audio analysis library
- WebRTC DataChannel for parameter streaming (30Hz)
- Scope API client with typed interfaces
- Mapping engine translating audio features to generation parameters
- 4-step denoising schedule for ~15-20 FPS on 24GB+ GPUs
- Simplified ambient mode (send prompt once; Scope's latent cache maintains coherence)
- Unified 6-frame crossfade for all theme transitions
- Typography: Cinzel (display) + Poppins (body)

### Security
- Authentication handled server-side only (no client-side tokens)
- Proxy disabled by default in production
- Path allowlist for Scope API endpoints

### Hackathon Context
Built for the Daydream 2025 Interactive AI Video Program (Scope Track).
