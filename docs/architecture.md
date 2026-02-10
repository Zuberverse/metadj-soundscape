# Architecture - MetaDJ Soundscape

**Last Modified**: 2026-02-10 12:04 EST
**Status**: Active

## Purpose

System design for MetaDJ Soundscape. Audio in, AI visuals out, real-time.

---

## UI Approach

**Page Structure (current)**:
- `/` redirects to `/soundscape`
- `/soundscape` — Full-screen dedicated page for music-reactive AI visuals

### Soundscape Page Design

Full-screen immersive experience optimized for video viewing:

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ [MetaDJ Soundscape]                         [● Live]          │
├────────────────────────────────────────────────────────────┤
│                                                                        │
│                    [Full-Height SoundscapeStudio]                      │
│                                                                        │
├────────────────────────────────────────────────────────────┤
│ MetaDJ Soundscape • Daydream Scope Track    Powered by StreamDiffusion │
└────────────────────────────────────────────────────────────┘
```

**Visual Features:**
- Subtle ambient background (soft cyan/purple glow)
- Branded header with gradient title
- Connection indicator with "Live/Offline" status
- Scope diagnostics panel before connect (health, version, pipeline state, refresh)
- Dynamic pipeline selector populated from Scope schemas
- Live telemetry overlay while streaming (pipeline, resolution, dropped-frame ratio)
- Bottom dock with compact audio + engine analysis meters

**Soundscape (current)**: Custom Next.js UI for in-browser audio analysis and parameter mapping. Modes: ambient (no audio) and demo track playback (looped).

---

## Soundscape System Flow

```
[Audio Input] -> [Audio Analyzer] -> [Mapping Engine] -> [WebRTC DataChannel] -> [Scope Pipeline]
                                                                              |
