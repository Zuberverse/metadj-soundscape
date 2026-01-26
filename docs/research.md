# Research - MetaDJ Soundscape

**Last Modified**: 2026-01-10 15:37 EST
**Status**: Public Summary

## Purpose
Capture public technical notes and validated findings relevant to MetaDJ Soundscape. Canonical platform docs live in the external references hub.

## Canonical External References

- `1-system/3-docs/external-tools/ai/daydream/daydream-scope.md` — Scope platform reference
- `1-system/3-docs/external-tools/ai/daydream/streamdiffusion.md` — StreamDiffusion reference
- https://docs.daydream.live/scope — Official Scope docs
- https://docs.runpod.io — Official RunPod docs

---

## Project-Specific Findings

### Validated Endpoints (MVP)
- `/health` — Health check
- `/api/v1/pipeline/load` — Pipeline load
- `/api/v1/webrtc/offer` — WebRTC offer flow

### Deployment Notes
- Soundscape uses the Daydream Scope template on RunPod when cloud hosting is needed.
- HF token required for TURN access; capture instance URLs in `docs/tools.md`.

### Pipeline Notes
- `longlive` is preferred for smooth prompt transitions in audio-reactive visuals.
- `streamdiffusionv2` remains a fallback candidate to validate for 16:9 output.

---

## Open Questions (Public)
- Confirm optimal resolution trade-offs for 16:9 demos on target GPUs.
- Validate whether `streamdiffusionv2` supports the same transition behavior.
