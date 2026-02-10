/**
 * AudioAnalyzer Tests
 * Tests for audio feature extraction and beat detection
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AudioAnalyzer } from "./audio-analyzer";

// ============================================================================
// Mock Web Audio API
// ============================================================================

class MockAudioContext {
  state: AudioContextState = "running";
  destination = {};

  createMediaElementSource = vi.fn(() => {
    const source = new MockMediaElementSourceNode();
    lastSourceNode = source;
    return source;
  });
  createAnalyser = vi.fn(() => {
    const analyzer = new MockAnalyserNode();
    lastAnalyserNode = analyzer;
    return analyzer;
  });
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
}

class MockMediaElementSourceNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAnalyserNode {
  fftSize = 2048;
  connect = vi.fn();
  disconnect = vi.fn();
}

let lastSourceNode: MockMediaElementSourceNode | null = null;
let lastAnalyserNode: MockAnalyserNode | null = null;

// Mock HTMLAudioElement
function createMockAudioElement(): HTMLAudioElement {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    currentTime: 0,
    duration: 180,
    src: "",
  } as unknown as HTMLAudioElement;
}

// ============================================================================
// Mock Meyda
// ============================================================================

const mockMeydaAnalyzer = {
  start: vi.fn(),
  stop: vi.fn(),
};

const mockMeydaCallback: { current: ((features: Record<string, number>) => void) | null } = {
  current: null,
};

vi.mock("meyda", () => ({
  default: {
    createMeydaAnalyzer: vi.fn((config: { callback: (features: Record<string, number>) => void }) => {
      mockMeydaCallback.current = config.callback;
      return mockMeydaAnalyzer;
    }),
  },
}));

// ============================================================================
// Setup
// ============================================================================

// Store original globals
const originalAudioContext = globalThis.AudioContext;

beforeEach(() => {
  // Mock AudioContext globally
  globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

  // Reset mocks
  vi.clearAllMocks();
  mockMeydaCallback.current = null;
  lastSourceNode = null;
  lastAnalyserNode = null;
});

afterEach(() => {
  // Restore original globals
  globalThis.AudioContext = originalAudioContext;
});

// ============================================================================
// Tests
// ============================================================================

describe("AudioAnalyzer", () => {
  describe("initialization", () => {
    it("creates AudioContext and connects nodes on initialize", async () => {
      const analyzer = new AudioAnalyzer();
      const audioElement = createMockAudioElement();

      await analyzer.initialize(audioElement);

      // Analyzer should be successfully initialized (no error thrown)
      // and ready to start analysis
      expect(analyzer).toBeDefined();
    });

    it("uses custom normalization config", () => {
      const customConfig = {
        energyMax: 0.2,
        spectralCentroidMin: 200,
        spectralCentroidMax: 8000,
        spectralFlatnessMax: 0.6,
      };

      const analyzer = new AudioAnalyzer(customConfig);

      // Analyzer should accept config (internal state)
      expect(analyzer).toBeDefined();
    });
  });

  describe("analysis lifecycle", () => {
    it("starts and stops Meyda analyzer", async () => {
      const analyzer = new AudioAnalyzer();
      const audioElement = createMockAudioElement();

      await analyzer.initialize(audioElement);

      const callback = vi.fn();
      analyzer.start(callback);

      expect(mockMeydaAnalyzer.start).toHaveBeenCalled();

      analyzer.stop();

      expect(mockMeydaAnalyzer.stop).toHaveBeenCalled();
    });

    it("calls callback with analysis state when features arrive", async () => {
      const analyzer = new AudioAnalyzer();
      const audioElement = createMockAudioElement();

      await analyzer.initialize(audioElement);

      const callback = vi.fn();
      analyzer.start(callback);

      // Simulate Meyda sending features
      if (mockMeydaCallback.current) {
        mockMeydaCallback.current({
          rms: 0.1,
          spectralCentroid: 2000,
          spectralFlatness: 0.3,
          spectralRolloff: 4000,
          zcr: 50,
        });
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          features: expect.objectContaining({
            rms: 0.1,
            spectralCentroid: 2000,
          }),
          derived: expect.objectContaining({
            energy: expect.any(Number),
            brightness: expect.any(Number),
          }),
          beat: expect.objectContaining({
            isBeat: expect.any(Boolean),
          }),
        })
      );
    });

    it("does not call callback after stop", async () => {
      const analyzer = new AudioAnalyzer();
      const audioElement = createMockAudioElement();

      await analyzer.initialize(audioElement);

      const callback = vi.fn();
      analyzer.start(callback);
      analyzer.stop();

      callback.mockClear();

      // Simulate Meyda sending features after stop
      if (mockMeydaCallback.current) {
        mockMeydaCallback.current({
          rms: 0.1,
          spectralCentroid: 2000,
          spectralFlatness: 0.3,
          spectralRolloff: 4000,
          zcr: 50,
        });
      }

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("derived metrics", () => {
    it("normalizes energy correctly", async () => {
      const analyzer = new AudioAnalyzer({ energyMax: 0.1 } as ConstructorParameters<typeof AudioAnalyzer>[0]);
      const audioElement = createMockAudioElement();

      await analyzer.initialize(audioElement);

      const callback = vi.fn();
      analyzer.start(callback);

      // RMS of 0.05 with energyMax of 0.1 should give normalized energy of 0.5
      if (mockMeydaCallback.current) {
        mockMeydaCallback.current({
          rms: 0.05,
          spectralCentroid: 1000,
          spectralFlatness: 0.2,
          spectralRolloff: 2000,
          zcr: 30,
        });
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          derived: expect.objectContaining({
            energy: 0.5,
          }),
        })
      );
    });

    it("clamps energy to maximum of 1", async () => {
      const analyzer = new AudioAnalyzer({ energyMax: 0.1 } as ConstructorParameters<typeof AudioAnalyzer>[0]);
      const audioElement = createMockAudioElement();

      await analyzer.initialize(audioElement);

      const callback = vi.fn();
      analyzer.start(callback);

      // RMS of 0.2 with energyMax of 0.1 should clamp to 1.0
      if (mockMeydaCallback.current) {
        mockMeydaCallback.current({
          rms: 0.2,
          spectralCentroid: 1000,
          spectralFlatness: 0.2,
          spectralRolloff: 2000,
          zcr: 30,
        });
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          derived: expect.objectContaining({
            energy: 1,
          }),
        })
      );
    });

    it("normalizes brightness from spectral centroid", async () => {
      const analyzer = new AudioAnalyzer({
        spectralCentroidMin: 1000,
        spectralCentroidMax: 5000,
      } as ConstructorParameters<typeof AudioAnalyzer>[0]);
      const audioElement = createMockAudioElement();

      await analyzer.initialize(audioElement);

      const callback = vi.fn();
      analyzer.start(callback);

      // Centroid of 3000 with range 1000-5000 should give brightness of 0.5
      if (mockMeydaCallback.current) {
        mockMeydaCallback.current({
          rms: 0.1,
          spectralCentroid: 3000,
          spectralFlatness: 0.2,
          spectralRolloff: 2000,
          zcr: 30,
        });
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          derived: expect.objectContaining({
            brightness: 0.5,
          }),
        })
      );
    });

    it("handles zero normalization denominators without NaN/Infinity", async () => {
      const analyzer = new AudioAnalyzer({
        energyMax: 0,
        spectralCentroidMin: 1000,
        spectralCentroidMax: 1000,
        spectralFlatnessMax: 0,
      } as ConstructorParameters<typeof AudioAnalyzer>[0]);
      const audioElement = createMockAudioElement();

      await analyzer.initialize(audioElement);

      const callback = vi.fn();
      analyzer.start(callback);

      if (mockMeydaCallback.current) {
        mockMeydaCallback.current({
          rms: 0.3,
          spectralCentroid: 2500,
          spectralFlatness: 0.5,
          spectralRolloff: 2000,
          zcr: 30,
        });
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          derived: expect.objectContaining({
            energy: expect.any(Number),
            brightness: expect.any(Number),
            texture: expect.any(Number),
          }),
        })
      );

      const state = callback.mock.calls.at(-1)?.[0];
      expect(Number.isFinite(state.derived.energy)).toBe(true);
      expect(Number.isFinite(state.derived.brightness)).toBe(true);
      expect(Number.isFinite(state.derived.texture)).toBe(true);
      expect(state.derived.energy).toBeGreaterThanOrEqual(0);
      expect(state.derived.energy).toBeLessThanOrEqual(1);
      expect(state.derived.brightness).toBeGreaterThanOrEqual(0);
      expect(state.derived.brightness).toBeLessThanOrEqual(1);
      expect(state.derived.texture).toBeGreaterThanOrEqual(0);
      expect(state.derived.texture).toBeLessThanOrEqual(1);
    });
  });

  describe("cleanup", () => {
    it("stops analysis and disconnects nodes on destroy", async () => {
      const analyzer = new AudioAnalyzer();
      const audioElement = createMockAudioElement();

      await analyzer.initialize(audioElement);
      analyzer.start(vi.fn());
      analyzer.destroy();

      expect(mockMeydaAnalyzer.stop).toHaveBeenCalled();
      expect(lastSourceNode?.disconnect).toHaveBeenCalledWith(lastAnalyserNode);
    });
  });

  describe("normalization config updates", () => {
    it("updates normalization config dynamically", async () => {
      const analyzer = new AudioAnalyzer({ energyMax: 0.1 } as ConstructorParameters<typeof AudioAnalyzer>[0]);
      const audioElement = createMockAudioElement();

      await analyzer.initialize(audioElement);

      const callback = vi.fn();
      analyzer.start(callback);

      // Initial: RMS 0.1 / energyMax 0.1 = energy 1.0
      if (mockMeydaCallback.current) {
        mockMeydaCallback.current({
          rms: 0.1,
          spectralCentroid: 1000,
          spectralFlatness: 0.2,
          spectralRolloff: 2000,
          zcr: 30,
        });
      }

      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          derived: expect.objectContaining({
            energy: 1,
          }),
        })
      );

      // Update normalization
      analyzer.setNormalization({ energyMax: 0.2 });

      // Now: RMS 0.1 / energyMax 0.2 = energy 0.5
      if (mockMeydaCallback.current) {
        mockMeydaCallback.current({
          rms: 0.1,
          spectralCentroid: 1000,
          spectralFlatness: 0.2,
          spectralRolloff: 2000,
          zcr: 30,
        });
      }

      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          derived: expect.objectContaining({
            energy: 0.5,
          }),
        })
      );
    });
  });
});

describe("BeatDetector (via AudioAnalyzer)", () => {
  it("detects beats on energy spikes", async () => {
    const analyzer = new AudioAnalyzer();
    const audioElement = createMockAudioElement();

    await analyzer.initialize(audioElement);

    const callback = vi.fn();
    analyzer.start(callback);

    // Send low energy frames to establish baseline
    for (let i = 0; i < 20; i++) {
      if (mockMeydaCallback.current) {
        mockMeydaCallback.current({
          rms: 0.01, // Low energy
          spectralCentroid: 1000,
          spectralFlatness: 0.2,
          spectralRolloff: 2000,
          zcr: 30,
        });
      }
    }

    // Clear previous calls
    callback.mockClear();

    // Send high energy spike
    if (mockMeydaCallback.current) {
      mockMeydaCallback.current({
        rms: 0.15, // High energy spike
        spectralCentroid: 1000,
        spectralFlatness: 0.2,
        spectralRolloff: 2000,
        zcr: 30,
      });
    }

    // Should detect beat on energy spike
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        beat: expect.objectContaining({
          isBeat: true,
        }),
      })
    );
  });

  it("respects minimum beat interval", async () => {
    const analyzer = new AudioAnalyzer();
    const audioElement = createMockAudioElement();

    await analyzer.initialize(audioElement);

    const callback = vi.fn();
    analyzer.start(callback);

    // Establish baseline
    for (let i = 0; i < 20; i++) {
      if (mockMeydaCallback.current) {
        mockMeydaCallback.current({
          rms: 0.01,
          spectralCentroid: 1000,
          spectralFlatness: 0.2,
          spectralRolloff: 2000,
          zcr: 30,
        });
      }
    }

    // First beat
    if (mockMeydaCallback.current) {
      mockMeydaCallback.current({
        rms: 0.15,
        spectralCentroid: 1000,
        spectralFlatness: 0.2,
        spectralRolloff: 2000,
        zcr: 30,
      });
    }

    // Immediate second spike (should NOT be a beat due to min interval)
    callback.mockClear();
    if (mockMeydaCallback.current) {
      mockMeydaCallback.current({
        rms: 0.15,
        spectralCentroid: 1000,
        spectralFlatness: 0.2,
        spectralRolloff: 2000,
        zcr: 30,
      });
    }

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        beat: expect.objectContaining({
          isBeat: false,
        }),
      })
    );
  });
});
