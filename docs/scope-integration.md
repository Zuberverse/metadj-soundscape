# Scope Integration - MetaDJ Soundscape

**Last Modified**: 2026-02-20
**Status**: Active

## Purpose

Single source of truth for Daydream Scope integration within MetaDJ Soundscape. This document combines endpoint API references, project-specific technical assumptions, and external links to the platform.

## Canonical External References

- Scope docs root: [https://docs.daydream.live/scope](https://docs.daydream.live/scope)
- Scope API index: [https://docs.daydream.live/scope/reference/api/index](https://docs.daydream.live/scope/reference/api/index)
- RunPod template: [https://runpod.io/console/deploy?template=daydream-scope](https://runpod.io/console/deploy?template=daydream-scope)
- Zuberant internal reference hub: `1-system/3-docs/external-tools/ai/daydream/daydream-scope.md`

## Current Technical Assumptions

- **Upstream baseline**: Scope stable is `v0.1.4` (published 2026-02-19).
- **Pipeline selection**: Soundscape defaults to the `longlive` pipeline for stylized, audio-reactive visuals.
- **Input mode**: Text-to-video (`input_mode: "text"`). No VACE or asset uploads in MVP.
- **Transport**: WebRTC offer flow with data channel parameter updates.

---

## API Reference

### Base URL
- **App Proxy (default)**: `/api/scope`
- **Scope Server (local)**: `http://localhost:8000`
- **Scope Server (RunPod)**: `https://your-instance-id-8000.proxy.runpod.net`

**Note**: The Soundscape client uses the proxy route by default. In production, enable it with `SCOPE_PROXY_ENABLE=true`.

### 1. Health & Status

**Health Check**
`GET /health`
Returns: `{ "status": "ok" }`

**Pipeline Status**
`GET /api/v1/pipeline/status`
Returns: `{ "status": "loaded" }` (or similar)

**Additional Read Endpoints (Proxied)**
- `GET /api/v1/hardware/info` — GPU/VRAM summary
- `GET /api/v1/models/status` — Model readiness
- `GET /api/v1/lora/list` — LoRA inventory
- `GET /api/v1/plugins` (fallback: `GET /plugins`) — Plugin discovery

### 2. Pipeline Initialization

**Pipeline Load**
`POST /api/v1/pipeline/load`

**Request**:
```json
{
  "pipeline_ids": ["longlive"],
  "load_params": {
    "width": 576,
    "height": 320,
    "vace_enabled": false
  }
}
```
**Notes**: 
- `width` and `height` must be divisible by 64. 
- `pipeline_ids` is the canonical shape for loading. Soundscape uses `vace_enabled: false` to ensure Text-to-Video mode on `longlive`.

### 3. WebRTC Negotiation

**ICE Servers**
`GET /api/v1/webrtc/ice-servers`
Returns: `{ "iceServers": [ { "urls": "stun:..." } ] }`

**WebRTC Offer**
`POST /api/v1/webrtc/offer`

**Request Example**:
```json
{
  "sdp": "...",
  "type": "offer",
  "initialParameters": {
    "input_mode": "text",
    "prompts": [{ "text": "...", "weight": 1.0 }],
    "prompt_interpolation_method": "linear",
    "denoising_step_list": [700, 500],
    "manage_cache": true,
    "kv_cache_attention_bias": 0.3,
    "recording": false
  }
}
```
**Notes**: 
- `input_mode: "text"` is required in Scope v0.1.4+.
- Avoid sending `noise_scale` or `noise_controller` in text mode.

**Trickle ICE**
`PATCH /api/v1/webrtc/offer/{sessionId}`
Pass queued candidates here to negotiate the connection.

### 4. Continuous Data Channel Updates

Soundscape sends parameter updates over a `parameters` data channel at ~30 Hz.

**Payload Example**:
```json
{
  "prompts": [{ "text": "...", "weight": 1.0 }],
  "denoising_step_list": [700, 500],
  "manage_cache": true,
  "transition": {
    "target_prompts": [{ "text": "...", "weight": 1.0 }],
    "num_steps": 5,
    "temporal_interpolation_method": "slerp"
  }
}
```

**Notes**:
- Generate pauses by sending `{"paused": true}`.
- Resume by sending `{"paused": false}`.
