# MetaDJ Soundscape — Daydream Submission Prep

**Last Modified**: 2026-02-10 11:51 EST
**Status**: Historical Draft Reference

---

This document is preserved as submission-process history. For active technical guidance, use `docs/scope.md`, `docs/api-reference.md`, and `docs/architecture.md`.

## Submission Structure (Based on Frost Bytes Example)

The Daydream platform displays submissions with:

| Element | Required | Notes |
|---------|----------|-------|
| **Title** | Yes | Project name |
| **Creator Profile** | Auto | Pulled from Daydream account |
| **Hero Video** | Yes | Main video at top (with title overlay) |
| **Program Header** | Yes | "Daydream AI Video Program - Scope Track Project" |
| **Description** | Yes | Main project explanation |
| **Tags** | Yes | LongLive, Hosted, etc. |
| **Additional Media** | Optional | Images, diagrams, embedded repos |
| **GitHub Repo** | Optional | Link to source code |
| **Reactions/Comments** | Auto | Community engagement |

**Our Approach**: One highlight video + description only (no additional images/diagrams).

---

## Submission Content

### Title
**MetaDJ Soundscape**

### Tags
- `LongLive` (we use the longlive pipeline)
- `Hosted` (if deploying to a URL)

### Hero Video
**Requirements:**
- Single highlight video showing the experience
- Should capture: audio-reactive visual generation across multiple themes
- Ideal length: 30-90 seconds
- Should include the built-in demo track ("Metaversal Odyssey") for music

**Shot List Suggestions:**
1. Opening: Start with connection to Scope
2. Cosmic Voyage theme with building energy
3. Theme switch to Neon Foundry (show transition)
4. High energy moment with beat-reactive noise pulses
5. Theme switch to another theme (Digital Forest or Synthwave Highway)
6. Close with Crystal Sanctuary (calm, meditative)

---

## Description Options

### Option A: Technical Focus
```
MetaDJ Soundscape transforms music into real-time AI-generated visuals. Built entirely in the browser, it uses Meyda for audio feature extraction and streams parameters to Daydream Scope via WebRTC.

Audio analysis runs at ~86Hz, extracting energy, spectral centroid, and beat patterns. A mapping engine translates these features into Scope generation parameters—energy drives noise_scale for visual intensity, while beat detection triggers noise pulses for rhythmic response.

Twelve themed presets define how music maps to visuals:
• Cosmic Voyage — Neon digital space with energy-responsive noise
• Neon Foundry — Industrial AI interior with beat-driven pulses
• Digital Forest — Bioluminescent nature/tech hybrid
• Synthwave Highway — Retro-futuristic driving visuals
• Crystal Sanctuary — Meditative crystalline environments
• Ocean Depths — Bioluminescent underwater exploration
• Cyber City — Neon-drenched futuristic metropolis
• Aurora Dreams — Ethereal northern lights formations
• 8-Bit Adventure — Retro pixel art gaming worlds
• Volcanic Forge — Molten fire and ember landscapes
• Quantum Realm — Abstract particle physics dimensions
• Neon Tokyo — Japanese cyberpunk street racing

All transitions use SLERP blending for seamless visual flow—no hard cuts. The latent cache maintains frame-to-frame coherence while noise injection creates continuous evolution. Prompts are static per energy level; changes only occur on actual audio shifts.

Stack: Next.js 16 + TypeScript + Tailwind 4 + Meyda + WebRTC
```

### Option B: Experience Focus (Recommended)
```
MetaDJ Soundscape generates AI visuals that respond to music in real-time. Pick a theme, hit play, and watch the visuals evolve as the music plays.

The experience runs entirely in the browser. Audio analysis happens locally, extracting energy, brightness, and beats from whatever's playing. These musical features stream to Daydream Scope, where they drive the generation parameters frame-by-frame.

Twelve themed presets shape the visual journey—from cosmic neon to industrial foundry, underwater depths to Japanese cyberpunk streets. Each theme brings a unique aesthetic that responds differently to the music's energy and beats.

Every track tells a different story. Soundscape creates a visual journey that adapts to wherever the music goes—building with the build, breathing in the quiet moments, shifting when the energy shifts. The audience experiences something unique each time because the generation responds to what's actually happening in the audio.

Built for the Scope Track with Next.js, Meyda audio analysis, and WebRTC streaming.
```

### Option C: Minimal/Punchy
```
MetaDJ Soundscape transforms music into AI visuals in real-time.

Browser-based audio analysis extracts energy, brightness, and beats. These features stream to Scope via WebRTC, driving generation parameters frame-by-frame. Twelve themed presets shape how the music translates to visuals—from cosmic neon to underwater depths to Japanese cyberpunk streets.

The visuals don't just react to music—they evolve with it. Energy drives intensity. Beats trigger noise pulses. Prompt transitions stay smooth through SLERP blending. Every performance is unique because the AI responds to what the audio is actually doing in the moment.

Next.js + Meyda + WebRTC → Daydream Scope
```

---

## Technical Details (If Needed for Description)

### Architecture Summary
```
[Audio Input] → [Meyda Analysis] → [Mapping Engine] → [WebRTC DataChannel] → [Scope GPU]
                                                                                  ↓
[Browser Video] ← ──────────────── [RTCPeerConnection] ← ─────────────── [Generated Frames]
```

### Key Stats
- Audio analysis: ~86 Hz (Meyda)
- Parameter updates: 30 Hz (rate-limited)
- Video output: ~15-20 FPS (4-step denoising, 576×320)
- Pipeline: longlive
- Denoising: [1000, 750, 500, 250] (4-step)

### Stack
- Frontend: Next.js 16 + TypeScript + Tailwind 4
- Audio: Meyda library
- Video: WebRTC streaming
- Backend: Daydream Scope (StreamDiffusion) on RunPod

---

## Pre-Submission Checklist

- [ ] Record highlight video (30-90 seconds)
- [ ] Finalize description (choose Option A, B, or C)
- [ ] Verify app is accessible (if Hosted)
- [ ] Test video playback in submission preview
- [ ] Add GitHub repo link (optional)

---

## Notes

**What Frost Bytes Had (for reference):**
- Multiple progress update sections
- Technical architecture diagrams
- Blueprint screenshots
- GitHub repo card embed
- Conceptual mockups

**What We're Doing:**
- Single highlight video
- Focused description
- Clean, minimal submission

This keeps it tight and lets the video speak for itself.
