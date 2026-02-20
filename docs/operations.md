# Operations & Deployment - MetaDJ Soundscape

**Last Modified**: 2026-02-20
**Status**: Active

## Purpose

Project-specific RunPod deployment notes and operational context for MetaDJ Soundscape.

## Deploying Daydream Scope via RunPod

Zuberant typically uses RunPod to deploy Daydream Scope instances that stream directly to Soundscape.

- **Official Daydream Template**: [https://console.runpod.io/deploy?template=aca8mw9ivw&ref=5k8hxjq3](https://console.runpod.io/deploy?template=aca8mw9ivw&ref=5k8hxjq3)
- **Active Setup**: RTX 5090 is typically utilized for low-latency 30fps text-to-video inference.
- **Reference URL**: The active instances URL should be placed into `.env.local` as `SCOPE_API_URL` to facilitate proxying in Soundscape.

## Tooling & Local Assets

Canonical tools overview: `3-projects/5-software/tools.md`

Any project-specific tooling, including AI-driven startup shell scripts, reside in `scripts/` inside the application structure or use global `1-system/2-scripts` workflows.

### Local Development

> [!IMPORTANT]
> Because Next.js apps default to port `3000`, it is extremely common to accidentally open `localhost:3000` out of habit. **Soundscape runs on port `3500`**. Always use `http://localhost:3500` when accessing the local dashboard.
