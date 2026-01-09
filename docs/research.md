# Research - MetaDJ Soundscape

**Last Modified**: 2026-01-08 22:01 EST
**Status**: Public Summary

## Purpose
Capture public technical notes and validated API endpoints relevant to MetaDJ Soundscape. Internal benchmarks and proprietary learnings are intentionally omitted.

---

## Scope Platform Notes

### API Endpoints (Public)
*Source: official Scope server docs (`docs/server.md`).*

| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/health` | GET | Health check | Root-level endpoint |
| `/docs` | GET | Swagger UI | - |
| `/api/v1/hardware/info` | GET | Hardware info | - |
| `/api/v1/pipeline/load` | POST | Load pipeline | - |
| `/api/v1/pipeline/status` | GET | Pipeline status | - |
| `/api/v1/pipelines/schemas` | GET | Pipeline schemas | - |
| `/api/v1/models/status` | GET | Model download status | - |
| `/api/v1/models/download` | POST | Download models | - |
| `/api/v1/webrtc/ice-servers` | GET | ICE server config | - |
| `/api/v1/webrtc/offer` | POST | WebRTC offer | - |
| `/api/v1/webrtc/offer/{session_id}` | PATCH | Trickle ICE | - |
| `/api/v1/assets` | GET/POST | Asset list/upload | Not used in Soundscape MVP |
| `/api/v1/assets/{path}` | GET | Asset file | - |
| `/api/v1/lora/list` | GET | LoRA list | - |

### RunPod Setup (Public)
- Template: https://runpod.io/console/deploy?template=daydream-scope
- Requires HuggingFace token for TURN server access
- Access Scope at port 8000 (example: `https://your-instance-id-8000.proxy.runpod.net`)

---

## Pipeline Notes (Public)

| Pipeline | Notes |
|----------|-------|
| `longlive` | Recommended for smooth prompt transitions |
| `streamdiffusionv2` | Faster but square-only output |

---

## Open Questions (Public)
- Confirm optimal resolution trade-offs for 16:9 demos on target GPUs.
- Validate whether `streamdiffusionv2` supports the same transition behavior.
