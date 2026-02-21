# Changelog

**Last Modified**: 2026-02-20 20:33 ET

All notable changes to MetaDJ Soundscape will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Advanced live runtime tuning controls in Studio (Beat Boost, Spike Boost, Variation Blend, Motion Bias, Noise Ceiling) with persisted settings and immediate application to the active mapping engine.
- Runtime telemetry rows in the compact settings panel to explicitly show active mode (`Audio Reactive` vs `Ambient Hold`) and current audio signal status.
- Live `Motion Pace` Studio control (`Stable` / `Balanced` / `Dynamic`) with runtime persistence (`soundscape.motionPaceProfile`) and immediate mapping-engine application during active sessions.
- **New Soundscape Themes**: Added `CIRCUIT_BOARD`, `AMETHYST_CAVES`, and `DIGITAL_MATRIX` themes for expansive visual variety.
- Resolution tier labels standardized to `Low`/`Medium`/`High` for both `16:9` and `9:16` formats.
- Comprehensive operations runbook in `docs/operations.md` covering deployment checklist, monitoring thresholds, incident playbooks, and rollback procedures.
- New `npm run check:launch` preflight script (`scripts/check-launch-config.mjs`) validating deployment-critical environment configuration before release.
- **External Video Input Routing**: NDI and Spout toggles in the Soundscape UI for feeding external visualizer streams into Scope sessions.
- Full propagation of Reactivity Profile `smoothingFactor` down to the `MappingEngine`, unlocking smoother, configurable audio-to-visual parameter transitions.
- Completed full visual transitions audit validating semantic `slerp` prompt mechanics, fallback behavior, and parameter overrides across current preset theme catalog.
- Microphone audio input mode in `AudioPlayer` alongside the built-in demo track source.
- Live clip recording workflow for Scope stream output with downloadable `webm` export.
- Beat-synced Auto Theme timeline controls (16/32/64 beat sections) for hands-free preset rotation.
- Keyboard shortcuts for performance flow: `Space` toggles play/pause and `1-9` selects preset themes.
- Demo-Safe offline guidance panel with one-click copy of `npm run check:scope`.
- Performance telemetry classification using sampled FPS and dropped frame thresholds (Healthy/Watch/Critical).
- Scope proxy route regression tests covering path allowlist enforcement and successful health proxy behavior.
- AudioPlayer regression test for transport control registration and playback toggle behavior.
- Scope connection regression test for `connect()` pipeline override handling.
- Scope diagnostics panel on the connection screen (health, scope version, pipeline status, last check timestamp, manual refresh).
- Dynamic pipeline selection from live Scope schemas before connect.
- Live stream telemetry overlay (active pipeline, resolution, dropped-frame percentage when available).
- Compact audio analysis meters added directly into the bottom controls dock.
- Scope capability discovery in diagnostics (GPU/VRAM summary, model readiness, LoRA count, plugin count).
- Generation controls panel with denoising profile, reactivity profile, prompt accent text/weight, and preset accents.
- Persistent local preferences for pipeline, preprocessor, denoising profile, reactivity profile, and prompt accent settings.
- Scope client regression tests covering pipeline load compatibility fallback and schema parsing.
- Scope connection regression test to ensure the app stays in connecting state until the first video track arrives.
- Audio analyzer regression coverage for source-to-analyzer disconnect during teardown.
- Scope connection regression tests for video-track timeout recovery and stale async connect cancellation.
- Audio analyzer regression coverage for zero-denominator normalization edge cases (prevents NaN/Infinity output).
- Scope client regression coverage for LoRA list normalization and plugin endpoint fallback.
- Soundscape hook regression coverage for generation control updates and prompt accent composition.
- Mapping engine regression coverage for empty energy-spike prompt-variation lists.
- Audio analyzer regression coverage for same-element analyzer reuse and low-energy noise beat suppression.
- Soundscape page accessibility regression tests for help-modal escape handling and focus trapping.
- AudioPlayer regression test for microphone-permission error announcements and retry focus behavior.
- Soundscape hook regression tests for ambient-mode parameter sync after denoising/prompt accent updates.
- Audio analyzer regression test for first-frame `energyDerivative` startup stabilization.
- Scope proxy regression tests for production same-origin write enforcement.
- Scope proxy regression test coverage for oversized request-body rejection.
- Scope connection regression coverage for reconnect retries after intermediate reconnect-setup failure.
- Scope connection regression coverage ensuring active session disposers run before repeated connect attempts.

