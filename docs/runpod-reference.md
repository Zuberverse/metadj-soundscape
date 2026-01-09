# RunPod Platform Reference

**Last Modified**: 2026-01-08 22:01 EST
**Source**: RunPod Documentation (docs.runpod.io)
**Status**: Public Summary

## Purpose
Public-facing RunPod reference for running Daydream Scope. This summary avoids internal budgeting and operational details.

---

## Quick Start (Public)

1. Deploy the official Scope template:
   - https://runpod.io/console/deploy?template=daydream-scope
2. Create a HuggingFace token (read permissions) and set `HF_TOKEN` in the template.
3. Choose a GPU with sufficient VRAM (24GB+ recommended).
4. Launch the pod and access Scope at port 8000:
   - `https://{pod-id}-8000.proxy.runpod.net`

---

## Notes
- RunPod costs vary by GPU and region. Stop pods when not in use.
- Use persistent storage if you want models cached across restarts.
- For detailed configuration, use RunPod's official docs:
  - https://docs.runpod.io
