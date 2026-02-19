# MetaDJ Soundscape - Public Capability Spec

**Last Modified**: 2026-02-18 22:24 EST
**Status**: Active
**Version**: 1.1.0-candidate

## Summary

MetaDJ Soundscape is an audio-reactive AI visual generator built on Daydream Scope. It analyzes in-browser audio signals, maps them to generation parameters, and streams those parameters to Scope in real time.

## Included In Current Build

- Demo track playback with infinite loop
- Microphone input mode
- Real-time audio analysis (energy, brightness, texture, beat state)
- Theme presets with audio-reactive parameter mapping
- Prompt accent controls (text + weight + presets)
- Denoising and reactivity profiles
- Scope diagnostics + pipeline/preprocessor selection
- WebRTC streaming from Scope to browser
- Ambient generation mode
- Clip recording/download from live Scope stream
- Auto theme timeline (beat-section rotation)
- Keyboard shortcuts (`Space`, `1-9`, `F`, `←/→`)
- Live telemetry (resolution, FPS sample, dropped frame ratio, performance status)

## Public Non-Goals (Current)

- Multi-user collaborative sessions
- Multi-track DAW-style mixing inside app
- Full production deployment automation workflows

## Technical Notes (Public)

- Default pipeline: `longlive`
- Default resolutions:
  - 16:9 -> `576x320`
  - 9:16 -> `320x576`
- Parameter send cadence: ~30 Hz
- Analysis cadence: ~86 Hz
- Default denoising schedule: `[1000, 750, 500, 250]`

## Validation Baseline

- Lint: pass
- Type-check: pass
- Test suite: pass
- Production build: pass
- Prod dependency audit: no known vulnerabilities
- Full dependency audit: track dev-tooling advisories in CI/security triage

## Setup

See `README.md` for run instructions, environment variables, and Scope setup guidance.
