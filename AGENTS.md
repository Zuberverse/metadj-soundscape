# MetaDJ Soundscape

*Parent: /3-projects/5-software/AGENTS.md*
**Last Modified**: 2026-02-12 12:02 EST

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
| `npm run dev:turbo` | Dev server with Turbopack (port 3500) |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript |
| `npm run test` | Vitest |
| `npm run test:watch` | Vitest in watch mode |
| `npm run check:scope` | Probe Scope API endpoint |

**AI CLI Runtime Note**: For persistent launches in Codex/Claude sessions, from corpus root use:
`./1-system/2-scripts/integration/ai-dev-server.sh start 3-projects/5-software/metadj-soundscape --port 3500`
Then use `status`, `logs`, and `stop` subcommands from the same script for lifecycle management.

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
