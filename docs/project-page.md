# MetaDJ Soundscape

**Scope Track Project | Daydream Interactive AI Video Program**

**GitHub**: [https://github.com/Zuberverse/metadj-soundscape](https://github.com/Zuberverse/metadj-soundscape)

**Where music meets imagination. A real-time engine that sculpts dynamic visual experiences directly from the energy of your music.**

MetaDJ Soundscape turns audio into real-time AI visuals by analyzing browser audio signals and streaming generated parameters to a Daydream Scope engine. High energy in the audio drives intense visual motion, while low energy lets the imagery settle. Beats pulse through the frame via parameter spikes rather than jarring cuts. It’s an unbroken, continuous visual journey.

---

## 📱 The Experience

Soundscape is designed as an immediate, visceral invitation into visual creation. Whether you are driving a massive LED wall for a live VJ set or exploring generative spaces on your mobile device, the pipeline adapts instantly.

Choose your canvas before connecting:
- **16:9** for widescreen displays, immersive installations, and desktop monitors.
- **9:16** for portrait mode and mobile experiences.

**Input Modalities**:
- **Autoplay Demo**: Ships with an original MetaDJ track that loops infinitely, plunging you straight into the experience.
- **Microphone**: Transforms your physical environment—reacting to your voice, your instruments, or ambient room audio.
- **Ambient Hold**: Disables audio reactivity for a smooth, slow-evolving visual drift when lower intensity is required.
- **Video Input (NDI/Spout)**: Supports external live-camera feeds, funneling them through Scope’s preprocessor chains (Depth, Scribble, Flow) to fuse reality with generative synthesis.

## 🎛️ The Audio Pipeline

Audio analysis happens entirely in the browser using [Meyda](https://meyda.js.org/) at a blistering ~86Hz—without a single server round-trip. Sending audio to a server would add 50-100ms of latency, instantly severing the delicate rhythm-to-visual connection. By running Meyda locally and streaming *only* the extracted, lightweight parameters via WebRTC DataChannels, the audio-visual synchronicity feels razor-sharp.

Four key features drive the synthesis:
- **Energy (RMS)** — Overall amplitude and visceral intensity, mapped directly to `noise_scale`.
- **Spectral Centroid** — Brightness and tonal quality, influencing the prompt's aesthetic modifiers.
- **Zero-Crossing Rate** — A noisiness indicator dictating texture and grit.
- **Beat Detection** — Energy-based BPM detection that triggers rhythmic, euphoric parameter boosts.

## 🗺️ The Mapping Engine & 15 Worlds

The mapping engine acts as the creative translator, bridging raw audio math to Scope's generation parameters. Energy acts as the lifeblood driving the `noise_scale` (typically peaking between 0.48-0.72), controlling the evolutionary distance between frames. Too low, and the world freezes. Too high, and the space descends into chaos. Beat detection triggers momentary noise pulses, allowing you to physically *feel* the rhythm on screen without succumbing to jarring visual churn.

Each theme is a self-contained ecosystem—a bespoke parameter mapping defining how that specific world breathes with the music. **The 15 Worlds**:
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

*Note: Soundscape features an **Auto Theme Timeline**—a dynamic director that automatically rotates through these worlds, aligning scene changes with musical phrasing and structural beat-sections.*

## 🎞️ Latent Cache & Seamless Transitions

Scope maintains a latent cache—the deep mathematical representation of the previous generation. Each new frame uses that cached state as its seed. This fundamental architecture ensures the world feels continuous, solid, and real, rather than a flickering slideshow of disconnected ideas.

When the aesthetic shifts (be it a theme switch, a massive energy spike, or a beat pulse), SLERP (Spherical Linear Interpolation) gracefully blends the latent representations across 8 frames. There are no hard cuts, even during the most explosive musical drops.

`manage_cache` is permanently engaged. The result is continuous evolution that feels deeply intentional and profoundly musical. Play the same track through different themes, and you embark on completely distinct visual journeys.

## ⚙️ The Infrastructure

- **Frontend**: Next.js 16 + TypeScript + Tailwind 4.
- **Analysis**: Local browser execution via Meyda.
- **Communication**: Bleeding-edge WebRTC streaming to Daydream Scope.
- **Compute**: Heavy lifting inference powered by RunPod RTX PRO 6000 (96GB VRAM) or RTX 5090 using the high-fidelity `longlive` pipeline.

## 🤖 The Origin Story

The entirety of the Soundscape application was "vibe coded" in a symbiotic partnership with Claude Code, OpenAI Codex, and Antigravity. There was no traditional, rigid development cycle—only pure ideation, rapid iteration, and fluid AI-assisted implementation. The barrier between a wild idea and a living, breathing application is collapsing. Soundscape is proof of what happens when you remove the friction between human imagination and machine execution.
