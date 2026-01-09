# Scope API Reference (Soundscape)

**Last Modified**: 2026-01-08 22:01 EST
**Status**: Active

## Purpose
Document the Scope API surface used by MetaDJ Soundscape. This is a focused subset of the full Scope API.

---

## Base URL
- **App Proxy (default)**: `/api/scope`
- **Scope Server (local)**: `http://localhost:8000`
- **Scope Server (RunPod)**: `https://your-instance-id-8000.proxy.runpod.net`

**Note**: The Soundscape client uses the proxy route by default. In production, enable it with `SCOPE_PROXY_ENABLE=true` and protect access.

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
  "pipeline_id": "longlive",
  "load_params": {
    "width": 576,
    "height": 320,
    "vace_enabled": false
  }
}
```

**Notes**:
- `width`/`height` must be divisible by 64.
- Soundscape uses `vace_enabled: false` for text-to-video mode.

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
    "prompts": [{ "text": "...", "weight": 1.0 }],
    "denoising_step_list": [1000, 750, 500, 250],
    "manage_cache": true,
    "paused": false
  }
}
```

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
  "candidate": "...",
  "sdpMid": "0",
  "sdpMLineIndex": 0
}
```

---

## Data Channel Updates

Soundscape sends parameter updates over a `parameters` data channel at ~30 Hz.

**Payload**:
```json
{
  "prompts": [{ "text": "...", "weight": 1.0 }],
  "denoising_step_list": [1000, 750, 500, 250],
  "noise_scale": 0.55,
  "manage_cache": true,
  "paused": false,
  "transition": {
    "target_prompts": [{ "text": "...", "weight": 1.0 }],
    "num_steps": 5,
    "temporal_interpolation_method": "slerp"
  }
}
```
