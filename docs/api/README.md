# API Notes

**Last Modified**: 2026-01-07 22:45 EST

Central index for Scope API integration notes.

## Official API Documentation

| Topic | Official Link |
|-------|---------------|
| **API Overview** | [docs/api/](https://github.com/daydreamlive/scope/tree/main/docs/api) |
| **Pipeline Loading** | [docs/api/load.md](https://github.com/daydreamlive/scope/blob/main/docs/api/load.md) |
| **Parameters** | [docs/api/parameters.md](https://github.com/daydreamlive/scope/blob/main/docs/api/parameters.md) |
| **Receive Video (T2V)** | [docs/api/receive.md](https://github.com/daydreamlive/scope/blob/main/docs/api/receive.md) |
| **Server Setup** | [docs/server.md](https://github.com/daydreamlive/scope/blob/main/docs/server.md) |

## Current State
- Hackathon flow uses a custom Soundscape UI, with the native Scope UI as fallback.
- Soundscape uses the Scope WebRTC offer flow (`/api/v1/webrtc/*`) for prompt-driven streaming in text-to-video mode.

## Project References

| Document | Description |
|----------|-------------|
| `../api-reference.md` | Soundscape-focused API reference |
| `../scope-platform-reference.md` | Platform overview and architecture |
| `../scope-technical.md` | Project-specific technical decisions |
| `../research.md` | Research findings and validation notes |
