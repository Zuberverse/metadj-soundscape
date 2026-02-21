# MetaDJ Soundscape Documentation

**Last Modified**: 2026-02-20 20:11 ET

Documentation index for Soundscape.

## Current Runtime Defaults

- First-launch output defaults to `16:9` at `576x320` (lowest tier).
- Three resolution tiers are available for each format (`16:9`, `9:16`) with labels `Low`, `Medium`, `High`.
- NDI/Spout integration is configured as Scope video input (`input_mode: "video"`, `input_source`).
- Studio includes live runtime tuning controls for beat/spike intensity, motion bias, and noise ceiling (applied without reconnect).
- Runtime telemetry explicitly indicates `Audio Reactive` vs `Ambient Hold` and includes live signal state.
- Preprocessors are video-only stages and are activated only when NDI/Spout input mode is enabled.
- Scope readiness indicator is intentionally simplified to `Online`/`Offline` with a static `Refresh` label.
- Current production pod `xtt2dvnrtew5v1` reports `ndi_available=false` and `spout_available=false`; external input toggles require a Scope runtime that exposes those capabilities.
- Preference hydration restores format/profile settings at mount and validates pipeline/preprocessor selections against fresh diagnostics to prevent delayed UI correction flicker.
- Theme prompting is color-calibrated per preset to preserve scene-specific palettes and reduce global dark-bias drift.
- Current production hardware profile is RunPod pod `xtt2dvnrtew5v1` on `RTX PRO 6000` (`96GB` VRAM), with `RTX 5090` still feasible for default/lower tiers.

## Core Pillars

| Document | Description |
|----------|-------------|
| [System Architecture](./system-architecture.md) | Runtime topology, signal processing, connection lifecycle, semantics |
| [Scope Integration](./scope-integration.md) | Single source of truth for Daydream Scope endpoints + technical parameters |
| [Product Spec](./product-spec.md) | Public capabilities, baseline validation thresholds |
| [Operations](./operations.md) | Deployment checklist, monitoring, incident playbooks, rollback |
| [Scope Deep Dive Research](./scope-deep-dive-research.md) | Exploratory research snapshot; not canonical for current runtime defaults |

## Historical Context

| Location | Description |
|----------|-------------|
| [Archive](./archive/) | Contains original hackathon scope-track research, submission notes, and early feature planning. |
