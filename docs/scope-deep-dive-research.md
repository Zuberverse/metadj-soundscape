# Daydream Scope Platform: Deep Dive Research

**Last Modified**: 2026-02-12 20:29 EST
**Purpose**: Comprehensive intelligence on Scope API, pipelines, WebRTC protocol, and integration opportunities for MetaDJ Soundscape.
**Sources**: DeepWiki analysis of `daydreamlive/scope` repo, official GitHub docs (`server.md`, `vace.md`, `lora.md`, `vae.md`), existing Soundscape codebase.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [REST API Endpoints (Complete Reference)](#rest-api-endpoints)
3. [WebRTC Data Channel Protocol](#webrtc-data-channel-protocol)
4. [Pipeline Catalog](#pipeline-catalog)
5. [Preprocessor Pipelines and Chaining](#preprocessor-pipelines-and-chaining)
6. [VACE Conditioning System](#vace-conditioning-system)
7. [LoRA Customization System](#lora-customization-system)
8. [VAE Type Selection](#vae-type-selection)
9. [Prompt Blending and Timeline System](#prompt-blending-and-timeline-system)
10. [Performance Tuning Parameters](#performance-tuning-parameters)
11. [Plugin System](#plugin-system)
12. [Spout Integration](#spout-integration)
13. [Assets API](#assets-api)
14. [Pipeline Load Request Schema](#pipeline-load-request-schema)
15. [Pipeline Schemas Response](#pipeline-schemas-response)
16. [Soundscape Gap Analysis](#soundscape-gap-analysis)
17. [Integration Opportunities (Prioritized)](#integration-opportunities)

---

## Executive Summary

Scope is a real-time, interactive AI video generation server built on autoregressive video diffusion models (primarily Wan2.1). The platform runs as a FastAPI server exposing REST endpoints for pipeline management and WebRTC for real-time video streaming with parameter control via data channels.

**Current Scope version**: `0.1.0-beta.3`

**Key findings for Soundscape**:

| Category | What We Use | What We're Missing |
|----------|-------------|-------------------|
| **REST API** | 8 of 14 endpoints | Assets API (upload/list/serve), Models download, Pipeline schemas metadata |
| **Data Channel Params** | 7 of 22+ parameters | LoRA scales, VACE params, spout config, paused, kv_cache_attention_bias, input_mode, images, ctrl_input, first/last frame |
| **Pipelines** | longlive only | streamdiffusionv2, krea-realtime-video, memflow, reward-forcing, preprocessors |
| **Features** | Prompt + noise + denoising | VACE reference images, LoRA runtime, VAE selection, pipeline chaining, asset management |

---

## REST API Endpoints

### Currently Used by Soundscape

| Endpoint | Method | Soundscape File | Status |
|----------|--------|----------------|--------|
| `/health` | GET | `client.ts` | Implemented |
| `/api/v1/pipeline/load` | POST | `client.ts` | Implemented (with `pipeline_ids` array + legacy fallback) |
| `/api/v1/pipeline/status` | GET | `client.ts` | Implemented |
| `/api/v1/pipelines/schemas` | GET | `client.ts` | Implemented (parses descriptors) |
| `/api/v1/webrtc/ice-servers` | GET | `client.ts` | Implemented |
| `/api/v1/webrtc/offer` | POST | `client.ts` | Implemented |
| `/api/v1/webrtc/offer/{session_id}` | PATCH | `client.ts` | Implemented (trickle ICE) |
| `/api/v1/hardware/info` | GET | `client.ts` | Implemented |
| `/api/v1/models/status` | GET | `client.ts` | Implemented |
| `/api/v1/lora/list` | GET | `client.ts` | Implemented |
| `/api/v1/plugins` | GET | `client.ts` | Implemented |

### NOT Used by Soundscape

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/api/v1/models/download` | POST | Trigger model download for a pipeline | Low (server-side concern) |
| `/api/v1/assets` | GET | List available images/videos on server | **High** (needed for VACE) |
| `/api/v1/assets` | POST | Upload asset files (images/videos) | **High** (needed for VACE ref images) |
| `/api/v1/assets/{path}` | GET | Serve/retrieve asset file | Medium |
| `/docs` | GET | Swagger UI documentation | N/A (dev tool) |

### Endpoint Details

#### GET /health

```json
// Response
{ "status": "healthy", "timestamp": "..." }
```

Soundscape maps this to `{ status: "ok" | "error", version?, gpu?, vram? }`.

#### POST /api/v1/pipeline/load

```json
// Request
{
  "pipeline_ids": ["video-depth-anything", "longlive"],
  "load_params": {
    "height": 320,
    "width": 576,
    "seed": 42,
    "vace_enabled": true,
    "vae_type": "lightvae",
    "quantization": "fp8_e4m3fn",
    "loras": [{ "path": "/path/to/lora.safetensors", "scale": 0.8 }],
    "lora_merge_mode": "runtime_peft"
  }
}
// Response
{ "message": "Pipeline loading initiated successfully" }
```

**Key detail**: `pipeline_ids` is an **array** supporting pipeline chaining. First entry can be a preprocessor.

#### GET /api/v1/pipeline/status

```json
// Response
{
  "status": "loaded",            // "not_loaded" | "loading" | "loaded" | "error" | "idle" | "unloading"
  "pipeline_id": "longlive",
  "load_params": { ... },
  "loaded_lora_adapters": [...]
}
```

#### GET /api/v1/pipelines/schemas

Returns a rich metadata object per pipeline. See [Pipeline Schemas Response](#pipeline-schemas-response) section.

#### POST /api/v1/webrtc/offer

```json
// Request
{
  "sdp": "...",
  "type": "offer",
  "initialParameters": {
    "prompts": [{ "text": "cosmic dreamscape", "weight": 1.0 }],
    "denoising_step_list": [1000, 750, 500, 250],
    "noise_scale": 0.5,
    "manage_cache": true,
    "input_mode": "text"
  }
}
// Response
{ "sdp": "...", "type": "answer", "sessionId": "uuid-here" }
```

#### PATCH /api/v1/webrtc/offer/{session_id}

```json
// Request
{ "candidates": [{ "candidate": "...", "sdpMid": "0", "sdpMLineIndex": 0 }] }
// Response: 204 No Content
```

#### GET /api/v1/models/status

```
GET /api/v1/models/status?pipeline_id=longlive
```

```json
// Response
{ "downloaded": true, "progress": null }
```

#### POST /api/v1/models/download

```json
// Request
{ "pipeline_id": "longlive" }
// Response
{ "message": "Model download started for longlive" }
```

#### GET /api/v1/lora/list

```json
// Response
{
  "lora_files": [
    {
      "name": "arcane-jinx",
      "path": "/home/user/.daydream-scope/models/lora/arcane-jinx.safetensors",
      "size_mb": 123.45,
      "folder": null
    }
  ]
}
```

#### GET /api/v1/assets

```
GET /api/v1/assets?type=image   // Filter by "image" or "video"
```

```json
// Response
{
  "assets": [
    {
      "name": "reference-face",
      "path": "/path/to/assets/reference-face.png",
      "size_mb": 1.2,
      "folder": null,
      "type": "image",
      "created_at": 1678886400
    }
  ]
}
```

#### POST /api/v1/assets

```
POST /api/v1/assets?filename=my-reference.png
Content-Type: application/octet-stream
Body: [raw file bytes]
```

```json
// Response
{ "path": "/path/to/assets/my-reference.png" }
```

The returned `path` is then used as `vace_ref_images[0]` or `first_frame_image`.

#### GET /api/v1/hardware/info

```json
// Response
{
  "gpu_name": "NVIDIA RTX 6000",
  "total_vram_mb": 49152,
  "free_vram_mb": 32768,
  "spout_available": false
}
```

---

## WebRTC Data Channel Protocol

### Channel Configuration

- **Name**: `"parameters"`
- **Ordered**: `true`
- **Direction**: Bidirectional (client sends params, server sends status messages)

### Complete Parameter Schema (Client to Server)

Every field is optional. Send only what changed.

```typescript
interface DataChannelParameters {
  // === PROMPTS ===
  /** Active prompts with weights. Up to 4 prompts for blending. */
  prompts?: Array<{ text: string; weight: number }>;

  /** How multiple prompts are blended spatially: "linear" or "slerp".
   *  Slerp only works with exactly 2 prompts. */
  prompt_interpolation_method?: "linear" | "slerp";

  /** Smooth transition between current and target prompts over N frames. */
  transition?: {
    target_prompts: Array<{ text: string; weight: number }>;
    num_steps: number;          // 0 = instant, 4 = default
    temporal_interpolation_method: "linear" | "slerp";
  };

  // === GENERATION CONTROL ===
  /** Denoising timestep schedule. Descending order. More steps = higher quality, slower. */
  denoising_step_list?: number[];

  /** Noise injection scale (0.0-1.0). Higher = more variation. */
  noise_scale?: number;

  /** Auto-adjust noise based on motion detection. Overrides manual noise_scale. */
  noise_controller?: boolean;

  /** Input mode: "text" for t2v, "video" for v2v. Triggers VAE cache reset. */
  input_mode?: "text" | "video";

  // === CACHE MANAGEMENT ===
  /** Auto-reset cache on parameter changes (default: true). */
  manage_cache?: boolean;

  /** One-shot manual cache reset trigger. */
  reset_cache?: boolean;

  /** KV cache attention bias (0.01-1.0, log scale). Lower = less reliance on past frames. */
  kv_cache_attention_bias?: number;

  // === STREAM CONTROL ===
  /** Pause/unpause frame generation without unloading pipeline. */
  paused?: boolean;

  /** Pipeline IDs to execute in chain (runtime pipeline switching). */
  pipeline_ids?: string[];

  // === LORA ===
  /** Update LoRA adapter scales at runtime (requires runtime_peft merge mode). */
  lora_scales?: Array<{
    path: string;    // Must match a loaded LoRA
    scale: number;   // -10.0 to 10.0
  }>;

  // === VACE ===
  /** Enable/disable VACE conditioning. */
  vace_enabled?: boolean;

  /** Reference image file paths for R2V mode. Currently single image only. */
  vace_ref_images?: string[];

  /** Use input video for VACE conditioning (v2v mode). */
  vace_use_input_video?: boolean;

  /** VACE hint injection strength (0.0-2.0, default 1.0). */
  vace_context_scale?: number;

  /** First frame reference for Extension mode. */
  first_frame_image?: string;

  /** Last frame reference for Extension mode. */
  last_frame_image?: string;

  // === IMAGE INPUT ===
  /** Image paths for pipelines that support image input. */
  images?: string[];

  // === CONTROLLER INPUT ===
  /** Controller/keyboard input for interactive pipelines. */
  ctrl_input?: {
    button: string[];
    mouse: [number, number];
  };

  // === SPOUT (Windows only) ===
  /** Spout video output configuration. */
  spout_sender?: { enabled: boolean; name: string };

  /** Spout video input configuration. */
  spout_receiver?: { enabled: boolean; name: string };
}
```

### Server to Client Messages

```typescript
// Stream stopped notification
{
  "type": "stream_stopped",
  "error_message"?: string  // Optional error details
}
```

**Currently handled**: Soundscape's `use-scope-connection.ts` parses `stream_stopped` messages and triggers disconnect/reconnect logic.

### What Soundscape Currently Sends

From `mapping-engine.ts` `formatParams()`:

```typescript
{
  prompts: [{ text: "...", weight: 1.0 }],
  denoising_step_list: [1000, 750, 500, 250],
  noise_scale: 0.45,
  noise_controller: false,
  manage_cache: true,
  paused: false,
  transition?: { target_prompts, num_steps, temporal_interpolation_method }
}
```

**7 of 22+ possible parameters used.** The remaining 15+ parameters represent untapped capabilities.

---

## Pipeline Catalog

### Video Diffusion Pipelines

| Pipeline ID | Name | Base Model | VRAM (est.) | VACE | LoRA | Default Mode | Use Case |
|------------|------|------------|-------------|------|------|-------------|----------|
| `streamdiffusionv2` | StreamDiffusionV2 | Wan2.1 1.3B | 20 GB | Yes | Yes | video | Fast v2v, bidirectional |
| `longlive` | LongLive | Wan2.1 1.3B | 20 GB | Yes | Yes | text | Long-duration, smooth switching |
| `krea-realtime-video` | Krea Realtime Video | Wan2.1 14B | 32 GB (40+ rec.) | Yes | Yes | text | Highest quality t2v |
| `memflow` | MemFlow | Wan2.1 1.3B | 20 GB | Yes | Yes | text | Memory bank, temporal consistency |
| `reward-forcing` | RewardForcing | Wan2.1 1.3B | 20 GB | Yes | Yes | text/video | Reward-optimized generation |

### Utility/Preprocessor Pipelines

| Pipeline ID | Name | Usage Type | Purpose |
|------------|------|-----------|---------|
| `passthrough` | Passthrough | Utility | Camera/input passthrough, no AI processing |
| `video-depth-anything` | Video Depth Anything | **Preprocessor** | Real-time depth estimation from video |
| `controller-viz` | Controller Viz | Utility | Visualize WASD keyboard and mouse inputs |

### Plugin Pipelines

| Pipeline ID | Name | Notes |
|------------|------|-------|
| `waypoint-1` | Waypoint-1 | Available via plugin system |

### LoRA Compatibility

- **Wan2.1-T2V-1.3B LoRAs**: streamdiffusionv2, longlive, reward-forcing, memflow
- **Wan2.1-T2V-14B LoRAs**: krea-realtime-video

**Soundscape currently uses**: `longlive` only. All other pipelines are untapped.

---

## Preprocessor Pipelines and Chaining

### How Pipeline Chaining Works

Pipeline chaining allows sequential processing where one pipeline's output feeds into the next. This is configured by passing multiple `pipeline_ids` in the load request.

```json
{
  "pipeline_ids": ["video-depth-anything", "longlive"],
  "load_params": {
    "vace_enabled": true,
    "vace_use_input_video": true
  }
}
```

**Chain flow**: Input Video --> `video-depth-anything` (depth map) --> `longlive` (VACE V2V with depth conditioning)

### Available Preprocessors

Currently only **`video-depth-anything`** is available as a built-in preprocessor. Additional preprocessors (optical-flow, scribble, gray) are documented as planned but available only through plugins.

### Frontend Preprocessor Selection

The Scope frontend shows a "Preprocessor Selector" for pipelines that support VACE. The selector filters available pipelines by the `preprocessor` usage type and current input mode compatibility.

**Soundscape impact**: Pipeline chaining opens the door to depth-conditioned audio-reactive generation. A camera input processed through depth estimation could drive structurally-consistent AI video that reacts to music.

---

## VACE Conditioning System

### Overview

VACE (Video All-in-one Creation and Editing) provides reference-guided video generation through four conditioning modes:

| Mode | Description | Parameters Used |
|------|-------------|----------------|
| **R2V** (Reference-to-Video) | Guide style/character from 1-3 reference images | `vace_ref_images` |
| **Depth** | Structural guidance from depth/flow/pose maps | `vace_use_input_video` + preprocessor |
| **Inpainting** | Generate within masked regions | `vace_input_frames`, `vace_input_masks` |
| **Extension** | Temporal extension from first/last frame | `first_frame_image`, `last_frame_image` |

### Parameters

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `vace_enabled` | boolean | - | Must be `true` during pipeline load for VACE availability |
| `vace_ref_images` | string[] | - | File paths to reference images (currently single image only) |
| `vace_context_scale` | float | 0.0-2.0 | Strength of VACE hint injection (default 1.0) |
| `vace_use_input_video` | boolean | - | Use webcam/video input for VACE conditioning |
| `first_frame_image` | string | - | Path to first frame reference (Extension mode) |
| `last_frame_image` | string | - | Path to last frame reference (Extension mode) |

### VACE + Pipeline Compatibility

| Pipeline | VACE Support | Notes |
|----------|-------------|-------|
| longlive | Yes | Full R2V, depth, extension |
| streamdiffusionv2 | Yes | With noted quality limitations |
| memflow | Yes | Full support |
| reward-forcing | Yes | Full support |
| krea-realtime-video | Yes | Requires ~55GB VRAM with VACE |

### Constraints

- **FP8 quantization NOT supported with VACE**
- **KREA + VACE requires ~55GB VRAM**
- **Only single reference images currently supported** (multi-ref planned)
- Reference images uploaded via `/api/v1/assets` POST, then paths used in data channel
- Can be set as `initialParameters` during WebRTC offer or updated via data channel

### Soundscape Integration Opportunity

VACE reference images could enable "visual anchoring" for themes -- upload a reference image per theme that guides the visual style while audio reactivity controls the dynamics. This would solve the problem of generation drifting too far from intended aesthetics.

---

## LoRA Customization System

### Loading Modes

| Mode | Setting | Runtime Updates | FPS Impact | Use Case |
|------|---------|----------------|------------|----------|
| **permanent_merge** | `lora_merge_mode: "permanent_merge"` | No (pipeline reload required) | None (weights merged) | Production, fixed style |
| **runtime_peft** | `lora_merge_mode: "runtime_peft"` | Yes (instant via data channel) | 20-40% FPS reduction | Dynamic style mixing |

### Configuration at Pipeline Load

```json
{
  "pipeline_ids": ["longlive"],
  "load_params": {
    "loras": [
      { "path": "/home/user/.daydream-scope/models/lora/arcane.safetensors", "scale": 0.8 },
      { "path": "/home/user/.daydream-scope/models/lora/ghibli.safetensors", "scale": 0.5 }
    ],
    "lora_merge_mode": "runtime_peft"
  }
}
```

### Runtime Scale Updates (via Data Channel)

```json
{
  "lora_scales": [
    { "path": "/path/to/arcane.safetensors", "scale": 1.2 },
    { "path": "/path/to/ghibli.safetensors", "scale": 0.3 }
  ]
}
```

Scale range: **-10.0 to 10.0** (negative values invert the LoRA effect).

### LoRA File Location

`~/.daydream-scope/models/lora/` (and subdirectories). Configurable via `DAYDREAM_SCOPE_MODELS_DIR` environment variable. Supported formats: `.safetensors`, `.bin`, `.pt`.

### Recommended LoRAs

- **1.3B models**: Arcane Jinx, Genshin TCG
- **14B models** (krea): Origami, Film Noir, Pixar

### Soundscape Integration Opportunity

LoRA scales could be mapped to audio features for style morphing. For example, bass energy increases "abstract" LoRA while treble increases "crystalline" LoRA. With `runtime_peft`, these transitions happen in under 1 second.

---

## VAE Type Selection

VAE type is a **load-time parameter** (requires pipeline reload to change).

| Type | Quality | Speed | VRAM | Description |
|------|---------|-------|------|-------------|
| `wan` | Best | Slow | High | Full WanVAE, no pruning |
| `lightvae` | High | Medium | Medium | 75% pruned, balanced |
| `tae` | Average | Fast | Low | Lightweight temporal architecture |
| `lighttae` | High | Fast | Low | TAE with WanVAE normalization |

### Configuration

```json
{
  "pipeline_ids": ["longlive"],
  "load_params": {
    "vae_type": "lightvae"
  }
}
```

### Recommendation for Soundscape

Use `lightvae` for the best speed/quality tradeoff. Use `tae` for maximum FPS during development/testing. `wan` only for final renders where latency is acceptable.

**Soundscape currently does not set `vae_type`** -- it uses whatever the server default is. We should explicitly set this.

---

## Prompt Blending and Timeline System

### Spatial Blending (Multiple Simultaneous Prompts)

Up to 4 prompts can be blended simultaneously. Each has a `weight` value that is normalized before blending.

| Method | Prompts Supported | Characteristics |
|--------|------------------|-----------------|
| `linear` | 1-4 | Element-wise weighted average, computationally efficient |
| `slerp` | Exactly 2 | Spherical interpolation, sharper transitions, preserves embedding magnitude |

### Temporal Transitions

Smooth animation between prompt states across multiple frames.

```json
{
  "transition": {
    "target_prompts": [
      { "text": "new prompt here", "weight": 1.0 }
    ],
    "num_steps": 4,
    "temporal_interpolation_method": "slerp"
  }
}
```

- `num_steps: 0` = instant change
- `num_steps: 4` = default smooth transition
- Soundscape uses 5-6 steps for prompt changes, 6 for theme changes

### Timeline JSON Format (v2.1)

The Scope frontend supports exporting/importing timeline sequences:

```json
{
  "version": "2.1",
  "exportedAt": "2026-01-15T...",
  "prompts": [
    {
      "startTime": 0,
      "endTime": 30,
      "prompts": [{ "text": "cosmic dreamscape", "weight": 100 }]
    }
  ],
  "settings": {
    "pipelineId": "longlive",
    "inputMode": "text",
    "resolution": { "width": 576, "height": 320 },
    "seed": 42,
    "denoisingSteps": [1000, 750, 500, 250],
    "noiseScale": 0.5,
    "noiseController": false,
    "manageCache": true,
    "quantization": null,
    "kvCacheAttentionBias": 1.0,
    "loras": [],
    "loraMergeStrategy": "permanent_merge"
  }
}
```

### Soundscape Integration

Soundscape already uses prompt blending and slerp transitions extensively. The mapping engine constructs multi-prompt blends (base + accent) and uses `PromptTransition` for theme changes and energy spikes.

**Opportunity**: Export Soundscape sessions as Timeline JSON for replay or editing in the Scope frontend.

---

## Performance Tuning Parameters

### Load-Time Parameters (Require Pipeline Reload)

| Parameter | Type | Values | Impact |
|-----------|------|--------|--------|
| `width` / `height` | int | Divisible by 16 | Quadratic impact on VRAM and speed |
| `quantization` | string | `"fp8_e4m3fn"` or null | ~30% VRAM reduction |
| `vae_type` | string | `wan`, `lightvae`, `tae`, `lighttae` | Speed vs quality tradeoff |
| `vace_enabled` | boolean | - | 5-30% overhead depending on mode |
| `lora_merge_mode` | string | `permanent_merge`, `runtime_peft` | `runtime_peft` adds 20-40% FPS overhead |
| `seed` | int | - | Deterministic generation |

### Runtime Parameters (Via Data Channel)

| Parameter | Type | Range | Impact | Soundscape Uses |
|-----------|------|-------|--------|----------------|
| `noise_scale` | float | 0.0-1.0 | Higher = more variation | **Yes** |
| `noise_controller` | boolean | - | Auto noise based on motion | **Yes** (set to false) |
| `denoising_step_list` | int[] | Descending | Fewer steps = faster, lower quality | **Yes** |
| `manage_cache` | boolean | - | Auto cache reset on param change | **Yes** (true) |
| `reset_cache` | boolean | - | One-shot manual cache reset | No (deliberate) |
| `kv_cache_attention_bias` | float | 0.01-1.0 | Lower = less past-frame influence | **No** |
| `paused` | boolean | - | Pause generation | **Yes** (false) |
| `lora_scales` | array | -10 to 10 per entry | Runtime LoRA strength | **No** |
| `vace_context_scale` | float | 0.0-2.0 | VACE hint strength | **No** |

### Recommended Configurations

**High Performance (RTX 3090/4090, 24GB)**:
```json
{
  "width": 576, "height": 320,
  "vae_type": "lightvae",
  "quantization": null,
  "vace_enabled": false,
  "lora_merge_mode": "permanent_merge"
}
```

**Maximum Quality (A100/H100, 40GB+)**:
```json
{
  "width": 832, "height": 480,
  "vae_type": "wan",
  "quantization": null,
  "vace_enabled": true,
  "lora_merge_mode": "runtime_peft"
}
```

**VRAM Constrained (RTX 3060, 12GB)**:
```json
{
  "width": 320, "height": 576,
  "vae_type": "tae",
  "quantization": "fp8_e4m3fn",
  "vace_enabled": false,
  "lora_merge_mode": "permanent_merge"
}
```

---

## Plugin System

The plugin system is currently in **preview** (feature-flagged). Key capabilities:

- **Extends Scope** by registering new pipeline implementations
- **Dynamic loading** at application startup via `PipelineRegistry`
- **Dependency validation** before installation (prevents environment corruption)
- **CLI commands** (hidden behind preview flag):
  - `plugins` -- list installed plugins
  - `install` -- install new plugins with dependency checking

### Plugin-Related Endpoints

Soundscape already queries `/api/v1/plugins` via `getPlugins()` method. This returns plugin descriptors with id, name, version, enabled status, and source.

### Known Plugin Pipelines

- **Waypoint-1**: Available via plugin system (details sparse in codebase)
- Additional preprocessors planned as plugins: optical-flow, scribble, gray

---

## Spout Integration

**Platform**: Windows only.

Spout enables real-time video sharing between applications (Scope, TouchDesigner, OBS, Unity, etc.).

### Parameters (via Data Channel)

```json
{
  "spout_sender": { "enabled": true, "name": "ScopeOutput" },
  "spout_receiver": { "enabled": true, "name": "TouchDesignerOut" }
}
```

### How It Works

- **Sender**: Scope sends processed frames to other Spout-compatible apps via a dedicated background thread. Overhead: <1%.
- **Receiver**: Scope receives frames from external Spout sources as pipeline input. Overhead: 2-5%.
- Both run in separate threads to avoid blocking the main pipeline.

### Soundscape Relevance

Low priority for web-based deployment. Relevant only if Soundscape ever runs alongside TouchDesigner or similar tools on a Windows machine for live performance.

---

## Assets API

### Upload Flow for VACE References

1. **Upload**: `POST /api/v1/assets?filename=theme-reference.png` with raw image bytes
2. **Get path**: Response returns `{ "path": "/path/to/assets/theme-reference.png" }`
3. **Use in data channel**: Send `{ "vace_ref_images": ["/path/to/assets/theme-reference.png"] }`

### List Assets

```
GET /api/v1/assets?type=image
```

Returns array of `{ name, path, size_mb, folder, type, created_at }`.

### Soundscape Integration

To implement VACE, Soundscape needs:
1. Asset upload capability in the client (`ScopeClient.uploadAsset()`)
2. Asset listing for reference image selection
3. Data channel parameter extension for `vace_ref_images`

---

## Pipeline Load Request Schema

### Common Load Parameters

```typescript
interface PipelineLoadParams {
  height?: number;           // Must be divisible by 16
  width?: number;            // Must be divisible by 16
  seed?: number;
  quantization?: "fp8_e4m3fn" | null;
  vace_enabled?: boolean;
  vae_type?: "wan" | "lightvae" | "tae" | "lighttae";
  loras?: Array<{ path: string; scale: number; merge_mode?: string }>;
  lora_merge_mode?: "permanent_merge" | "runtime_peft";
}
```

### Pipeline-Specific Extensions

Each pipeline may define additional load parameters. The schemas endpoint reveals what each pipeline accepts.

---

## Pipeline Schemas Response

### Response Format

```typescript
interface PipelineSchemasResponse {
  pipelines: Record<string, PipelineSchemaInfo>;
}

interface PipelineSchemaInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  docs_url?: string;
  estimated_vram_gb?: number;
  requires_models?: boolean;
  supports_lora?: boolean;
  supports_vace?: boolean;
  usage?: string[];                    // ["text-to-video", "video-to-video"]
  config_schema?: object;              // Full JSON schema for load params
  supported_modes?: string[];          // ["text", "video"]
  default_mode?: string;               // "text" or "video"
  supports_prompts?: boolean;
  default_temporal_interpolation_method?: string;
  default_temporal_interpolation_steps?: number;
  mode_defaults?: object;
  supports_cache_management?: boolean;
  supports_kv_cache_bias?: boolean;
  supports_quantization?: boolean;
  min_dimension?: number;
  recommended_quantization_vram_threshold?: number;
  modified?: boolean;
}
```

### What Soundscape Parses

Currently, `getPipelineDescriptors()` in `client.ts` extracts:
- `id`, `name`, `description`, `version`
- `usage`, `supportsVace`, `supportsLora`
- `estimatedVramGb`, `source` (builtin/plugin)

**Missing extractions**: `supported_modes`, `default_mode`, `supports_cache_management`, `supports_kv_cache_bias`, `supports_quantization`, `min_dimension`, `default_temporal_interpolation_method`, `default_temporal_interpolation_steps`, `mode_defaults`, `config_schema`.

---

## Soundscape Gap Analysis

### What We Have (Solid Foundation)

| Feature | Implementation Quality | Notes |
|---------|----------------------|-------|
| REST API client | Excellent | 11 endpoints, timeout handling, error recovery, legacy fallback |
| WebRTC session management | Excellent | Full ICE handling, trickle ICE retry, session cleanup |
| Connection hook | Excellent | State machine, reconnection, error classification |
| Data channel protocol | Good | Rate-limited sender (30Hz), parameter formatting |
| Audio analysis | Excellent | Meyda-based, beat detection, energy/brightness/texture |
| Mapping engine | Excellent | Theme system, prompt blending, slerp transitions, smoothing |
| Theme system | Excellent | 5 presets, custom themes, reactivity profiles, denoising profiles |

### What We're Missing (Opportunity Map)

| Feature | Gap Severity | Effort | Impact |
|---------|-------------|--------|--------|
| **VACE reference images** | High | Medium | Visual anchoring per theme |
| **LoRA runtime scales** | High | Low | Audio-reactive style morphing |
| **VAE type selection** | Medium | Low | Performance control in settings |
| **KV cache attention bias** | Medium | Low | Reduce temporal repetition |
| **Assets API** | High | Medium | Required for VACE images |
| **Pipeline selection UI** | Medium | Medium | Let users choose pipelines |
| **Pipeline chaining** | Low | High | Depth-conditioned generation |
| **input_mode switching** | Medium | Low | Text vs video mode toggle |
| **Model download trigger** | Low | Low | Convenience for cloud deploys |
| **Pipeline schema parsing** | Medium | Low | Better pipeline-aware UI |
| **Spout I/O** | Very Low | Low | Windows-only, niche |
| **ctrl_input / images** | Very Low | Low | Interactive pipelines |

---

## Integration Opportunities

### Priority 1: Quick Wins (Low Effort, High Value)

#### 1.1 KV Cache Attention Bias (Audio-Reactive)

Map `kv_cache_attention_bias` to energy derivative. During calm passages, higher bias (0.7-1.0) maintains smooth continuity. During drops/builds, lower bias (0.1-0.3) allows fresh generation.

```typescript
// In formatParams():
kv_cache_attention_bias: mapRange(1 - derived.energy, 0.15, 0.85)
```

**Effort**: Add 1 line to formatParams. **Impact**: Reduces repetitive motion, more dynamic visuals.

#### 1.2 VAE Type in Load Params

Add `vae_type` to the pipeline load request. Default to `lightvae` for best speed/quality.

```typescript
// In pipeline.ts:
loadParams: { ...existingParams, vae_type: "lightvae" }
```

**Effort**: Add 1 field. **Impact**: Explicit performance control.

#### 1.3 LoRA Scale Mapping

If LoRAs are loaded with `runtime_peft`, map audio features to LoRA scales:

```typescript
// In data channel params:
lora_scales: [
  { path: loadedLoras[0].path, scale: lerp(0.3, 1.0, derived.energy) }
]
```

**Effort**: Add data channel field + UI for LoRA selection. **Impact**: Audio-reactive style morphing.

### Priority 2: Medium Investment, High Reward

#### 2.1 VACE Reference Images per Theme

Each Soundscape theme could include a reference image that anchors the visual style:

```typescript
interface Theme {
  // ... existing fields
  vaceReferenceImage?: string;  // Asset path on Scope server
}
```

Implementation requires:
1. `ScopeClient.uploadAsset(file)` method
2. `ScopeClient.listAssets()` method
3. Send `vace_ref_images` in data channel when theme activates
4. Set `vace_enabled: true` in load params

**Effort**: ~2-3 hours. **Impact**: Visual consistency breakthrough -- themes look consistent while still reacting to audio.

#### 2.2 Pipeline Selection

Let users choose between pipelines based on their GPU:

| GPU VRAM | Recommended Pipeline | VAE | Quantization |
|----------|---------------------|-----|--------------|
| 24 GB | longlive | lightvae | none |
| 32 GB | krea-realtime-video | lightvae | none |
| 40+ GB | krea-realtime-video | wan | none |
| 12-16 GB | longlive | tae | fp8_e4m3fn |

**Effort**: ~1-2 hours for settings UI. **Impact**: Better hardware utilization.

#### 2.3 Input Mode Toggle

Add text-to-video mode alongside the current camera-less operation:

```typescript
// Data channel:
{ input_mode: "text" }  // Pure prompt-driven generation
{ input_mode: "video" } // Camera/video input transformation
```

**Effort**: ~1 hour. **Impact**: Opens webcam-reactive visuals.

### Priority 3: Advanced Features

#### 3.1 Pipeline Chaining with Depth Preprocessing

```json
{
  "pipeline_ids": ["video-depth-anything", "longlive"],
  "load_params": { "vace_enabled": true, "vace_use_input_video": true }
}
```

Webcam input --> depth map --> VACE-conditioned generation. The depth structure maintains spatial coherence while the AI transforms everything.

**Effort**: ~4-6 hours. **Impact**: Professional-grade depth-aware generation.

#### 3.2 Timeline Export

Export a Soundscape session as a Scope Timeline JSON for editing:

```typescript
function exportTimeline(sessionHistory: SessionEvent[]): TimelineJSON {
  return {
    version: "2.1",
    exportedAt: new Date().toISOString(),
    prompts: sessionHistory.map(event => ({
      startTime: event.timestamp,
      endTime: event.endTimestamp,
      prompts: event.params.prompts
    })),
    settings: { pipelineId: "longlive", ... }
  };
}
```

**Effort**: ~2-3 hours. **Impact**: Session replay, editing, sharing.

---

## TL;DR

**What**: Complete Scope platform deep dive -- 14 REST endpoints, 22+ data channel parameters, 8 pipelines, VACE/LoRA/VAE systems, pipeline chaining, and plugin architecture. All cross-referenced against what Soundscape currently implements.

**So what**: Soundscape uses 7 of 22+ available data channel parameters and 1 of 8 pipelines. The biggest untapped capabilities are VACE reference images (visual anchoring per theme), runtime LoRA scales (audio-reactive style morphing), and KV cache attention bias (reduces repetitive motion). Three quick wins require adding single fields to existing code. The VACE reference image integration is the highest-impact medium-effort opportunity -- it solves the fundamental problem of generation drifting from intended aesthetics.

**Key numbers**:
- **14** REST endpoints documented (11 implemented in Soundscape)
- **22+** data channel parameters (7 currently sent)
- **8** pipeline types (1 currently used: longlive)
- **4** VAE types available (none explicitly set)
- **4** VACE conditioning modes (none used)
- **0** LoRA integrations (runtime or permanent)

**Next action**: Start with the 3 quick wins (kv_cache_attention_bias, vae_type, LoRA scales), then implement VACE reference images per theme as the first major feature addition.
