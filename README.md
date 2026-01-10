# MetaDJ Soundscape

**Last Modified**: 2026-01-09 18:35 EST

**Audio-reactive AI video generation powered by Daydream Scope**

Music in. AI visuals out. Real-time.

Soundscape extracts audio features—energy, brightness, beats—and streams them to Daydream Scope. The AI generates frame-by-frame, responding to what the music is actually doing.

## Features

- **Real-time Audio Analysis** — Meyda-powered feature extraction (energy, spectral centroid, RMS, zero-crossing rate)
- **Beat Detection** — Energy-based BPM detection
- **Theme Presets** — Twelve curated visual themes with audio-reactive parameter mapping
- **WebRTC Streaming** — Low-latency video delivery from GPU server
- **Infinite Loop Playback** — Demo track plays continuously for seamless visual generation
- **Ambient Mode** — Generates visuals without audio when playback is paused

## Demo

Built-in demo track ("Metaversal Odyssey") loops infinitely. No external audio setup needed. The track is a MetaDJ Original.

File upload and microphone input: planned for future releases.

## Preset Themes

| Theme | Description |
|-------|-------------|
| **Cosmic Voyage** | Neon digital space with energy-responsive noise |
| **Neon Foundry** | Industrial AI interior with beat-driven noise pulses |
| **Digital Forest** | Bioluminescent nature/tech hybrid |
| **Synthwave Highway** | Retro-futuristic driving visuals |
| **Crystal Sanctuary** | Meditative crystalline environments |
| **Ocean Depths** | Bioluminescent underwater exploration |
| **Cyber City** | Neon-drenched futuristic metropolis |
| **Aurora Dreams** | Ethereal northern lights formations |
| **8-Bit Adventure** | Retro pixel art gaming worlds |
| **Volcanic Forge** | Molten fire and ember landscapes |
| **Quantum Realm** | Abstract particle physics dimensions |
| **Neon Tokyo** | Japanese cyberpunk street racing |

## Architecture

```
[Audio Input] → [Meyda Analysis] → [Mapping Engine] → [WebRTC DataChannel] → [Scope GPU]
                                                                                    ↓
[Browser Video] ← ──────────────── [RTCPeerConnection] ← ─────────────── [Generated Frames]
```

## Technology Stack

- **Frontend**: Next.js 16 + TypeScript + Tailwind 4
- **Audio Analysis**: Meyda library for real-time feature extraction
- **Video Streaming**: WebRTC for low-latency GPU-to-browser delivery
- **AI Backend**: Daydream Scope (StreamDiffusion) on RunPod

## Quick Start

### Prerequisites

- Node.js 20.19+
- Running Scope server (see [Scope Server Setup](#scope-server-setup))

### Installation

```bash
npm install
```

### Development

```bash
# Start development server (port 3500)
npm run dev

# Open in browser
open http://localhost:3500
```

### Usage

1. Click "Connect to Scope" (requires Scope server running)
2. Select output format (16:9 or 9:16)
3. Hit Play to start the demo track
4. Watch audio-reactive visuals generate in real-time
5. Switch themes to explore different visual styles

## How It Works

### Audio Analysis

Meyda extracts features at ~86Hz:
- **Energy** — Intensity level
- **Spectral Centroid** — Brightness/tone
- **RMS** — Amplitude
- **Zero-Crossing Rate** — Noisiness

### Parameter Mapping

Each theme maps audio to Scope parameters:
- Energy controls noise_scale (visual intensity)
- Beats trigger noise pulses (no hard cuts)
- All transitions use SLERP blending

### Streaming

WebRTC DataChannel sends parameters. Scope generates frames with StreamDiffusion. Video streams back over the same connection. Round-trip latency stays minimal.

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `SCOPE_API_URL` | Recommended | Scope server base URL used by the proxy |
| `NEXT_PUBLIC_SCOPE_API_URL` | Optional | Scope server base URL used by the proxy (dev convenience) |
| `SCOPE_PROXY_ENABLE` | Required in production | Enable the built-in proxy (`true`/`false`) |

**Security Note**: The app uses the `/api/scope` proxy by default. The proxy is disabled in production unless `SCOPE_PROXY_ENABLE=true`. Enable it only behind platform-level auth (Vercel Password Protection, VPN, etc.). If you want direct client connections, update `ScopeClient` to use a direct base URL.

## Scope Server Setup

Soundscape requires a running Daydream Scope server for AI video generation. There are two primary options:

### Option 1: RunPod (Recommended for Production)

1. **Create RunPod Account** — Sign up at [runpod.io](https://runpod.io)
2. **Deploy Scope Template** — Use the official Daydream Scope template
3. **Configure GPU** — RTX 4090 recommended for smooth real-time generation
4. **Get Server URL** — Copy the pod's public URL (e.g., `https://xxxxx-8000.proxy.runpod.net`)
5. **Set Environment Variable** — Add to `.env.local`:
   ```bash
   SCOPE_API_URL=https://your-runpod-url
   ```

### Option 2: Local Development

For local development without cloud infrastructure:

1. **Clone Scope** — `git clone https://github.com/daydreamlive/scope.git`
2. **Install Dependencies** — Follow the Scope repository setup instructions
3. **Run Scope Server** — Start with appropriate GPU configuration
4. **Set Environment Variable** — Add to `.env.local`:
   ```bash
   SCOPE_API_URL=http://localhost:8000
   ```

### Verifying Scope Connection

Test the connection before running Soundscape:

```bash
# Check health endpoint
curl http://your-scope-url/health

# Expected response:
# {"status":"ok"}
```

For detailed Scope documentation, see [Scope Docs](https://docs.daydream.live/scope/introduction).

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript type check |
| `npm run test` | Run test suite |

## Project Structure

```
src/
├── app/
│   └── soundscape/     # Soundscape page
├── components/
│   └── soundscape/     # UI components (Studio, Player, ThemeSelector)
└── lib/
    ├── scope/          # WebRTC and Scope API integration
    └── soundscape/     # Audio analysis, mapping engine, themes
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Server not healthy" | Health endpoint is `/health` (root-level) |
| Connected but no frames | Pipeline must load with `vace_enabled: false` |
| Generation doesn't start | Include `paused: false` in initial parameters |
| Pipeline stuck loading | Close other Scope UI tabs (conflicts with pipeline) |

## Hackathon Context

Built for the **Daydream 2025 Interactive AI Video Program (Scope Track)**:
- **Program**: Two-week sprint (Dec 22 - Jan 8)
- **Focus**: Real-time interactive AI video generation
- **Platform**: Daydream Scope (StreamDiffusion-based)

### Vibe Coded

This entire application was vibe coded using Claude Code and OpenAI Codex. No traditional development cycle. Just ideas, iteration, and AI-assisted implementation. The barrier between concept and creation keeps shrinking.

## Documentation

- `docs/soundscape-mechanics.md` — How Soundscape works (latent cache, noise, FPS, transitions)
- `docs/architecture.md` — System design and WebRTC flow
- `docs/scope-platform-reference.md` — Scope platform overview
- `docs/api-reference.md` — Scope API reference

## Resources

- [Scope GitHub](https://github.com/daydreamlive/scope/)
- [Scope Docs](https://docs.daydream.live/scope/introduction)
- [RunPod Docs](https://docs.runpod.io)

## License

Proprietary — Zuberant
