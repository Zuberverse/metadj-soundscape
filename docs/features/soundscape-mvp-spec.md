# MetaDJ Soundscape - MVP Summary

**Last Modified**: 2026-01-08 22:01 EST
**Status**: Public Summary
**Version**: 1.0.0

---

## Summary
MetaDJ Soundscape is an audio-reactive AI visual generator built on Daydream Scope. It analyzes a demo track in the browser and streams real-time parameters to a Scope server, producing synchronized visuals that respond to music.

## Included in the MVP
- Demo track playback with infinite loop.
- Real-time audio analysis (energy, brightness, texture, beats).
- Theme presets with audio-reactive mapping.
- Custom theme prompt input (lightweight UI).
- WebRTC streaming from Scope to browser.
- Aspect ratio toggle (16:9 and 9:16).
- Ambient mode when audio is paused.

## Not Included (Public)
- File upload or microphone input.
- Multi-track mixing or collaborative sessions.
- Production deployment automation.

## Technical Notes (Public)
- Pipeline: `longlive` (recommended for smooth transitions).
- Resolutions: 576x320 (landscape) and 320x576 (portrait), divisible by 64.
- Parameter updates: 30 Hz via WebRTC data channel.
- Denoising steps: 4-step schedule `[1000, 750, 500, 250]`.

## Setup
See `README.md` for local setup and Scope server configuration.
