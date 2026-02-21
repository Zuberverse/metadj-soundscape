# MetaDJ Soundscape

**Last Modified**: 2026-02-20 20:11 ET

**Audio-reactive AI video generation powered by Daydream Scope**

Soundscape turns music into real-time AI visuals. The browser analyzes audio signals, maps them to generation controls, and streams parameters to Daydream Scope over WebRTC.

## What Is New In This Build

- **Mic input mode** in addition to the built-in demo track.
- **Clip recording + download** from the live Scope stream (`webm`).
- **Auto Theme Timeline** that rotates presets every N beats (16/32/64).
- **Hotkeys**: `Space` (play/pause), `1-9` (preset themes), `F` (fullscreen), arrows (theme cycle).
- **Demo-Safe Mode** UX when Scope is offline, with quick diagnostics CTA.
- **Performance HUD** with FPS sampling + dropped frame warning states.
- **Hardened connect flow** that resolves pipelines from fresh diagnostics before connecting.
- **Hydration-safe preference restore** that avoids delayed pipeline/preprocessor selection flicker on load.
- **Resolution Tiers Standardized** to `Low` / `Medium` / `High` with validated dimensions for stable Scope pipeline startup.
- **Theme Prompt Color Calibration** to keep palettes aligned per scene and reduce dark-bias prompt drift.
- **Security patch baseline** upgraded to `next@16.1.6` (no known production dependency vulnerabilities via `npm audit --omit=dev`).

## Core Features

- **Real-time Audio Analysis** — Meyda extraction (RMS, spectral centroid, flatness, ZCR)
- **Beat Detection + BPM Estimation** — Energy-spike detector with cooldowns
- **15 Visual Themes** — Preset prompt/mapping profiles for different aesthetics
- **WebRTC Scope Streaming** — GPU output video + parameter data channel
- **External Video Input Routing** — NDI and Spout toggles for feeding visualizer video into Scope (`input_mode: "video"`)
- **Output Format + Resolution Tiers** — 16:9 and 9:16 with 3 selectable tiers each (`Low`, `Medium`, `High`; default first-launch tier: `576x320`)
- **Ambient Mode** — Visual generation can continue without active audio playback
- **Generation Controls** — Denoising profile, reactivity profile, motion pace profile, prompt accent, and advanced runtime tuning sliders (beat/spike/motion/noise) applied live
- **Diagnostics Panel** — Health, pipeline status, hardware, model readiness, plugins/LoRAs
- **Telemetry Overlay** — Active pipeline, resolution, fps sample, dropped frame ratio, performance health
- **Runtime Mode Telemetry** — Explicit `Audio Reactive` vs `Ambient Hold` state with live signal readout
- **Preprocessor Clarity** — Video preprocessors are enabled only for NDI/Spout input mode and remain inactive in text mode
- **Scope Readiness Simplified** — Connect screen status displays `Online`/`Offline` only, with a static `Refresh` control

## Preset Themes

- Astral
- Forge
- Forest
- Synthwave
- Sanctuary
- Ocean
- Cyber
- Aurora
- Arcade
- Volcano
- Quantum
- Tokyo
- Circuit
- Amethyst
- Matrix

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Toggle play/pause |
| `1-9` | Jump to preset theme by index |
| `F` | Toggle fullscreen |
| `←` / `→` | Previous/next theme |

## Quick Start

### Prerequisites

- Node.js `>=20.19.0`
- Running Scope server (RunPod or local)
- Current recommended Scope GPU: `RTX PRO 6000` (`96GB` VRAM), active pod `xtt2dvnrtew5v1`
- Feasible alternative GPU: `RTX 5090` (`32GB` VRAM) for default/lower tiers
- Current pod capability report for `xtt2dvnrtew5v1`: `ndi_available=false`, `spout_available=false` (external video input requires a Scope runtime with those capabilities enabled)

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

> [!NOTE]
> **Important**: Always open the application on **`https://localhost:3500`**, *not* the default Next.js port 3000. Dev mode runs with an experimental self-signed HTTPS cert on port 3500.

For persistent launch from Codex/Claude sessions, from corpus root use:

```bash
./1-system/2-scripts/integration/ai-dev-server.sh start 3-projects/5-software/metadj-soundscape --port 3500
```

Then manage lifecycle with:
`./1-system/2-scripts/integration/ai-dev-server.sh status metadj-soundscape`,
`logs metadj-soundscape --lines 120`, and
`stop metadj-soundscape`.

### Verify Scope Connectivity

```bash
npm run check:scope
```

### Validate Launch Configuration

```bash
npm run check:launch
```

## Typical Session Flow

