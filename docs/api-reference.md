# Scope API Reference (Soundscape)

**Last Modified**: 2026-02-19 11:49 EST
**Status**: Project Delta

## Purpose
Document the Scope API surface used by MetaDJ Soundscape. This is a focused subset of the full Scope API.

## Canonical External References

- `1-system/3-docs/external-tools/ai/daydream/daydream-scope.md` — External reference hub
- https://docs.daydream.live/scope/reference/api/index — Official API reference
- https://docs.daydream.live/scope — Official Scope docs

---

## Base URL
- **App Proxy (default)**: `/api/scope`
- **Scope Server (local)**: `http://localhost:8000`
- **Scope Server (RunPod)**: `https://your-instance-id-8000.proxy.runpod.net`

**Note**: The Soundscape client uses the proxy route by default. In production, enable it with `SCOPE_PROXY_ENABLE=true`. The proxy enforces strict method/path allowlisting, same-origin validation for write calls, and request rate limiting.

---

## Health Check

**Endpoint**: `GET /health`

**Response**:
```json
{ "status": "ok" }
```

---

## Pipeline Load

**Endpoint**: `POST /api/v1/pipeline/load`

**Purpose**: Load the generation pipeline before starting WebRTC.

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
- `width`/`height` must be divisible by 64.
- Soundscape uses `vace_enabled: false` for text-to-video mode on `longlive`.
- `pipeline_ids` is the canonical request shape in current Scope docs.

---

## Pipeline Status

**Endpoint**: `GET /api/v1/pipeline/status`

**Response**:
```json
{ "status": "loaded" }
```

---

## ICE Servers

**Endpoint**: `GET /api/v1/webrtc/ice-servers`

**Response**:
```json
{ "iceServers": [ { "urls": "stun:..." } ] }
```

---

## WebRTC Offer

**Endpoint**: `POST /api/v1/webrtc/offer`

**Purpose**: Create a WebRTC session and return the SDP answer.

**Request**:
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
- `input_mode` is required in v0.1.4+: `"text"` for T2V, `"video"` for V2V.
- `paused` must NOT be in initialParameters — it is data-channel-only.
- `noise_scale`/`noise_controller` are video mode only — omit in text mode.

**Response**:
```json
{
  "sessionId": "...",
  "sdp": "...",
  "type": "answer"
}
```

---

## Trickle ICE

**Endpoint**: `PATCH /api/v1/webrtc/offer/{sessionId}`

**Request**:
```json
{
  "candidates": [
    {
      "candidate": "...",
      "sdpMid": "0",
      "sdpMLineIndex": 0
    }
  ]
}
```

---

## Additional Read Endpoints (Proxied)

- `GET /api/v1/hardware/info` — GPU/VRAM summary
- `GET /api/v1/models/status` — Model readiness
- `GET /api/v1/lora/list` — LoRA inventory
- `GET /api/v1/plugins` (fallback: `GET /plugins`) — Plugin discovery

---

## Data Channel Updates

Soundscape sends parameter updates over a `parameters` data channel at ~30 Hz.

**Payload**:
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
- `paused: false/true` can be sent here to pause/resume generation.
- `noise_scale` and `noise_controller` should only be sent when in video input mode.
