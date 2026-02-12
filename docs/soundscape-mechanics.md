# Soundscape Technical Mechanics

**Last Modified**: 2026-02-12 09:23 EST
**Status**: Active

## Purpose

This document explains how Soundscape converts audio behavior into real-time visual behavior while preserving continuity.

## Signal Pipeline

```text
Audio Element (Demo or Mic)
  -> Meyda feature extraction
  -> Derived metrics (energy, brightness, texture, derivative)
  -> Beat detection
  -> Theme mapping engine
  -> Rate-limited Scope parameter sender
  -> Scope generation + video stream return
```

## Feature Rates

- Meyda callback: ~86 Hz (`bufferSize: 512`)
- Scope parameter sends: target ~30 Hz
- UI state updates: target ~10 Hz

## Derived Metrics

- **Energy**: normalized RMS (adaptive ceiling)
- **Brightness**: normalized spectral centroid
- **Texture**: normalized spectral flatness
- **Energy Derivative**: frame-to-frame energy change

## Mapping Rules

- Audio energy maps to `noise_scale`
- Beat detection adds controlled noise boost
- Prompt transitions use smooth `slerp` transitions
- `manage_cache` remains enabled to preserve temporal continuity

## Transition Behavior

- Theme change transition: 6 steps
- Prompt-change transition: 5 steps
- Energy-spike transitions: theme-specific blend durations
- Theme cooldown and energy-spike cooldown prevent transition stacking

## Ambient Mode

When playback is paused but Scope remains connected:

- Soundscape sends a single ambient prompt payload with transition
- Scope latent cache maintains continuity
- Theme changes still send transition payloads

## Audio Sources

### Demo Track

- Looping reference track for predictable demos
- Provides time/progress controls

### Microphone

- Browser permission-gated (`getUserMedia`)
- Uses audio processing constraints (echo cancellation/noise suppression/AGC)
- Routed through the same analyzer + mapping path

## Recording Mechanics

Recording captures the incoming Scope stream (not local canvas replay):

- `MediaRecorder` on active Scope `MediaStream`
- MIME fallback chain: `vp9` -> `vp8` -> `webm`
- Chunk aggregation and download URL generation on stop
- Recording halts on disconnect/unmount

## Auto Theme Timeline

Optional beat-synced rotation:

- Beat events increment section counter
- Theme rotates after N beats (16/32/64)
- Designed for live sets where a manual theme switch every section is too much overhead

## Performance Classification

HUD derives health from dropped frames and sampled FPS.

- **Healthy**: low dropped-frame ratio and acceptable FPS
- **Watch**: moderate frame loss or low FPS
- **Critical**: high frame loss or severe FPS drop

## Continuity Constraints

Visual continuity relies on these invariants:

1. Avoid cache-reset behavior for normal operation
2. Always send prompt transitions instead of abrupt prompt replacement
3. Prevent overlapping transition windows
4. Preserve analyzer/source graph integrity across reconnects

## Practical Tuning Knobs

- Denoising profile: `speed` / `balanced` / `quality`
- Reactivity profile: `cinematic` / `balanced` / `kinetic`
- Prompt accent text + weight
- Pipeline + optional preprocessor chain
- Auto theme toggle + section beat length
