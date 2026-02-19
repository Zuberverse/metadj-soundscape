# Architecture - MetaDJ Soundscape

**Last Modified**: 2026-02-18 10:19 ET
**Status**: Active

## Purpose

System design reference for Soundscape: real-time audio analysis in the browser, mapped to Scope generation parameters, streamed over WebRTC.

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

- **Demo Track**: looped `public/audio/metaversal-odyssey.mp3`
- **Microphone**: `getUserMedia` capture routed through the same analysis/mapping path

Audio transport is centralized in `AudioPlayer` and exposes keyboard-safe control hooks to `SoundscapeStudio`.

## Connection Lifecycle

Primary implementation: `src/lib/scope/use-scope-connection.ts`

### Stages

1. Health check (`/health`)
2. Pipeline prepare (`/api/v1/pipeline/load` + wait for loaded state)
3. WebRTC offer/answer session
4. ICE candidate exchange
5. Data channel open (`parameters`)
6. First video track received -> connection state becomes `connected`

### Reliability Improvements

- Reconnect attempts with backoff
- First-video-track watchdog timeout
- Stale async connect result cancellation
- Connect overrides supported at call time (`connect({ pipelineIds, pipelineId })`)
- Last successful connect overrides reused on automatic reconnect

## Pipeline Selection Safety

`SoundscapeStudio` refreshes diagnostics before connect and computes resolved pipeline IDs from live schema response. Connect is executed with those resolved IDs to avoid stale localStorage pipeline mismatches.

## Scope Proxy

Route: `src/app/api/scope/[...path]/route.ts`

- Path allowlist enforcement
- Strict method/path matrix (`GET/HEAD/POST/PATCH` for approved Scope endpoints only)
- Same-origin validation on write requests
- In-memory per-method rate limiting
- Request timeout handling
- Proxy disabled in production unless `SCOPE_PROXY_ENABLE=true`

## Media Recording

Connected stream can be captured with `MediaRecorder`.

- Supported mime preference: `video/webm;codecs=vp9` -> `vp8` -> `video/webm`
- Clip URL generated from blob and exposed via download link
- Recording is stopped on disconnect/unmount

## Auto Theme Timeline

Optional beat-driven theme progression:

- Beat events from `soundscapeState.analysis.beat`
- Section lengths: 16, 32, or 64 beats
- On section boundary, theme rotates to next preset

## Performance Signals

Overlay computes:

- Resolution (`videoWidth` x `videoHeight`)
- FPS sample (derived from total frame deltas)
- Dropped frame percentage
- Performance state labels:
  - Healthy
  - Warning
  - Critical

## Key Files

- `src/components/soundscape/SoundscapeStudio.tsx`
- `src/components/soundscape/AudioPlayer.tsx`
- `src/lib/soundscape/use-soundscape.ts`
- `src/lib/soundscape/audio-analyzer.ts`
- `src/lib/soundscape/mapping-engine.ts`
- `src/lib/scope/use-scope-connection.ts`
- `src/lib/scope/client.ts`
- `src/app/api/scope/[...path]/route.ts`
