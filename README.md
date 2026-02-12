# MetaDJ Soundscape

**Last Modified**: 2026-02-12 12:02 EST

**Audio-reactive AI video generation powered by Daydream Scope**

Soundscape turns music into real-time AI visuals. The browser analyzes audio signals, maps them to generation controls, and streams parameters to Daydream Scope over WebRTC.

## What Is New In This Build

- **Mic input mode** in addition to the built-in demo track.
- **Clip recording + download** from the live Scope stream (`webm`).
- **Auto Theme Timeline** that rotates presets every N beats (16/32/64).
- **Hotkeys**: `Space` (play/pause), `1-9` (preset themes).
- **Demo-Safe Mode** UX when Scope is offline, with quick diagnostics CTA.
- **Performance HUD** with FPS sampling + dropped frame warning states.
- **Hardened connect flow** that resolves pipelines from fresh diagnostics before connecting.
- **Security patch baseline** upgraded to `next@16.1.6` (no known audit vulnerabilities).

## Core Features

- **Real-time Audio Analysis** — Meyda extraction (RMS, spectral centroid, flatness, ZCR)
- **Beat Detection + BPM Estimation** — Energy-spike detector with cooldowns
- **12 Visual Themes** — Preset prompt/mapping profiles for different aesthetics
- **WebRTC Scope Streaming** — GPU output video + parameter data channel
- **Ambient Mode** — Visual generation can continue without active audio playback
- **Generation Controls** — Denoising profile, reactivity profile, prompt accent, pipeline chain
- **Diagnostics Panel** — Health, pipeline status, hardware, model readiness, plugins/LoRAs
- **Telemetry Overlay** — Active pipeline, resolution, fps sample, dropped frame ratio

## Preset Themes

- Cosmic Voyage
- Neon Foundry
- Digital Forest
- Synthwave Highway
- Crystal Sanctuary
- Ocean Depths
- Cyber City
- Aurora Dreams
- 8-Bit Adventure
- Volcanic Forge
- Quantum Realm
- Neon Tokyo

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Toggle play/pause |
| `1-9` | Jump to preset theme by index |

## Quick Start

### Prerequisites

- Node.js `>=20.19.0`
- Running Scope server (RunPod or local)

### Install

```bash
npm install
```

### Run

```bash
npm run dev
# Open http://localhost:3500
```

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

## Typical Session Flow

1. Open `/soundscape`.
2. Click **Refresh** in Scope Readiness.
3. Confirm server/pipeline readiness and choose output aspect ratio + pipeline.
4. Connect Scope.
5. Pick audio source: **Demo** or **Mic**.
6. Play audio; tune denoising/reactivity/prompt accents.
7. Optionally enable **Auto Theme** for beat-driven preset rotation.
8. Optionally record a clip and download the `webm` file.

## Environment Variables

Copy `.env.example` to `.env.local`.

| Variable | Description |
|----------|-------------|
| `SCOPE_API_URL` | Scope server base URL for server-side proxy target |
| `NEXT_PUBLIC_SCOPE_API_URL` | Optional dev convenience fallback |
| `SCOPE_PROXY_ENABLE` | Required in production to enable `/api/scope` proxy |

### Security Note

The app defaults to `/api/scope` proxy routing. In production, proxying is disabled unless `SCOPE_PROXY_ENABLE=true`. If enabled, protect the deployment with platform-level access control.

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
| Mic mode silent | Check browser microphone permission + input device selection |
| Recording unavailable | Browser lacks `MediaRecorder` support for the current stream codec |

## Documentation Map

- `docs/README.md` — Documentation index
- `docs/architecture.md` — Runtime architecture + lifecycle
- `docs/soundscape-mechanics.md` — Audio/visual mechanics + transitions
- `docs/features/soundscape-mvp-spec.md` — Public capability summary
- `docs/api-reference.md` — Scope API usage notes
- `docs/scope-platform-reference.md` — Scope platform delta notes

## License

Proprietary — Zuberant
