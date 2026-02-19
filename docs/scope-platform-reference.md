# Daydream Scope Platform Reference

**Last Modified**: 2026-02-10 11:51 ET
**Status**: Project Delta

## Purpose
Project-specific notes for Daydream Scope in MetaDJ Soundscape. Canonical platform documentation lives in the external references hub and official sources.

## Canonical External References

- `1-system/3-docs/external-tools/ai/daydream/daydream-scope.md` — External reference hub
- https://docs.daydream.live/scope — Official Scope docs
- https://github.com/daydreamlive/scope — Source repository

## Project-Specific Notes

- Soundscape streams audio-reactive parameters over WebRTC data channels (see `docs/soundscape-mechanics.md`).
- Pipeline selection and constraints live in `docs/strategy.md` and `docs/scope-technical.md`.
- Current docs alignment: load requests use `pipeline_ids`; ICE patch uses `candidates` arrays.

## Delta Log

- 2026-02-10: Synced to Scope `v0.1.0` docs/release state (no `v1.0` stable published).
