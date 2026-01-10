# Daydream Project Page - MetaDJ Soundscape

**Last Modified**: 2026-01-09 18:35 EST
**Status**: Active (Published)

---

## Project Links

| Resource | URL |
|----------|-----|
| **Daydream Project Page** | https://app.daydream.live/creators/metadj/metadj-soundscape |
| **GitHub Repository** | https://github.com/Zuberverse/metadj-soundscape |

---

## Project Stats

| Metric | Value |
|--------|-------|
| Stars | 3 |
| Comments | 2 |
| Fire Reactions | 3 |
| Created | 2025-12-29 |
| Last Updated | 2026-01-09 |
| Version | 15 |
| Status | Published |

---

## Featured Content

### Cover Video
- **URL**: `https://clips.t3.storage.dev/assets/1767933731185-440a13b3.mp4`
- **Duration**: ~1:50
- **Description**: Demo reel showing audio-reactive visuals across multiple themes

### Cover Image
- **URL**: `https://api.daydream.live/v1/assets/resolve?key=assets%2F1767933731184-0a2958cf.jpg`

---

## Tags

- Scope Workflow

---

## Current Writeup (Version 15)

### Title
**MetaDJ Soundscape**

### Subtitle
*Scope Track Project | Daydream Interactive AI Video Program*

### Description

MetaDJ Soundscape generates AI visuals that respond to music in real-time. Audio analysis drives generation parameters frame by frame.

Pick a theme, hit play. High energy in the audio drives more visual motion. Low energy lets things settle. Beats pulse through the frame. 12 worlds to explore, each responding differently to the same track.

Choose your output format before connecting—16:9 for widescreen displays or 9:16 for portrait mode on mobile. Here's the 9:16 experience in action:

*[9:16 Mobile Video - To be added]*

### The Audio Pipeline

Meyda handles audio analysis at ~86Hz. Browser-based—no server round-trip.

Four key features drive the visuals:

- **Energy (RMS)** — Overall loudness/intensity, mapped to noise_scale
- **Spectral Centroid** — Brightness/tonal quality, influences prompt modifiers
- **Zero-Crossing Rate** — Noisiness indicator for texture decisions
- **Beat Detection** — Energy-based BPM detection triggers rhythmic responses

All audio analysis happens in the browser. A server round-trip would add 50-100ms of latency, which breaks the illusion of real-time response. By running Meyda locally and streaming only the extracted parameters via WebRTC DataChannel, the audio-to-visual response stays tight enough to feel connected to the music.

### The Mapping Engine

The mapping engine translates audio features into Scope parameters. Each theme defines its own rules.

Energy drives noise_scale (0.48-0.72 range). This controls how much each frame deviates from the last. Too low and things freeze. Too high and you get chaos. Beat detection triggers noise pulses, not prompt changes. Beats boost noise_scale momentarily—you feel the rhythm without constant visual churn.

### 12 Worlds to Explore

Each theme is a complete parameter mapping system defining how that world responds to music:

| Theme | Description |
|-------|-------------|
| **Cosmic Voyage** | Neon digital space with energy-responsive nebulae |
| **Neon Foundry** | Industrial AI interior with beat-driven machinery pulses |
| **Digital Forest** | Bioluminescent nature/tech hybrid, organic movement |
| **Synthwave Highway** | Retro-futuristic endless drive, speed responds to tempo |
| **Crystal Sanctuary** | Meditative crystalline formations, gentle evolution |
| **Ocean Depths** | Bioluminescent underwater exploration, flowing currents |
| **Cyber City** | Neon-drenched futuristic metropolis, urban energy |
| **Aurora Dreams** | Ethereal northern lights dancing with the music |
| **8-Bit Adventure** | Retro pixel art gaming worlds, nostalgic pulse |
| **Volcanic Forge** | Molten fire and ember landscapes, intensity-driven |
| **Quantum Realm** | Abstract particle physics dimensions, chaotic beauty |
| **Neon Tokyo** | Japanese cyberpunk street racing, aggressive response |

### Latent Cache & Seamless Transitions

Scope maintains a latent cache—the mathematical representation of the previous frame. Each new frame starts from that cached state, not from scratch. This is what makes it feel continuous rather than a slideshow.

When prompts change (theme switch, energy spike), we use SLERP (Spherical Linear Interpolation) to blend between latent representations over multiple frames. The transition object tells Scope to crossfade over 5-7 frames depending on the trigger type. No hard cuts, even during dramatic musical moments.

We never use reset_cache (causes jarring visual jumps). manage_cache stays permanently true, all changes flow through smooth transitions. Continuous evolution that feels intentional, not random.

The result is visuals that truly respond to what's happening in the audio. High energy passages drive more visual motion and change. Quieter moments let the generation settle into slower evolution. Beats pulse through as momentary bursts of intensity. Play the same track with different themes and you get completely different visual journeys, because each theme defines its own personality for how it interprets the music.

### The Backend

Audio analysis runs in the browser and streams to Scope via WebRTC. A high-VRAM GPU on RunPod handles inference using the longlive pipeline with 4-step denoising. The mapping engine does the translation—energy drives noise_scale for visual intensity, beat detection triggers noise pulses, and all prompt transitions use SLERP blending for seamless visual flow.

**Stack**: Next.js 16 + TypeScript + Tailwind 4 + Meyda + WebRTC streaming to Daydream Scope

### Development Note

This entire application was vibe coded using Claude Code and OpenAI Codex. No traditional development cycle. Just ideas, iteration, and AI-assisted implementation. The barrier between concept and creation keeps shrinking.

---

## Community Engagement

### Comments

| User | Date | Comment |
|------|------|---------|
| **Vibor Cipan** (@viborc) | 2025-12-31 | "Very happy to see your project update up. Very excited to see where this goes from here and learn from your experiences building with Scope!" |
| **MetaDJ** (@metadj) | 2026-01-09 | "Thank you!" |

---

## Update History

| Version | Date | Notes |
|---------|------|-------|
| 16 | 2026-01-09 | Added aspect ratio selection info + 9:16 mobile video intro (pending) |
| 15 | 2026-01-09 | Previous published version |
| 1 | 2025-12-29 | Initial publication |

---

## Related Assets

- Demo track: "Metaversal Odyssey" (MetaDJ Original)
- Pipeline: `longlive` (StreamDiffusion)
- Resolution: 576×320 (16:9) / 320×576 (9:16)
