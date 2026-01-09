# Scope Technical Overview

**Last Modified**: 2026-01-08 22:20 EST
**Status**: Active

## Purpose
Provide a technical reference for Scope capabilities that matter for Soundscape. Project decisions live in `docs/strategy.md`, `docs/architecture.md`, and `docs/features/soundscape-mvp-spec.md`.

---

## Scope Platform Capabilities

Scope is a real-time AI video generation platform built on StreamDiffusion. Core capabilities include:

- **Real-time AI video generation** via StreamDiffusion-based pipelines
- **Multiple pipeline options** with different output characteristics
- **Web-based UI** for interactive control (RunPod or local deployment)
- **API server** for programmatic control
- **WebRTC streaming** for low-latency delivery
- **LoRA adapter support** for custom model fine-tuning
- **Spout integration** for external tool routing (optional)

---

## Pipeline Options (Validated Dec 26)

| Pipeline | Output Style | VRAM Required | Best For |
|----------|--------------|---------------|----------|
| `longlive` | Stylized/Artistic | ~20GB | Smooth prompt transitions, audio-reactive visuals |
| `streamdiffusionv2` | Balanced | ~20GB | General-purpose generation |
| `krea-realtime-video` | Photorealistic | 32GB | Realistic visuals (square-only output) |
| `reward-forcing` | Experimental | TBD | Research/experimentation |
| `passthrough` | None | Minimal | Testing, debugging |

### `longlive` (Recommended for Soundscape)
- **Output**: Stylized, artistic generation
- **Best for**: Audio-reactive visuals with stable prompt transitions
- **Trade-off**: Slightly lower FPS vs smaller/faster pipelines

### `streamdiffusionv2`
- **Output**: Balanced between stylized and realistic
- **Best for**: Quick tests and square-only output

---

## Resolution & Performance Guide (Validated Dec 27)

Resolution is the **primary factor** affecting FPS. The GPU runs at 100% regardless—lower resolution means each frame computes faster.

### Daydream Default Resolutions (Official)

| Pipeline | Default (H×W) | Aspect |
|----------|---------------|--------|
| `longlive` | 576 × 320 | 9:16 Portrait |
| `streamdiffusionv2` | 512 × 512 | 1:1 Square |
| `krea-realtime-video` | 512 × 512 | 1:1 Square |

### Resolution vs FPS (Observed)

*Observed on an NVIDIA RTX 6000. Actual FPS varies by GPU, pipeline, and settings.*

| Resolution | Aspect | Pixels | Observed FPS* | Use Case |
|------------|--------|--------|---------------|----------|
| 320 × 576 | 9:16 (Portrait) | 184K | ~15-20 | Daydream default for longlive |
| 576 × 320 | 16:9 (Landscape) | 184K | ~15-20 | Soundscape default for widescreen |
| 512 × 512 | 1:1 (Square) | 262K | ~12-15 | Square outputs |
| 640 × 360 | 16:9 (Landscape) | 230K | ~10-15 | Larger demos, slower |

### Key Insights

1. **Pixel count matters most**: More pixels = lower FPS.
2. **Aspect ratio flexibility**: Scope accepts any resolution divisible by 64.
3. **Quality vs Speed trade-off**: Prioritize smoothness for live demos.

### Other Performance Factors

| Factor | Impact | Recommendation |
|--------|--------|----------------|
| **Denoising Steps** | High values slow inference | Use defaults for live demos |
| **Quantization** | `fp8` reduces precision for speed | Try only if FPS is critical |
| **Manage Cache** | Improves consistency | Keep ON |
