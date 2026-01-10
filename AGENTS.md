# Agent Coordination - MetaDJ Soundscape

> Execution guide for the MetaDJ Soundscape project.

**Last Modified**: 2026-01-09 19:54 EST
*Parent: /3-projects/5-software/AGENTS.md*

## Project Context

MetaDJ Soundscape is an audio-reactive AI video generation application built for the Daydream 2025 Interactive AI Video Program (Scope Track). It transforms music into real-time AI-generated visuals using StreamDiffusion.

- **Stack**: Next.js 16 + TypeScript + Tailwind 4
- **Audio**: Meyda library for real-time feature extraction
- **Video**: WebRTC streaming from Daydream Scope

## Repository Organization

- Root stays minimal: `README.md`, `CHANGELOG.md`, configs
- Use `src/`, `public/`, `docs/`, `scripts/`, `tests/`
- No archive folder; use git history
- No temp or duplicate files

## Workflow Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3500) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript type check |
| `npm run test` | Run Vitest test suite |

## Startup Sequence

```bash
# 1. Start local dev server
npm run dev  # Runs on http://localhost:3500

# 2. Open app
open http://localhost:3500
```

**Prerequisites**: Scope server must be running (RunPod or local).

## Key Components

| Path | Description |
|------|-------------|
| `src/lib/soundscape/` | Audio analysis, mapping engine, themes |
| `src/components/soundscape/` | UI components (Studio, Player, ThemeSelector) |
| `src/lib/scope/` | WebRTC and Scope API integration |

## Development Standards

### Code Patterns
- Next.js App Router + TypeScript + Tailwind
- Keep Scope API adapters isolated in `src/lib/scope/`
- Audio analysis logic in `src/lib/soundscape/`

### Quality Standards
- Keep linting, type checks, and tests green
- Document trade-offs in `docs/architecture.md`
- Update README for meaningful milestones

## Code Review Checklist

- Lint and type checks pass
- Tests pass for implemented features
- Docs updated if needed
- No secrets committed
- Performance considered for UI work