1. Open `/soundscape`.
2. Click **Refresh** in Scope Readiness.
3. Confirm server/pipeline readiness and choose output format + resolution tier + pipeline.
4. If using NDI/Spout input, confirm Scope capability is available in diagnostics before enabling stream input toggles, then configure optional `Video Preprocessor` in the Input Streams block.
5. Connect Scope.
6. Pick audio source: **Demo** or **Mic**.
7. Play audio; tune denoising/reactivity/motion pace/prompt accents, and optionally refine advanced runtime sliders live.
8. Optionally enable **Auto Theme** for beat-driven preset rotation.
9. Optionally record a clip and download the `webm` file.

## Environment Variables

Copy `.env.example` to `.env.local`.

| Variable | Description |
|----------|-------------|
| `SCOPE_API_URL` | Scope server base URL for server-side proxy target |
| `NEXT_PUBLIC_SCOPE_API_URL` | Optional dev convenience fallback |
| `SCOPE_PROXY_ENABLE` | Required in production to enable `/api/scope` proxy |
| `SCOPE_PROXY_REQUIRE_WRITE_TOKEN` | Write token enforcement in production (`true` by default) |
| `SCOPE_PROXY_WRITE_TOKEN` | Server-side token used to authorize write operations |
| `SCOPE_PROXY_WRITE_TOKEN_HEADER` | Header name for write token (default: `x-scope-proxy-token`) |
| `SCOPE_PROXY_MAX_BODY_BYTES` | Maximum proxied write payload size in bytes (default: `524288`) |
| `SCOPE_PROXY_TRUST_FORWARDED_IP` | Set `true` to trust forwarded IP headers for rate limiting (default: `false` in production) |
| `SCOPE_PROXY_IP_HEADER` | Optional forwarded IP header to trust when `SCOPE_PROXY_TRUST_FORWARDED_IP=true` |
| `HF_TOKEN` | Required on RunPod Scope pods for Cloudflare TURN relay and gated model downloads |

### Security Note

The app defaults to `/api/scope` proxy routing. In production, proxying is disabled unless `SCOPE_PROXY_ENABLE=true`.
When enabled, the proxy enforces strict endpoint/method allowlisting, same-origin `Origin` validation for writes, upstream safety checks, request-body limits, and request rate limiting.
Production proxy safety expects `SCOPE_API_URL` to be set server-side. By default, production writes require `SCOPE_PROXY_WRITE_TOKEN` (`SCOPE_PROXY_REQUIRE_WRITE_TOKEN=true`).
Deploy behind platform-level access controls for additional protection.

## Production Launch Checklist

1. CI must pass: lint, type-check, test, build.
2. Scope backend healthy and reachable via `SCOPE_API_URL`.
3. Launch preflight passes: `npm run check:launch`.
4. Production proxy env set correctly:
   - `SCOPE_PROXY_ENABLE=true`
   - `SCOPE_PROXY_REQUIRE_WRITE_TOKEN=true` (recommended)
   - `SCOPE_PROXY_WRITE_TOKEN` configured
5. Validate `/soundscape` smoke flow:
   - diagnostics refresh
   - connect
   - video playback
   - audio reactivity
   - short recording export
6. Confirm rollback path is documented and tested in `docs/operations.md`.

## Operations & Incident Response

- Canonical runbook: `docs/operations.md`
- Includes deployment sequence, monitoring signals, incident playbooks, and rollback procedures.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | ESLint strict run |
| `npm run type-check` | TypeScript type-check |
| `npm run test` | Vitest test run |
| `npm run check:scope` | Probe Scope endpoints |
| `npm run check:launch` | Validate deployment-critical environment config |

## Architecture Snapshot

```text
[Demo Track or Mic] -> [Audio Analyzer (~86Hz)] -> [Mapping Engine] -> [DataChannel (~30Hz)] -> [Scope GPU]
                                                                                                   |
[Browser Video] <------------------------------------------ [RTCPeerConnection Video Track] <-----+
```

## Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| Server shows offline | Run `npm run check:scope`; verify `SCOPE_API_URL`; restart Scope pod |
| Connect fails on stale pipeline | Use Scope diagnostics refresh and reconnect (resolved pipeline is now enforced) |
| No frames but connected | Verify pipeline loaded (`/api/v1/pipeline/status`) and avoid conflicting Scope tabs |
| NDI/Spout toggle won’t connect | Check Scope capabilities in diagnostics; current production pod reports `ndi_available=false` and `spout_available=false` |
| Mic mode silent | Check browser microphone permission + input device selection |
| Recording unavailable | Browser lacks `MediaRecorder` support for the current stream codec |

## Documentation Map

- `docs/README.md` — Detailed documentation index
- `docs/system-architecture.md` — Runtime architecture, connection lifecycle, and audio-reactive mechanics
- `docs/scope-integration.md` — Single source of truth for Daydream Scope API endpoints and technical parameters
- `docs/product-spec.md` — Public capabilities and feature thresholds
- `docs/operations.md` — Tooling and deployment context
- `docs/archive/` — Historical Scope-Track Hackathon context

## License

Proprietary — Zuberant
