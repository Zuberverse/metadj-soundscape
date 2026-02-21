# Scope Integration - MetaDJ Soundscape

**Last Modified**: 2026-02-20 20:11 ET
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
- **Current production pod**: `<YOUR_RUNPOD_ID>` on RunPod with `RTX PRO 6000` (`96GB` VRAM).
- **Feasible alternative hardware**: `RTX 5090` (`32GB` VRAM) for default/lower resolution tiers.
- **Pipeline selection**: Soundscape defaults to the `longlive` pipeline for stylized, audio-reactive visuals.
- **Default first-launch output**: `16:9` at `576x320` (lowest tier for stable startup).
- **Resolution tiers**: `16:9` -> `576x320`, `768x432`, `896x512`; `9:16` -> `320x576`, `432x768`, `512x896` (labels: `Low`, `Medium`, `High`).
- **Input mode**: Text-to-video (`input_mode: "text"`) by default, with optional server-side video input (`input_mode: "video"`) using Scope `input_source` for NDI/Spout feeds.
- **Preprocessor activation**: Preprocessors are video-mode stages and are appended to `pipeline_ids` only when NDI/Spout input mode is active.
- **UI placement note**: The preprocessor selector is grouped in Soundscape's Input Streams section alongside NDI/Spout controls to reflect this dependency.
- **Current pod capability state**: `<YOUR_RUNPOD_ID>` reports `ndi_available=false` and `spout_available=false`; external video input requires a Scope runtime where those flags are `true`.
- **Current detected preprocessors on `<YOUR_RUNPOD_ID>`**: `video-depth-anything`, `scribble`, `gray`, `optical-flow` (all usage: `preprocessor`, mode: `video`).
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
    "vace_enabled": false,
    "vae_type": "lightvae",
    "quantization": null,
    "lora_merge_mode": "permanent_merge"
  }
}
```
**Notes**: 
- `width` and `height` should follow the selected pipeline schema constraints (LongLive supports 16-2048 with dimensions divisible by 16).
- Soundscape high tier is intentionally `896x512` (instead of `896x504`) to match current stable pipeline-load behavior on the active Scope runtime.
- `pipeline_ids` is the canonical shape for loading. Soundscape uses `vace_enabled: false` with `longlive`.
- For text-mode sessions, Soundscape sends only the selected main pipeline in `pipeline_ids`.
- For video-input sessions with a selected preprocessor, Soundscape sends `[preprocessor, mainPipeline]` in `pipeline_ids`.
- **Hardware Target**: Soundscape is currently tuned for `RTX PRO 6000` (`96GB` VRAM) using `"lightvae"`, uncompressed weights (`"quantization": null`), and `"permanent_merge"` to maximize fidelity at higher resolution tiers.
- **Compatibility Note**: `RTX 5090` (`32GB`) remains a viable option for default/lower tiers with the same parameter profile.

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
    "denoising_step_list": [1000, 750, 500, 250],
    "manage_cache": true,
    "kv_cache_attention_bias": 0.1,
    "recording": false
  }
}
```
**Video Input Example (NDI/Spout feed)**:
```json
{
  "sdp": "...",
  "type": "offer",
  "initialParameters": {
    "input_mode": "video",
    "input_source": {
      "enabled": true,
      "source_type": "ndi",
      "source_name": "Soundscape NDI"
    },
    "vace_use_input_video": true,
    "prompts": [{ "text": "...", "weight": 1.0 }],
    "denoising_step_list": [1000, 750, 500, 250],
    "manage_cache": true
  }
}
```
**Notes**: 
- `input_mode` is required in Scope v0.1.4+ (`"text"` or `"video"`).
- For NDI/Spout feeds without a browser video track, include `input_source` in `initialParameters`.
- Only enable NDI/Spout modes when Scope diagnostics report the relevant capability as available.
- Current production pod `<YOUR_RUNPOD_ID>` reports both NDI and Spout unavailable.
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
  "denoising_step_list": [1000, 750, 500, 250],
  "noise_scale": 0.55,
  "manage_cache": true,
  "transition": {
    "target_prompts": [{ "text": "...", "weight": 1.0 }],
    "num_steps": 5,
    "temporal_interpolation_method": "linear"
  }
}
```

**Notes**:
- Generate pauses by sending `{"paused": true}`.
- Resume by sending `{"paused": false}`.
- Soundscape uses `slerp` only when exactly two prompts are present (for example base + accent); otherwise it sends `linear`.
