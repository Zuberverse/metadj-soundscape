# MetaDJ Soundscape

*Parent: /3-projects/5-software/AGENTS.md*
**Last Modified**: 2026-02-12 11:47 EST

## Scope

Audio-reactive AI video generation application for the Daydream 2025 Interactive AI Video Program (Scope Track). Transforms music into real-time AI-generated visuals using StreamDiffusion.

## Stack

- **Framework**: Next.js 16 + TypeScript + Tailwind 4
- **Audio**: Meyda library for real-time feature extraction
- **Video**: WebRTC streaming from Daydream Scope

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (port 3500) |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript |
| `npm run test` | Vitest |

**Codex Runtime Note**: Long-running dev servers started inside Codex tool sessions can terminate when the session/turn ends. For persistent local testing, run `npm run dev` in your own terminal window/tab.

**Prerequisites**: Scope server must be running (RunPod or local).

## Key Components

| Path | Description |
|------|-------------|
| `src/lib/soundscape/` | Audio analysis, mapping engine, themes |
| `src/components/soundscape/` | UI (Studio, Player, ThemeSelector) |
| `src/lib/scope/` | WebRTC and Scope API integration |

## Code Patterns

- Next.js App Router + TypeScript + Tailwind
- Scope API adapters isolated in `src/lib/scope/`
- Audio analysis logic in `src/lib/soundscape/`

## Quality Gates

- Lint and type checks pass
- Tests pass for implemented features
- No secrets committed
- Performance considered for UI work
