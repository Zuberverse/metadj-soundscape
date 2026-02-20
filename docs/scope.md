# Daydream Scope Overview (Soundscape)

**Last Modified**: 2026-02-19 09:12 ET
**Status**: Active Reference + Historical Context

## Overview

This file captures the Scope context relevant to MetaDJ Soundscape and points to canonical docs. It separates active integration references from the original Scope Track context.

## Active References (Use These First)

- Scope docs root: https://docs.daydream.live/scope
- Scope quickstart: https://docs.daydream.live/scope/getting-started/quickstart
- Scope API index: https://docs.daydream.live/scope/reference/api/index
- Scope environment variables: https://docs.daydream.live/scope/reference/environment-variables
- Scope GitHub: https://github.com/daydreamlive/scope
- Scope releases: https://github.com/daydreamlive/scope/releases
- RunPod template: https://runpod.io/console/deploy?template=daydream-scope

## Verified Release State (2026-02-19)

- Latest stable Scope release: `v0.1.3` (published 2026-02-13).
- First stable: `v0.1.0` (published 2026-02-09).
- Since v0.1.0: NDI input (v0.1.2), SageAttention validation, flexible VACE combinations, plugin stability, websocket improvements.

## Soundscape Integration Notes

- Health endpoint: `GET /health`.
- Pipeline load endpoint: `POST /api/v1/pipeline/load` using `pipeline_ids`.
- WebRTC signaling: `/api/v1/webrtc/ice-servers`, `/api/v1/webrtc/offer`, `/api/v1/webrtc/offer/{session_id}`.
- Soundscape defaults to `longlive` pipeline with `vace_enabled: false`.

## Historical Scope Track Context

Soundscape originated in the Daydream Scope Track program. That context remains useful for provenance and narrative, but operational integration should follow active references above.
