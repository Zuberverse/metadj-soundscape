# MetaDJ Soundscape - Product Specification

**Last Modified**: 2026-02-20 20:11 ET
**Status**: Active

## Summary

MetaDJ Soundscape is an audio-reactive AI visual generator built on Daydream Scope. It analyzes in-browser audio signals, maps them to generation parameters, and streams those parameters to Scope in real time.

## Core Capabilities

- Demo track playback with infinite loop
- Microphone input mode
- Real-time audio analysis (energy, brightness, texture, beat state)
- 15 Theme presets with audio-reactive parameter mapping
- Prompt accent controls (text + weight)
- Theme-color calibrated prompt system (palette-aligned prompts + reduced global dark bias)
- Denoising, reactivity, and motion-pace profiles
- Advanced runtime tuning controls (live beat boost, spike boost, variation blend, motion bias, noise ceiling)
- Scope diagnostics + pipeline/preprocessor selection
- Connect-screen readiness status simplified to `Online`/`Offline` with manual refresh
- WebRTC streaming from Scope to browser
- Ambient generation mode
- Runtime mode telemetry (`Audio Reactive` vs `Ambient Hold`)
- Clip recording/download from live Scope stream
- Auto theme timeline (beat-section rotation)
- Keyboard shortcuts (`Space`, `1-9`, `F`, `←/→`)
- Live telemetry (resolution, FPS sample, dropped frame ratio, performance status)

## Public Non-Goals (Current)

- Multi-user collaborative sessions
- Multi-track DAW-style mixing inside app
- Full production deployment automation workflows

## Technical Defaults & Constants

- Default pipeline: `longlive`
- Default first-launch format: `16:9` `Low` tier
- Default resolutions:
  - 16:9 -> `576x320`
  - 9:16 -> `320x576`
- Resolution tiers:
  - 16:9 -> `576x320`, `768x432`, `896x512`
  - 9:16 -> `320x576`, `432x768`, `512x896`
- Resolution tier labels: `Low`, `Medium`, `High`
- Current production Scope pod: `xtt2dvnrtew5v1` (`RTX PRO 6000`, `96GB` VRAM)
- Feasible alternative Scope GPU: `RTX 5090` (`32GB` VRAM) for default/lower tiers
- Current production pod capability flags: `ndi_available=false`, `spout_available=false`
- Preprocessor activation rule: preprocessor chain is applied only for NDI/Spout video-input sessions; text mode uses only the selected main pipeline.
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

## Setup and Commands

See `README.md` for run instructions, environment variables, and core setup guidance.