### Changed
- Soundscape dock and floating menus now render only when controls are active, preventing hidden theme/audio/settings controls from remaining in the keyboard/screen-reader focus order.
- Floating audio/settings FAB toggles now expose explicit expanded/control relationships (`aria-expanded`, `aria-controls`, `aria-haspopup`) and support Escape-to-close behavior for fast keyboard recovery.
- Scope connection initialization/reconnect copy now lives in a polite live region to announce status transitions for assistive technologies.
- `ParameterSender` now snapshots and clears pending params before transmission, preserving re-entrant parameter updates instead of risking stale-frame overwrites.
- `AudioAnalyzer.destroy()` now supports explicit media-element release, including source disconnect + `AudioContext.close()`, and `useSoundscape` now opts into release on teardown/replacement to prevent long-session audio-context buildup.
- Regression coverage expanded for: re-entrant `ParameterSender` queue behavior, positive energy-spike transition path + anti-stacking behavior, and `AudioAnalyzer` media-element release/reinitialize lifecycle.
- Preprocessor control is now colocated with Input Streams controls (NDI/Spout) to match its video-input-only activation path.
- Preprocessor chaining is now applied only when video input mode is active (NDI/Spout); text-mode sessions no longer include inactive preprocessors in `pipeline_ids`.
- Audio/ambient mode switching now always falls back to ambient when the system is not in a valid audio-reactive state (`isPlaying && audioReady`), eliminating ambiguous in-between runtime behavior.
- Scope readiness indicator on the connect screen now shows only `Online`/`Offline`, and the diagnostics action keeps a static `Refresh` label.
- Documentation parity pass completed across README + docs (`operations`, `scope-integration`, `system-architecture`, `product-spec`, docs index) to reflect runtime mode telemetry, video-only preprocessor activation, and current detected preprocessor catalog.
- Audio-reactivity stability tuning: lowered theme noise-scale ranges to `0.48-0.68`, reduced beat/spike noise boosts, increased spike cooldown to `2200ms`, tightened beat detector thresholds, and added prompt-level motion pacing constraints to reduce excessive forward-speed surges.
- Documentation alignment pass: clarified prompt accent controls as text + weight (removed stale preset reference), documented hydration-safe preference restore behavior for pipeline/preprocessor selections, and marked deep-dive Scope version references as historical snapshot context.
- Deployment documentation now tracks the current RunPod production pod (`xtt2dvnrtew5v1`, `RTX PRO 6000`) and preserves `RTX 5090` as a feasible fallback profile.
- **Theme Enhancement**: Refined prompt descriptions across all themes to keep color palettes aligned to each scene while reducing global dark-bias drift.
- **Resolution Stability**: Updated high tier dimensions to `896x512` (`16:9`) and `512x896` (`9:16`) for reliable pipeline load on current Scope runtime.
- **Theme Selector UI**: Widened the Theme Selector docking container to optimally accommodate elements and labels.
- Updated docs and runbooks to reflect current pod capability flags (`ndi_available=false`, `spout_available=false`) and HTTPS local dev URL (`https://localhost:3500`).
- **Connection Fallback UX**: Refactored connection state transitions to persist the loading UI during the fade-out, ensuring fluid crossfades into live video generation.
- **Prompt Bleed Mitigation**: Reduced the WebRTC payload's `kv_cache_attention_bias` from `0.3` to `0.1` to prevent the initial default theme from aggressively bleeding into newly selected themes.
- **Visual Clarity**: Removed an abrasive CSS filter from the main video feed to restore natural generation colors and saturation.
- Scope NDI/Spout integration now uses Scope `v0.1.4` video-input contract by sending `input_source` in WebRTC `initialParameters` (instead of legacy `ndi_receiver`/`spout_receiver` load params), and ambient updates no longer force `input_mode: "text"` after connect.
- Soundscape diagnostics failures now render directly in the pre-connect UI as an assertive warning banner instead of remaining hidden in component state.
- Soundscape parameter-sync failures now surface in UI so operators can detect stale visual state quickly during live sessions.
- Scope connection error banners now use alert live-region semantics and include recovery suggestions when available.
- Soundscape page regression tests were updated to validate the current page shell contract (studio mount, viewport classes, ambient layers) and remove stale modal expectations.
- ParameterSender now avoids queue/timer scheduling when the RTC data channel is not open, reducing unnecessary timer churn during disconnected states.
- README launch guidance now includes `HF_TOKEN`, a production launch checklist, and explicit runbook linkage.
- Type-check now runs `next typegen` before `tsc --noEmit`, preventing missing `.next` route type artifacts in clean environments.
- Scope proxy now requires a write token by default in production (`SCOPE_PROXY_REQUIRE_WRITE_TOKEN=true`) and returns a clear server-misconfiguration error when production writes are enabled without `SCOPE_PROXY_WRITE_TOKEN`.
- Scope proxy now enforces configurable request-body size limits for write methods (`SCOPE_PROXY_MAX_BODY_BYTES`, default 512 KB) with explicit `413` responses for oversized payloads.
- Scope connection now cleans up active WebRTC/data-channel resources before repeated `connect()` calls, preventing orphaned sessions.
- Reconnect flows now continue retry budgeting when a reconnect attempt fails during setup instead of terminating immediately on first reconnect failure.
- WebRTC session disposal now invalidates retry state/session IDs to prevent post-disposal ICE retry timers and candidate PATCH activity.
- Accessibility polish pass: telemetry/control toggles preserve keyboard focus across mount/unmount transitions, key controls use 44px minimum targets, compact theme keyboard navigation now moves focus with selection, and compact volume controls now use dialog semantics with Escape handling.
- Help modal background shielding now includes header inert/aria-hidden state while open.
- Scope proxy write hardening now requires a strict same-origin `Origin` header in production (no `sec-fetch-site` fallback), supports optional write token enforcement (`SCOPE_PROXY_WRITE_TOKEN`), and no longer forwards client `Authorization` headers upstream.
- Scope proxy production safety now requires a server-side `SCOPE_API_URL` (prevents relying on `NEXT_PUBLIC_SCOPE_API_URL` fallback in production), with clearer error messaging for invalid upstream config.
- Scope proxy rate limiting now supports forwarded-IP trust controls (`SCOPE_PROXY_TRUST_FORWARDED_IP`, optional `SCOPE_PROXY_IP_HEADER`) and bounded in-memory eviction/cleanup to prevent unbounded key growth.
- Connection lifecycle now distinguishes interruption vs terminal disconnect: transient reconnects preserve playback intent while still cleaning stream/recording state.
- WebRTC session cleanup now exposes an explicit disposer, and connection teardown calls it to reliably clear ICE retry timers and channel handlers.
- Soundscape hook teardown now disposes `ParameterSender` instances explicitly, preventing lingering scheduled send loops across disconnect/unmount.
- Compact audio volume control now exposes correctly labeled volume controls (with dedicated mute action) instead of announcing mute semantics on a slider-toggle button.
- Audio source switcher now supports keyboard radio navigation with roving focus (`Arrow`/`Home`/`End`) and expanded touch targets.
- Global hotkeys are now gated when the help dialog is open and while focus is on interactive controls to prevent background actions during modal workflows.
- Help modal now makes background content inert/aria-hidden while open, and viewport sizing now uses dynamic viewport units (`dvh`) for better mobile browser toolbar behavior.
- Mobile header controls now use larger touch targets (44px minimum) and improved default text contrast.
- Recording errors now announce through an assertive live region and Scope readiness panel now marks busy state via `aria-busy`.
- Analysis meter tempo cards now use non-live grouping semantics to avoid high-frequency screen-reader announcement spam.
- CSP policy now differentiates dev/prod script/connect directives and removes `unsafe-eval` from production.
- CI now includes production dependency audit gating (`npm audit --omit=dev --audit-level=high`) plus full-graph audit reporting.
- Documentation now recommends corpus-level `ai-dev-server.sh` for persistent Codex/Claude dev sessions.
- Upgraded frontend runtime/security baseline to `next@16.1.6` and aligned `eslint-config-next`/React patch versions.
- Scope connect action now uses refreshed, resolved pipeline IDs directly to avoid stale local preference race conditions.
- Scope connection hook now supports per-connect overrides and preserves last connect overrides for reconnect attempts.
- Persisted reactivity profile restoration now validates against known profile keys before applying.
- Theme transition console output now respects debug logging controls (avoids unconditional production noise).
- Initial WebRTC prompt now includes theme style modifiers for better visual consistency at connect time.
- Public docs trimmed for release readiness (Scope brief sanitized; transition timing examples aligned).
- Scope integration now sends canonical `pipeline_ids` for `/api/v1/pipeline/load` with compatibility fallback to legacy `pipeline_id`.
- Scope pipeline status typing expanded to include `not_loaded`.
- WebRTC ICE candidate send/flush failures now emit warnings instead of failing silently.
- Proxy allowlist expanded for current Scope endpoints (`hardware`, `models`, `assets`, `lora`, `plugins`) with stricter segment-boundary matching.
- Scope and Daydream reference docs refreshed to current verified state (`v0.1.0` stable published 2026-02-09; no stable `v1.0` yet).
- Pipeline preparation no longer runs a duplicate health check before load, reducing connection latency.
- Scope connection now transitions to `connected` only after receiving a video track; connection setup remains in `connecting` while waiting for stream frames.
- Scope connection now enforces a first-video-track watchdog timeout and ignores stale async connect results after manual disconnect.
- Video teardown now explicitly pauses the player and clears `srcObject` when Scope disconnects.
- Audio analyzer teardown now disconnects source-to-analyzer links to avoid Web Audio graph accumulation across reconnects.
- WebRTC ICE candidate delivery now queues and retries transient candidate send/flush failures.
- Audio normalization now guards invalid configs (`0`/negative denominator cases) to keep derived metrics finite and clamped.
- Soundscape disconnect now also pauses audio playback and analysis to keep UI and transport state in sync.
- Added tap-to-play fallback when video autoplay is blocked by browser policies.
- Connect CTA gating now prioritizes core readiness (Scope health + pipeline selection), while diagnostics failures are surfaced as warnings instead of hard blocks.
- Aspect ratio radios now support arrow-key navigation and the audio scrubber now shows a visible keyboard focus ring.
- Scope client includes typed hardware/model/plugin capability endpoints with plugin fallback (`/api/v1/plugins` → `/plugins`).
- Mapping engine supports runtime control of denoising schedules, prompt overlay accents, and reactivity profiles.
- Mapping engine now guards against empty energy-spike prompt variation arrays to avoid invalid transition payloads.
- Audio analyzer now enforces a single active analyzer chain per audio element and adds beat-floor gating for low-noise stability.
- Adaptive energy normalization updates now apply after the current frame calculation to preserve expected instantaneous normalization behavior.
- Dock/mobile UX and a11y upgraded: hide-controls action added, compact control targets expanded to 44px, theme selection uses radiogroup semantics, and analysis meters expose ARIA progressbars.
- Tailwind v4 monorepo source detection fix: `globals.css` now uses `@import "tailwindcss" source(none)` with explicit `@source` directives to avoid broken auto-detection when corpus `.git` root is multiple levels up.
- Scope proxy hardening: endpoint/method matrix now only exposes Soundscape-required Scope routes, enforces same-origin browser context for write operations, applies per-method rate limits, and blocks insecure upstream config in production.
- Ambient mode now re-syncs Scope parameters immediately when denoising profile or prompt accent changes while audio playback is paused.
- Audio analyzer now suppresses first-frame energy derivative spikes to avoid false transition triggers on startup/resume.
- Disconnecting audio now clears stale analysis and parameter state from the UI.
- Telemetry overlay now displays numeric dropped-frame ratio directly alongside FPS/performance status.
- Global hotkeys now support `ArrowLeft` / `ArrowRight` for theme navigation.
- Help modal accessibility upgraded with Escape-to-close, focus trap, and focus restoration on close.
- Microphone permission errors now use live-region alert semantics and shift focus to retry action for keyboard/screen-reader recovery.
- Security response headers now include CSP, HSTS, COOP, COEP, and CORP baseline hardening.

