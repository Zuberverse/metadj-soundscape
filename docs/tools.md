# Tools - MetaDJ Soundscape

**Last Modified**: 2026-01-08 22:01 EST
**Status**: Public Summary

## Purpose
Public-facing list of tools and services used by MetaDJ Soundscape. Internal vendor comparisons and cost planning are intentionally omitted.

## Core Platform

### Daydream Scope
- Type: Interactive AI video generation platform
- GitHub: https://github.com/daydreamlive/scope/
- Docs: https://docs.daydream.live/scope/introduction
- Role: Primary backend for real-time video generation

### RunPod (Cloud GPU)
- Type: Cloud GPU compute (optional)
- RunPod template: https://runpod.io/console/deploy?template=daydream-scope
- Notes: Use a GPU with sufficient VRAM (24GB+ recommended). Costs vary by region and GPU.

## Development Stack
- Next.js 16 + TypeScript + Tailwind 4
- Meyda for audio feature extraction
- WebRTC for low-latency video delivery
- Vitest + jsdom for tests

## Notes
- Keep dependencies minimal and documented.
- Follow official Scope docs for server setup and updates.
