# Scope Technical Overview

**Last Modified**: 2026-02-10 11:51 EST
**Status**: Project Delta

## Purpose
Project-specific technical assumptions for MetaDJ Soundscape. Canonical Scope and StreamDiffusion capabilities live in the external references hub.

## Canonical External References

- `1-system/3-docs/external-tools/ai/daydream/daydream-scope.md` — Scope platform reference
- `1-system/3-docs/external-tools/ai/daydream/streamdiffusion.md` — StreamDiffusion reference

## Current Technical Assumptions

- **Pipeline selection**: Prefer `longlive` for stylized, audio-reactive visuals; revisit alternatives if photorealism becomes a requirement.
- **Input mode**: Text-to-video (no VACE or asset uploads in MVP).
- **Transport**: WebRTC offer flow with data channel parameter updates (see `docs/architecture.md`).
- **API shape**: Use `pipeline_ids` request body for pipeline loading; legacy `pipeline_id` only as compatibility fallback.
- **Upstream baseline**: Scope stable is `v0.1.0` (published 2026-02-09).

## Project-Specific Locations

- Soundscape mechanics: `docs/soundscape-mechanics.md`
- Architecture and data flow: `docs/architecture.md`
- Decision rationale: `docs/strategy.md`