## [1.0.0] - 2026-01-08

### Added
- **Audio-reactive AI video generation** powered by Daydream Scope and StreamDiffusion
- **Real-time audio analysis** via Meyda.js (RMS, spectral centroid, energy, ZCR)
- **Beat detection** with energy-based tempo tracking
- **12 preset themes** with audio-reactive parameter mapping:
  - Cosmic Voyage — Neon digital space with energy-responsive noise
  - Neon Foundry — Industrial AI interior with beat-driven noise pulses
  - Digital Forest — Bioluminescent nature/tech hybrid
  - Synthwave Highway — Retro-futuristic driving visuals
  - Crystal Sanctuary — Meditative crystalline environments
  - Ocean Depths — Deep sea bioluminescence
  - Cyber City — Cyberpunk urban neon
  - Aurora Dreams — Northern lights and celestial flow
  - 8-Bit Adventure — Retro pixel art game world
  - Volcanic Forge — Molten lava and fire
  - Quantum Realm — Subatomic particle visualization
  - Neon Tokyo — Japanese neon cityscape
- **WebRTC streaming** for low-latency GPU-to-browser video delivery
- **Demo track** ("Metaversal Odyssey", MetaDJ Original) with infinite loop playback
- **Aspect ratio toggle** (16:9 widescreen / 9:16 portrait)
- **AnalysisMeter** showing real-time audio feature values
- **ThemeSelector** with visual theme grid
- **Auto-reconnection** with linear scaling backoff (up to 3 attempts)
- **Enhance mode** (post-processing contrast/saturation boost)
- **Test suite** — Coverage for audio analysis, mapping engine, and connection hooks
- **User-friendly error messages** — Structured error handling with title, description, and recovery suggestions
- **JSDoc documentation** — Comprehensive documentation for core classes and components

### Technical
- Next.js 16 + TypeScript + Tailwind 4
- Meyda audio analysis library
- WebRTC DataChannel for parameter streaming (30Hz)
- Scope API client with typed interfaces
- Mapping engine translating audio features to generation parameters
- 4-step denoising schedule for ~15-20 FPS on 24GB+ GPUs
- Simplified ambient mode (send prompt once; Scope's latent cache maintains coherence)
- Unified 6-frame crossfade for all theme transitions
- Typography: Cinzel (display) + Poppins (body)

### Security
- Authentication handled server-side only (no client-side tokens)
- Proxy disabled by default in production
- Path allowlist for Scope API endpoints

### Hackathon Context
Built for the Daydream 2025 Interactive AI Video Program (Scope Track).
