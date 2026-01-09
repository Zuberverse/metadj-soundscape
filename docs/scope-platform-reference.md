# Daydream Scope Platform Reference

**Last Modified**: 2026-01-07 22:45 EST
**Source**: [GitHub Repository](https://github.com/daydreamlive/scope) · [README](https://github.com/daydreamlive/scope/blob/main/README.md)
**Status**: Canonical Reference

## Purpose
Comprehensive platform documentation for Daydream Scope, focused on capabilities relevant to MetaDJ Soundscape.

### Official Source Links

| Resource | Link |
|----------|------|
| **GitHub Repository** | https://github.com/daydreamlive/scope |
| **README** | [README.md](https://github.com/daydreamlive/scope/blob/main/README.md) |
| **Documentation** | [docs/](https://github.com/daydreamlive/scope/tree/main/docs) |
| **LoRA Guide** | [docs/lora.md](https://github.com/daydreamlive/scope/blob/main/docs/lora.md) |
| **Spout Guide** | [docs/spout.md](https://github.com/daydreamlive/scope/blob/main/docs/spout.md) |
| **Contributing** | [docs/contributing.md](https://github.com/daydreamlive/scope/blob/main/docs/contributing.md) |
| **RunPod Template** | https://runpod.io/console/deploy?template=daydream-scope |
| **Discord** | https://discord.com/invite/5sZu8xmn6U |

---

## What is Daydream Scope?

Daydream Scope is an open-source tool for running and customizing real-time interactive generative AI pipelines and models. It enables:

- **Stream real-time AI-generated video** via WebRTC with low latency
- **Interactive timeline editor** to modify generation parameters on the fly
- **Multi-modal inputs** (text prompts, videos, camera feeds, and more)
- **State-of-the-art video diffusion models** experimentation

**Status**: Currently in alpha.

---

## Supported Pipelines

| Pipeline | Description | Min VRAM | Best For |
|----------|-------------|----------|----------|
| **StreamDiffusion V2** | Real-time video generation with streaming capabilities | 24GB | General-purpose real-time generation |
| **LongLive** | Extended generation for longer video sequences with consistent quality | 24GB | Stylized visuals with smooth prompt transitions |
| **Krea Realtime** | Text-to-video with real-time streaming | 32GB (40GB recommended) | Photorealistic portraits |
| **MemFlow** | Memory-efficient generation with temporal consistency | 24GB | Memory-constrained setups |
| **Reward Forcing** | Reward-based alignment techniques | 24GB | Research and experimentation |
| **Passthrough** | Passes video through unchanged | Minimal | Testing, debugging pipeline issues |

---

## Codebase Architecture

The Scope project follows a three-tier architecture with Python backend, React frontend, and optional Electron desktop app.

### GitHub Codebase Links

| Component | GitHub Link |
|-----------|-------------|
| **Python Backend** | [src/scope/](https://github.com/daydreamlive/scope/tree/main/src/scope) |
| **Core/Pipelines** | [src/scope/core/pipelines/](https://github.com/daydreamlive/scope/tree/main/src/scope/core/pipelines) |
| **Server (FastAPI)** | [src/scope/server/](https://github.com/daydreamlive/scope/tree/main/src/scope/server) |
| **React Frontend** | [frontend/](https://github.com/daydreamlive/scope/tree/main/frontend) |
| **Frontend Components** | [frontend/src/components/](https://github.com/daydreamlive/scope/tree/main/frontend/src/components) |
| **Frontend Hooks** | [frontend/src/hooks/](https://github.com/daydreamlive/scope/tree/main/frontend/src/hooks) |
| **Electron App** | [app/](https://github.com/daydreamlive/scope/tree/main/app) |
| **pyproject.toml** | [pyproject.toml](https://github.com/daydreamlive/scope/blob/main/pyproject.toml) |
| **CLAUDE.md** | [CLAUDE.md](https://github.com/daydreamlive/scope/blob/main/CLAUDE.md) |

