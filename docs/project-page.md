# MetaDJ Soundscape

**Scope Track Project | Daydream Interactive AI Video Program**

**GitHub**: [https://github.com/Zuberverse/metadj-soundscape](https://github.com/Zuberverse/metadj-soundscape)

**Where music meets imagination. A real-time engine that sculpts dynamic visual experiences directly from the energy of your music.**

MetaDJ Soundscape turns audio into real-time AI visuals by analyzing browser audio signals and streaming generated parameters to a Daydream Scope engine. High energy in the audio drives intense visual motion, while low energy lets the imagery settle. Beats pulse through the frame via parameter spikes rather than jarring cuts. It’s an unbroken, continuous visual journey.

---

## 📱 The Experience

Soundscape is designed to be plug-and-play. Choose your output format before connecting:
- **16:9** for widescreen displays, VJ sets, and desktop monitors.
- **9:16** for portrait mode and mobile experiences.

**Input Modes**:
- **Autoplay Demo**: Ships with an original track that loops infinitely for immediate testing.
- **Microphone**: Reacts to live external audio in your environment.
- **Ambient Hold**: Disables audio reactivity for a smooth, slow-evolving visual drift.
- **Video Input (NDI/Spout)**: Supports external video feeds running through Scope’s preprocessor chains (Depth, Scribble, Flow) before generation.

## 🎛️ The Audio Pipeline

Audio analysis happens entirely in the browser using [Meyda](https://meyda.js.org/) at ~86Hz—no server round-trip required. A server round-trip would add 50-100ms of latency, which breaks the illusion of real-time rhythmic response. By running Meyda locally and streaming *only* the extracted parameters via WebRTC DataChannel, the audio-to-visual response stays incredibly tight.

Four key features drive the visuals:
- **Energy (RMS)** — Overall loudness and intensity, mapped to `noise_scale`.
- **Spectral Centroid** — Brightness and tonal quality, influencing prompt modifiers.
- **Zero-Crossing Rate** — Noisiness indicator for texture decisions.
- **Beat Detection** — Energy-based BPM detection that triggers rhythmic parameter boosts.

## 🗺️ The Mapping Engine & 15 Worlds

The mapping engine translates raw audio features into Scope parameters. Energy drives `noise_scale` (typically a 0.48-0.72 range), controlling how much each frame deviates from the last. Too low and things freeze; too high and you get chaos. Beat detection triggers momentary noise and parameter pulses—allowing you to feel the rhythm without constant, jarring visual churn.

Each theme is a complete parameter mapping system defining how that world responds to music. **The 15 Worlds**:
1. **Astral** - Cosmic dust and nebulae.
2. **Forge** - Deep descent into the AI Foundry.
3. **Forest** - Bioluminescent nature and organic growth.
4. **Synthwave** - Neon grids and endless retro highways.
5. **Sanctuary** - Meditative crystalline structures.
6. **Ocean** - Deep sea bioluminescence and swirling currents.
7. **Cyber** - Futuristic dystopian neon cityscapes.
8. **Aurora** - Dancing atmospheric northern lights.
9. **Arcade** - Retro 8-bit voxel gaming worlds.
10. **Volcano** - Molten rock and explosive ember bursts.
11. **Quantum** - Microscopic abstract particle physics.
12. **Tokyo** - High-speed cyberpunk street racing.
13. **Circuit** - Macro views of glowing motherboard pathways.
14. **Amethyst** - Deep purple gem caverns and fractal light.
15. **Matrix** - Descending neon data rain.

*Note: The app features an **Auto Theme Timeline** that automatically rotates through these worlds based on musical phrasing and beat-sections.*

## 🎞️ Latent Cache & Seamless Transitions

Scope maintains a latent cache—the mathematical representation of the previous frame. Each new frame starts from that cached state, not from scratch. This makes it feel continuous rather than like a slideshow.

When prompts change (e.g., theme switch, energy spike, or beat pulse), SLERP (Spherical Linear Interpolation) is used to blend between latent representations over 8 frames. There are no hard cuts, even during dramatic musical moments.

`manage_cache` stays permanently true. All changes flow through smooth transitions. The result is continuous evolution that feels intentional, not random. Play the same track with different themes, and you get completely different visual journeys.

## ⚙️ The Infrastructure

- **Frontend**: Next.js 16 + TypeScript + Tailwind 4.
- **Analysis**: Meyda (local browser execution).
- **Communication**: WebRTC streaming to Daydream Scope.
- **Compute**: Inference handled by a RunPod RTX PRO 6000 (96GB VRAM) or RTX 5090 using the `longlive` pipeline.

## 🤖 The Origin Story

The entire Soundscape application was "vibe coded" using Claude Code and OpenAI Codex. There was no traditional development cycle—just ideas, iteration, and AI-assisted implementation. The barrier between concept and creation keeps shrinking.
