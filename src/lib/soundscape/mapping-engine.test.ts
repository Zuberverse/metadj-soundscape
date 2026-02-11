import { describe, expect, it } from "vitest";
import { MappingEngine } from "./mapping-engine";
import { COSMIC_VOYAGE, NEON_FOUNDRY } from "./themes";
import { DENOISING_STEPS } from "./constants";
import type { AnalysisState, Theme } from "./types";

const makeAnalysis = (energy: number, isBeat = false): AnalysisState => ({
  features: {
    rms: 0,
    spectralCentroid: 0,
    spectralFlatness: 0,
    spectralRolloff: 0,
    zcr: 0,
  },
  beat: {
    bpm: null,
    confidence: 0,
    lastBeatTime: 0,
    isBeat,
  },
  derived: {
    energy,
    brightness: 0.5,
    texture: 0.5,
    energyDerivative: 0,
    peakEnergy: energy,
  },
});

describe("MappingEngine", () => {
  it("uses fixed denoising steps regardless of energy", () => {
    const engine = new MappingEngine(COSMIC_VOYAGE);

    // Low energy
    const lowParams = engine.computeParameters(makeAnalysis(0.1));
    expect(lowParams.denoisingSteps).toEqual(DENOISING_STEPS);

    // High energy - same fixed steps
    const highParams = engine.computeParameters(makeAnalysis(0.9));
    expect(highParams.denoisingSteps).toEqual(DENOISING_STEPS);
  });

  it("keeps noise scale within theme range", () => {
    const engine = new MappingEngine(COSMIC_VOYAGE);
    const params = engine.computeParameters(makeAnalysis(0.5));
    expect(params.noiseScale).toBeGreaterThanOrEqual(COSMIC_VOYAGE.ranges.noiseScale.min);
    expect(params.noiseScale).toBeLessThanOrEqual(COSMIC_VOYAGE.ranges.noiseScale.max);
  });

  it("boosts noise on beat for pulse_noise themes", () => {
    const engine = new MappingEngine(NEON_FOUNDRY);
    const paramsNoBeat = engine.computeParameters(makeAnalysis(0.5, false));
    const paramsWithBeat = engine.computeParameters(makeAnalysis(0.5, true));
    // Beat should boost noise scale (pulse_noise action)
    expect(paramsWithBeat.noiseScale).toBeGreaterThan(paramsNoBeat.noiseScale);
    // Should NOT reset cache (pulse_noise preserves continuity)
    expect(paramsWithBeat.resetCache).toBeFalsy();
  });

  it("skips energy-spike transitions when prompt variation list is empty", () => {
    const themeWithEmptyVariations: Theme = {
      ...NEON_FOUNDRY,
      promptVariations: {
        trigger: "energy_spike",
        prompts: [],
        blendDuration: 6,
      },
    };
    const engine = new MappingEngine(themeWithEmptyVariations);

    const params = engine.computeParameters({
      ...makeAnalysis(0.8, false),
      derived: {
        energy: 0.8,
        brightness: 0.5,
        texture: 0.5,
        energyDerivative: 0.2,
        peakEnergy: 0.8,
      },
    });

    expect(params.transition).toBeUndefined();
  });
});