[Browser Video] <- [RTCPeerConnection Video Track] <- [Scope Server Output] <--+
```

### Audio Input Modes
- Demo track (built-in loop)
- Ambient mode (no audio)

### Core Components
- `src/lib/soundscape/audio-analyzer.ts` - Meyda-based feature extraction
- `src/lib/soundscape/mapping-engine.ts` - Audio-to-parameter mapping
- `src/lib/soundscape/use-soundscape.ts` - React orchestration + throttled UI updates
- `src/lib/scope/client.ts` - Scope API + WebRTC integration
- `src/lib/scope/webrtc.ts` - Shared WebRTC session helper
- `src/lib/scope/pipeline.ts` - Shared health + pipeline readiness helper
- `src/lib/scope/use-scope-connection.ts` - Shared connection lifecycle hook used by Soundscape for reconnection and cleanup
- `src/components/soundscape/*` - UI controls and visualization

### Shared Connection Hook

The `useScopeConnection` hook provides unified connection lifecycle management for Soundscape. The Soundscape layer handles audio state and reconnection behaviors.

```typescript
import { useScopeConnection, getScopeClient } from "@/lib/scope";

const {
  connectionState,  // "disconnected" | "connecting" | "connected" | "reconnecting" | "failed"
  statusMessage,    // Human-readable status
  error,            // ScopeError | null with typed error codes
  connect,          // Initiate connection
  disconnect,       // Clean disconnect
  retry,            // Retry after failure (resets attempts)
  clearError,       // Dismiss error
} = useScopeConnection({
  scopeClient: getScopeClient(),
  pipelineId: selectedPipeline,
  loadParams: { width: 576, height: 320, vace_enabled: false },
  onStream: (stream) => setVideoStream(stream),
  onDataChannelOpen: (channel) => setDataChannel(channel),
});
```

**Error Codes**: `HEALTH_CHECK_FAILED`, `PIPELINE_LOAD_FAILED`, `CONNECTION_FAILED`, `CONNECTION_LOST`, `STREAM_STOPPED`, `DATA_CHANNEL_ERROR`

### Audio Analysis Configuration

**Normalization Defaults** (tuned for typical music):
| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `energyMax` | 0.15 | Typical RMS peaks at 0.1-0.2; lower = more sensitivity |
| `spectralCentroidMin` | 0 Hz | Zero baseline - any centroid above 0 contributes |
| `spectralCentroidMax` | 3000 Hz | More sensitivity across common music range |
| `spectralFlatnessMax` | 0.5 | Standard ceiling |

**Update Rates**:
- Meyda analysis: ~86 Hz (buffer 512 at 44.1kHz)
- Mapping engine: ~86 Hz (per Meyda callback)
- Parameter sender: 30 Hz (rate-limited to avoid flooding)
- UI state updates: 10 Hz (throttled to prevent React jank)

### Generation Configuration

**Denoising Steps**: `[1000, 750, 500, 250]` (4-step schedule)
- Balanced quality visuals (~15-20 FPS on 24GB+ GPUs)
- Alternative: `[1000, 500, 250]` for 3-step at ~20-25 FPS
- Alternative: `[1000, 250]` for 2-step at ~25-35 FPS (lower quality)

**Prompt Transitions**: All prompt changes use smooth slerp transitions (no hard cuts)
- Theme switches: 6-frame crossfade transition
- Energy spike prompt changes: theme-defined blendDuration (typically 5-7 frames), 1.5s cooldown
- Within-theme prompt changes: 5-frame transition (DEFAULT_PROMPT_TRANSITION_STEPS)
- Beat action: `pulse_noise` (noise boost only, no prompt changes, no cache reset)
- Temporal variation: REMOVED (prompts are static per energy level—no cycling or looping)

**Debug Logging** (dev mode): Console logs `[Scope] Theme:` to verify theme changes are being sent

---

## Soundscape WebRTC Flow

1. Health check: `GET /health` (root-level, NOT `/api/v1/health`)
2. Load pipeline: `POST /api/v1/pipeline/load` with `pipeline_ids: ["longlive"]` and `load_params`:
   - `vace_enabled: false` (critical for T2V mode without reference images)
   - `width`/`height` based on aspect ratio
3. Wait for pipeline status `"loaded"`: `GET /api/v1/pipeline/status`
4. Get ICE servers: `GET /api/v1/webrtc/ice-servers`
5. Create peer connection with ICE servers
6. Add video transceiver: `pc.addTransceiver("video")` (NO direction specified)
7. Create data channel: `pc.createDataChannel("parameters", { ordered: true })`
8. Create offer and send to `POST /api/v1/webrtc/offer` with `initialParameters`:
   - `prompts`, `denoising_step_list`, `manage_cache: true`, `paused: false`
9. Set remote description from answer
10. Trickle ICE candidates via `PATCH /api/v1/webrtc/offer/{sessionId}`
11. On data channel open: start sending parameter updates (rate-limited to 30Hz)

### Critical Implementation Notes

| Requirement | Details |
|-------------|---------|
| Health endpoint | `/health` (root-level, unique among all endpoints) |
| Pipeline load | Canonical request shape is `pipeline_ids`; Soundscape includes a legacy fallback for older servers |
| Video transceiver | Use `pc.addTransceiver("video")` WITHOUT `{ direction: "recvonly" }` |
| Initial params | Include `paused: false` to ensure generation starts immediately |
| Data channel params | Include `paused: false` in ongoing updates |
| Session conflicts | Close native Scope UI tabs to avoid pipeline interference |

---

## Pipeline Configuration (Soundscape)

**Default Pipeline**: `longlive`

**Load Params** (based on aspect ratio, dimensions must be divisible by 64):
- 16:9: 576×320 (~15-20 FPS, Daydream default flipped)
- 9:16: 320×576 (~15-20 FPS, Daydream default)

**Note**: `vace_enabled` param only passed for `longlive` pipeline (other pipelines may not accept it).

**Rationale**: `longlive` provides stable output and smooth prompt transitions for audio-reactive visuals.

---

## Deployment Notes

**RunPod Deployment (Example)**
- Pod: `YOUR_POD_NAME`
- GPU: RTX 4090 (24GB+) or equivalent
- Scope UI: `https://POD_ID-8000.proxy.runpod.net`
- Note: Instance details are intentionally redacted in the repo

---

## Troubleshooting

### No Video Frames (Track muted)

**Symptoms**: WebRTC connects, ICE connected, data channel open, but `videoWidth: 0`, track `muted: true`

**Causes & Fixes**:

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Scope server is not healthy" | Wrong health endpoint | Use `/health` not `/api/v1/health` |
| Silent generation failure | Text-only flag missing | Set `vace_enabled: false` in pipeline load |
| Track muted, no frames | Wrong transceiver setup | Use `pc.addTransceiver("video")` without direction |
| Connected but no generation | Missing paused flag | Add `paused: false` to initial params |
| Pipeline stuck loading | Conflict with native UI | Close other Scope tabs/sessions |

### Pipeline Loading Forever

**Symptoms**: Status polling shows `"loading"` indefinitely, `pipeline_id: null`

**Causes**:
1. Native Scope UI in another tab triggered a different pipeline
2. Previous session didn't clean up properly

**Fix**: Manually load the pipeline via curl or close conflicting tabs:
```bash
curl -X POST "https://YOUR-POD-8000.proxy.runpod.net/api/v1/pipeline/load" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_ids": ["longlive"], "load_params": {"vace_enabled": false}}'
```

### Debugging Tips

1. Check browser console for `[Soundscape]` prefixed logs
2. Check for `[Scope] Theme:` logs to verify theme transitions
3. Verify pipeline status: `curl https://YOUR-POD-8000.proxy.runpod.net/api/v1/pipeline/status`
4. Check video element: `document.querySelector('video').srcObject.getTracks()[0].muted` should be `false`
5. ICE state should reach `connected` or `completed`

---

## UI Design System

### Typography
- **Primary (Display)**: Cinzel — Serif display font for headers, titles, and branded elements (`font-display` utility)
- **Secondary (Body)**: Poppins — Sans-serif for all UI text, controls, and body content (`font-body` utility)
- Numeric displays use Poppins with `tabular-nums` for aligned digits

### Glassmorphism
All UI panels use the glass-neon aesthetic system:
- `glass`: `backdrop-filter: blur(24px) saturate(180%)` + translucent background
- `glass-radiant`: Enhanced version with purple glow, used for primary containers
- Subtle borders: `rgba(255, 255, 255, 0.08)` for depth

### Video Display
- Video has padding (`p-3 pt-12 pb-12`) to prevent overlay controls from covering content
- Overlay controls (Enhance, Disconnect) positioned top-right with compact styling
- Aspect ratio selection happens before connect (connection screen)
- `object-contain` preserves aspect ratio within the container

### CSS Post-Processing (Enhance Mode)
When enabled, applies CSS filters to enhance AI-generated visuals:
```css
filter: contrast(1.08) saturate(1.05);
image-rendering: crisp-edges;
```

### Theme System
- 12 preset themes including Cosmic Voyage, Neon Foundry, Digital Forest, Synthwave Highway, Crystal Sanctuary, Ocean Depths, Cyber City, Aurora Dreams, 8-Bit Adventure, Volcanic Forge, Quantum Realm, and Neon Tokyo
- All themes display in compact dock with glass-styled pills
- Active theme highlighted with purple glow accent

---
