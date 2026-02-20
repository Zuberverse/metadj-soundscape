# System Architecture - MetaDJ Soundscape

**Last Modified**: 2026-02-20
**Status**: Active

## Purpose

System design reference for Soundscape. This document explains how Soundscape converts audio behavior into real-time visual behavior while preserving continuity—starting from real-time audio analysis in the browser, to parameter mapping, and finally streaming to Daydream Scope over WebRTC.

## Runtime Topology

```text
[Audio Source: Demo Track | Microphone]
  -> [AudioAnalyzer (Meyda ~86Hz)]
  -> [MappingEngine]
  -> [ParameterSender (~30Hz, DataChannel)]
  -> [Scope Pipeline (GPU)]
  -> [Video Track -> Browser]
```

## UI Layout

- `/` redirects to `/soundscape`
- `/soundscape` provides:
  - Connect screen (diagnostics, pipeline selection, generation controls)
  - Full-frame video stage when connected
  - Telemetry overlay (pipeline, resolution, FPS, dropped-frame rate, recording)
  - Bottom dock (audio transport/source, theme selector, analysis meters)

## Audio Sources

### Demo Track
- **Source**: Looped `public/audio/metaversal-odyssey.mp3`
- Provides time/progress controls.
- Serves as a reference track for predictable demos.

### Microphone
- **Source**: Browser permission-gated `getUserMedia` capture.
- Uses audio processing constraints (echo cancellation, noise suppression, AGC).

*Note: Audio transport is centralized in `AudioPlayer` and exposes keyboard-safe control hooks to `SoundscapeStudio`.*

## Signal Processing & Derived Metrics

Soundscape uses Meyda for audio feature extraction.

- **Feature Rates**:
  - Meyda callback: ~86 Hz (`bufferSize: 512`)
  - Scope parameter sends: Target ~30 Hz
  - UI state updates: Target ~10 Hz

- **Derived Metrics**:
  - **Energy**: Normalized RMS (adaptive ceiling)
  - **Brightness**: Normalized spectral centroid
  - **Texture**: Normalized spectral flatness
  - **Energy Derivative**: Frame-to-frame energy change

## Mapping Rules & Continuity Constraints

- Audio energy maps to `noise_scale`.
- Beat detection adds a controlled noise boost.
- Prompt transitions use smooth `slerp` transitions.
- `manage_cache` remains enabled to preserve temporal continuity.

Visual continuity relies on these invariants:
1. Avoid cache-reset behavior for normal operation.
2. Always send prompt transitions instead of abrupt prompt replacement.
3. Prevent overlapping transition windows.
4. Preserve analyzer/source graph integrity across reconnects.

## Transition Behavior & Ambient Mode

- Theme change transition: 6 steps
- Prompt-change transition: 5 steps
- Energy-spike transitions: theme-specific blend durations
- Theme cooldown and energy-spike cooldown prevent transition stacking

**Ambient Mode**:
When playback is paused but Scope remains connected:
- Soundscape sends a single ambient prompt payload with transition.
- Scope latent cache maintains continuity.
- Theme changes still send transition payloads.
- Denoising and prompt accent updates are re-sent immediately while ambient mode is active.

## Auto Theme Timeline

Optional beat-synced rotation:
- Beat events from `soundscapeState.analysis.beat` increment a section counter.
- Theme rotates after N beats (16, 32, or 64).
- Designed for live sets where manual theme switching every section creates too much overhead.
- On section boundary, the theme rotates to the next preset.

## Connection Lifecycle

Primary implementation: `src/lib/scope/use-scope-connection.ts`

### Stages
1. Health check (`/health`)
2. Pipeline prepare (`/api/v1/pipeline/load` + wait for loaded state)
3. WebRTC offer/answer session (VP8 codec forced via `setCodecPreferences`, `recvonly` direction — required for aiortc)
4. ICE candidate exchange (trickle ICE with candidate queuing)
5. Data channel open (`parameters`)
6. First video track received -> connection state becomes `connected`

### Reliability Improvements
- Reconnect attempts with backoff.
- First-video-track watchdog timeout.
- Stale async connect result cancellation.
- Connect overrides supported at call time (`connect({ pipelineIds, pipelineId })`).
- Last successful connect overrides reused on automatic reconnect.
- **Pipeline Selection Safety**: `SoundscapeStudio` refreshes diagnostics before connecting and computes resolved pipeline IDs from the live schema response to avoid stale `localStorage` pipeline mismatches.

## Scope Proxy & Security Safety

Route: `src/app/api/scope/[...path]/route.ts`

- Path allowlist enforcement.
- Strict method/path matrix (`GET/HEAD/POST/PATCH` for approved Scope endpoints only).
- Same-origin validation on write requests.
- In-memory per-method rate limiting.
- Request timeout handling.
- Proxy disabled in production unless `SCOPE_PROXY_ENABLE=true`.

## Media Recording

The connected stream can be captured with `MediaRecorder` (captures the incoming Scope stream, not local canvas replay).
- Supported MIME preference: `video/webm;codecs=vp9` -> `vp8` -> `video/webm`
- Chunk aggregation and clip URL generated from blob exposed via download link.
- Recording is halted on disconnect/unmount.

## Performance Signals & Classification

The HUD overlay computes health from dropped frames and sampled FPS (derived from total frame deltas).

- **Healthy**: dropped frames < 5% and FPS >= 10
- **Warning**: dropped frames >= 5% or FPS < 10
- **Critical**: dropped frames >= 12% or FPS < 7

## Key Files Reference

- `src/components/soundscape/SoundscapeStudio.tsx`
- `src/components/soundscape/AudioPlayer.tsx`
- `src/lib/soundscape/use-soundscape.ts`
- `src/lib/soundscape/audio-analyzer.ts`
- `src/lib/soundscape/mapping-engine.ts`
- `src/lib/scope/use-scope-connection.ts`
- `src/lib/scope/client.ts`
- `src/app/api/scope/[...path]/route.ts`
