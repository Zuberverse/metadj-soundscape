# Daydream Scope Track - Public Brief

**Last Modified**: 2026-01-10 15:37 EST
**Source**: Daydream Scope track program materials (public summary).

## Overview
The Scope Track is part of the Daydream Interactive AI Video Program. This brief summarizes the public-facing context and links used to support MetaDJ Soundscape.

## Public Notes
- The program includes workshops, office hours, and demo checkpoints.
- Refer to official program communications for schedules and logistics.
- Internal coordination details, prizes, and contact instructions are intentionally omitted.

## Resources and Links

### Official Docs
- Scope GitHub: https://github.com/daydreamlive/scope/
- Scope docs: https://docs.daydream.live/scope/introduction
- RunPod quickstart: https://docs.daydream.live/scope/getting-started/quickstart#cloud-deployment-runpod
- RunPod video tutorial: (embedded in quickstart page - "How to Run Daydream Scope in the Cloud")
- Scope FAQ: https://www.notion.so/livepeer/Interactive-Video-Hacker-Program-Scope-FAQ-2d20a348568780b3bb81f8f38086caa1

### API References
- Scope API server docs (Quick Start + workflows): https://github.com/daydreamlive/scope/blob/main/docs/server.md
- Scope API + core library walkthrough (Notion): https://www.notion.so/livepeer/Scope-Server-API-and-Core-Library-2b20a348568780b791f4e0d8b33d85b7

### Deployment
- RunPod template: https://runpod.io/console/deploy?template=daydream-scope
- HuggingFace tokens: https://huggingface.co/settings/tokens

## RunPod Notes (Public)

Canonical RunPod setup guidance lives in `1-system/3-docs/external-tools/ai/daydream/daydream-scope.md` and the official quickstart.

**Quick Reference:**
- **Template**: https://runpod.io/console/deploy?template=daydream-scope
- **Access**: Port 8000 (`https://your-instance-id.runpod.io:8000`)
- **Required**: HuggingFace token with read permissions (set as `HF_TOKEN` env var)

## Updates and Clarifications
- The Scope API server docs include a Quick Start and workflows section.
- The `/docs` endpoint on the API server should reflect current Swagger UI info.
