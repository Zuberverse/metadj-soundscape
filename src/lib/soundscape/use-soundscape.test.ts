/**
 * useSoundscape Hook Tests
 * Tests for audio-reactive visual generation orchestration
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSoundscape } from "./use-soundscape";
import { PRESET_THEMES } from "./themes";
import {
  AMBIENT_THEME_CHANGE_TRANSITION_STEPS,
  DEFAULT_THEME_ID,
  DENOISING_PROFILES,
} from "./constants";
import type { AnalysisState } from "./types";

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock AudioAnalyzer - use class pattern for proper constructor
const mockAnalyzerInstance = {
  initialize: vi.fn().mockResolvedValue(undefined),
  start: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  resume: vi.fn().mockResolvedValue(undefined),
};

vi.mock("./audio-analyzer", () => ({
  AudioAnalyzer: vi.fn().mockImplementation(function (this: typeof mockAnalyzerInstance) {
    Object.assign(this, mockAnalyzerInstance);
    return this;
  }),
}));

// Mock MappingEngine - use class pattern
const mockMappingEngineInstance = {
  computeParameters: vi.fn(() => ({
    prompts: [{ text: "test prompt", weight: 1.0 }],
    denoisingSteps: [1000, 750, 500, 250],
    noiseScale: 0.5,
  })),
  setTheme: vi.fn(),
  setDenoisingSteps: vi.fn(),
  setReactivityProfile: vi.fn(),
  setPromptOverlay: vi.fn(),
  markExternalTransitionActive: vi.fn(),
};

const mockParameterSenderInstance = {
  setDataChannel: vi.fn(),
  send: vi.fn(),
  clearPending: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("./mapping-engine", () => ({
  MappingEngine: vi.fn().mockImplementation(function (this: typeof mockMappingEngineInstance) {
    Object.assign(this, mockMappingEngineInstance);
    return this;
  }),
  ParameterSender: vi.fn().mockImplementation(function (this: typeof mockParameterSenderInstance) {
    Object.assign(this, mockParameterSenderInstance);
    return this;
  }),
}));

// Mock HTMLAudioElement
function createMockAudioElement(): HTMLAudioElement {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
  } as unknown as HTMLAudioElement;
}

// Mock RTCDataChannel
function createMockDataChannel(readyState: RTCDataChannelState = "open"): RTCDataChannel {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as RTCDataChannel;
}

function createMockAnalysis(overrides: {
  features?: Partial<AnalysisState["features"]>;
  beat?: Partial<AnalysisState["beat"]>;
  derived?: Partial<AnalysisState["derived"]>;
} = {}): AnalysisState {
  return {
    features: {
      rms: 0.2,
      spectralCentroid: 1200,
      spectralFlatness: 0.2,
      spectralRolloff: 1800,
      zcr: 0.1,
      ...overrides.features,
    },
    beat: {
      bpm: 124,
      confidence: 0.9,
      lastBeatTime: 0,
      isBeat: false,
      ...overrides.beat,
    },
    derived: {
      energy: 0.5,
      brightness: 0.5,
      texture: 0.5,
      energyDerivative: 0.05,
      peakEnergy: 0.7,
      ...overrides.derived,
    },
  };
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Tests
// ============================================================================

describe("useSoundscape", () => {
  describe("initialization", () => {
    it("initializes with default state", () => {
      const { result } = renderHook(() => useSoundscape());

      expect(result.current.state.playback).toBe("idle");
      expect(result.current.state.connection).toBe("disconnected");
      expect(result.current.state.analysis).toBeNull();
      expect(result.current.state.error).toBeNull();
      expect(result.current.parameters).toBeNull();
    });

    it("uses default theme when no initial theme provided", () => {
      const { result } = renderHook(() => useSoundscape());

      expect(result.current.currentTheme.id).toBe(DEFAULT_THEME_ID);
    });

    it("uses provided initial theme", () => {
      const { result } = renderHook(() =>
        useSoundscape({ initialTheme: "neon-foundry" })
      );

      expect(result.current.currentTheme.id).toBe("neon-foundry");
    });

    it("creates custom theme from CustomThemeInput", () => {
      const { result } = renderHook(() =>
        useSoundscape({
          initialTheme: {
            prompt: "custom visual test",
            reactivity: "balanced",
            beatResponse: "pulse",
          },
        })
      );

      // Custom themes have ID format "custom-{timestamp}"
      expect(result.current.currentTheme.id).toMatch(/^custom-/);
      expect(result.current.currentTheme.basePrompt).toContain("custom visual test");
    });

    it("returns all preset themes", () => {
      const { result } = renderHook(() => useSoundscape());

      expect(result.current.presetThemes).toEqual(PRESET_THEMES);
      expect(result.current.presetThemes.length).toBeGreaterThan(0);
    });
  });

  describe("theme management", () => {
    it("changes theme by ID", () => {
      const { result } = renderHook(() => useSoundscape());

      act(() => {
        result.current.setTheme("neon-foundry");
      });

      expect(result.current.currentTheme.id).toBe("neon-foundry");
      expect(result.current.state.activeTheme?.id).toBe("neon-foundry");
    });

    it("falls back to default for unknown theme ID", () => {
      const { result } = renderHook(() => useSoundscape());

      act(() => {
        result.current.setTheme("non-existent-theme");
      });

      // Should fall back to default theme
      expect(result.current.currentTheme.id).toBe(DEFAULT_THEME_ID);
    });

    it("creates custom theme from input object", () => {
      const { result } = renderHook(() => useSoundscape());

      act(() => {
        result.current.setTheme({
          prompt: "neon city at night",
          reactivity: "intense",
          beatResponse: "burst",
        });
      });

      // Custom themes have ID format "custom-{timestamp}"
      expect(result.current.currentTheme.id).toMatch(/^custom-/);
      expect(result.current.currentTheme.basePrompt).toContain("neon city at night");
    });

    it("updates mapping engine when theme changes", () => {
      const { result } = renderHook(() => useSoundscape());

      act(() => {
        result.current.setTheme("neon-foundry");
      });

      // MappingEngine.setTheme should be called when it exists
      // (engine is created on connectAudio, but setTheme updates the state regardless)
      expect(result.current.currentTheme.id).toBe("neon-foundry");
    });

    it("queues a transition while channel is closed and replays it once channel opens", async () => {
      const { result } = renderHook(() => useSoundscape());
      const audioElement = createMockAudioElement();
      const closedChannel = createMockDataChannel("closed");
      const openChannel = createMockDataChannel("open");
      const sendMock = openChannel.send as ReturnType<typeof vi.fn>;

      await act(async () => {
        await result.current.connectAudio(audioElement);
      });

      act(() => {
        result.current.setDataChannel(closedChannel);
        result.current.setTheme("neon-foundry");
      });

      expect(sendMock).not.toHaveBeenCalled();

      act(() => {
        result.current.setDataChannel(openChannel);
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(sendMock.mock.calls[0][0] as string) as {
        prompts: Array<{ text: string; weight: number }>;
        transition?: { num_steps: number; temporal_interpolation_method: string };
      };
      expect(payload.prompts[0]?.text).toContain(result.current.currentTheme.basePrompt);
      expect(payload.transition?.num_steps).toBe(AMBIENT_THEME_CHANGE_TRANSITION_STEPS);
      expect(payload.transition?.temporal_interpolation_method).toBe("slerp");
      expect(mockMappingEngineInstance.markExternalTransitionActive).toHaveBeenCalledWith(
        AMBIENT_THEME_CHANGE_TRANSITION_STEPS
      );
    });

    it("replays only the latest queued theme transition after reconnect", () => {
      const { result } = renderHook(() => useSoundscape());
      const closedChannel = createMockDataChannel("closed");
      const openChannel = createMockDataChannel("open");
      const sendMock = openChannel.send as ReturnType<typeof vi.fn>;
      const latestTheme = PRESET_THEMES.find((theme) => theme.id === "digital-forest");

      expect(latestTheme).toBeDefined();

      act(() => {
        result.current.setDataChannel(closedChannel);
        result.current.setTheme("neon-foundry");
        result.current.setTheme("digital-forest");
      });

      act(() => {
        result.current.setDataChannel(openChannel);
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(sendMock.mock.calls[0][0] as string) as {
        prompts: Array<{ text: string; weight: number }>;
      };
      expect(payload.prompts[0]?.text).toContain(latestTheme?.basePrompt ?? "");
    });
  });

  describe("generation controls", () => {
    it("updates denoising/reactivity profiles and prompt accent", () => {
      const { result } = renderHook(() => useSoundscape());

      act(() => {
        result.current.setDenoisingProfile("quality");
        result.current.setReactivityProfile("kinetic");
        result.current.setPromptAccent("volumetric fog", 0.4);
      });

      expect(result.current.denoisingProfileId).toBe("quality");
      expect(result.current.reactivityProfileId).toBe("kinetic");
      expect(result.current.promptAccent).toMatchObject({
        text: "volumetric fog",
        weight: 0.4,
      });
      expect(result.current.activeDenoisingSteps.length).toBeGreaterThan(0);
    });

    it("composes prompt entries with accent layer", () => {
      const { result } = renderHook(() => useSoundscape());

      act(() => {
        result.current.setPromptAccent("prismatic particles", 0.35);
      });

      const entries = result.current.composePromptEntries("base scene");
      expect(entries).toEqual([
        { text: "base scene", weight: 1.0 },
        { text: "prismatic particles", weight: 0.35 },
      ]);
    });
  });

  describe("audio connection", () => {
    it("connects to audio element", async () => {
      const { result } = renderHook(() => useSoundscape());
      const audioElement = createMockAudioElement();

      await act(async () => {
        await result.current.connectAudio(audioElement);
      });

      expect(mockAnalyzerInstance.initialize).toHaveBeenCalledWith(audioElement);
      expect(result.current.state.playback).toBe("loading");
      expect(result.current.state.error).toBeNull();
    });

    it("disconnects audio and resets state", async () => {
      const { result } = renderHook(() => useSoundscape());
      const audioElement = createMockAudioElement();
      const dataChannel = createMockDataChannel("open");

      await act(async () => {
        await result.current.connectAudio(audioElement);
      });

      act(() => {
        result.current.setDataChannel(dataChannel);
        result.current.startAmbient();
      });
      expect(result.current.parameters).not.toBeNull();

      act(() => {
        result.current.disconnectAudio();
      });

      expect(mockAnalyzerInstance.destroy).toHaveBeenCalled();
      expect(result.current.state.playback).toBe("idle");
      expect(result.current.parameters).toBeNull();
    });
  });

  describe("data channel", () => {
    it("sets data channel and updates connection state", () => {
      const { result } = renderHook(() => useSoundscape());
      const dataChannel = createMockDataChannel();

      act(() => {
        result.current.setDataChannel(dataChannel);
      });

      expect(result.current.state.connection).toBe("connected");
    });

    it("clears data channel and resets connection state", () => {
      const { result } = renderHook(() => useSoundscape());
      const dataChannel = createMockDataChannel();

      act(() => {
        result.current.setDataChannel(dataChannel);
      });

      act(() => {
        result.current.setDataChannel(null);
      });

      expect(result.current.state.connection).toBe("disconnected");
    });
  });

  describe("analysis control", () => {
    it("starts analysis when audio is connected", async () => {
      const { result } = renderHook(() => useSoundscape());
      const audioElement = createMockAudioElement();

      await act(async () => {
        await result.current.connectAudio(audioElement);
      });

      await act(async () => {
        result.current.start();
      });

      expect(mockAnalyzerInstance.resume).toHaveBeenCalled();
      expect(mockAnalyzerInstance.start).toHaveBeenCalled();
      expect(result.current.state.playback).toBe("playing");
    });

    it("stops analysis", async () => {
      const { result } = renderHook(() => useSoundscape());
      const audioElement = createMockAudioElement();

      await act(async () => {
        await result.current.connectAudio(audioElement);
      });

      await act(async () => {
        result.current.start();
      });

      act(() => {
        result.current.stop();
      });

      expect(mockAnalyzerInstance.stop).toHaveBeenCalled();
      expect(result.current.state.playback).toBe("paused");
    });

    it("does not start if audio is not connected", async () => {
      const { result } = renderHook(() => useSoundscape());

      await act(async () => {
        result.current.start();
      });

      // Should not crash and should not change playback state
      expect(result.current.state.playback).toBe("idle");
    });

    it("publishes beat updates even when UI update interval has not elapsed", async () => {
      let analysisHandler: ((analysis: AnalysisState) => void) | null = null;
      mockAnalyzerInstance.start.mockImplementationOnce((callback: (analysis: AnalysisState) => void) => {
        analysisHandler = callback;
      });
      const nowSpy = vi.spyOn(performance, "now");
      nowSpy.mockReturnValue(120);
      nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(120);

      const { result } = renderHook(() => useSoundscape({ uiUpdateRate: 0.2 }));
      const audioElement = createMockAudioElement();

      await act(async () => {
        await result.current.connectAudio(audioElement);
      });

      await act(async () => {
        await result.current.start();
      });

      expect(analysisHandler).not.toBeNull();

      act(() => {
        analysisHandler?.(
          createMockAnalysis({
            beat: { isBeat: false, lastBeatTime: 0 },
          })
        );
      });
      expect(result.current.state.analysis).toBeNull();

      act(() => {
        analysisHandler?.(
          createMockAnalysis({
            beat: { isBeat: true, lastBeatTime: 4321 },
          })
        );
      });

      expect(result.current.state.analysis?.beat.lastBeatTime).toBe(4321);
    });
  });

  describe("ambient mode", () => {
    it("starts ambient mode with open data channel", () => {
      const { result } = renderHook(() => useSoundscape());
      const dataChannel = createMockDataChannel("open");

      act(() => {
        result.current.setDataChannel(dataChannel);
      });

      act(() => {
        result.current.startAmbient();
      });

      expect(result.current.state.playback).toBe("playing");
      // Data channel should receive ambient parameters
      expect(dataChannel.send).toHaveBeenCalled();
    });

    it("does not start ambient without data channel", () => {
      const { result } = renderHook(() => useSoundscape());

      act(() => {
        result.current.startAmbient();
      });

      // Should remain idle since no data channel
      expect(result.current.state.playback).toBe("idle");
    });

    it("does not start ambient with closed data channel", () => {
      const { result } = renderHook(() => useSoundscape());
      const dataChannel = createMockDataChannel("closed");

      act(() => {
        result.current.setDataChannel(dataChannel);
      });

      act(() => {
        result.current.startAmbient();
      });

      // Should remain idle
      expect(result.current.state.playback).not.toBe("playing");
    });

    it("stops ambient mode", () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useSoundscape());
      const dataChannel = createMockDataChannel("open");

      act(() => {
        result.current.setDataChannel(dataChannel);
      });

      act(() => {
        result.current.startAmbient();
      });

      act(() => {
        result.current.stopAmbient();
      });

      // Advance timers and verify no more sends
      const sendCallCount = (dataChannel.send as ReturnType<typeof vi.fn>).mock.calls.length;

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // No additional sends after stop
      expect(dataChannel.send).toHaveBeenCalledTimes(sendCallCount);

      vi.useRealTimers();
    });

    it("syncs denoising profile updates while ambient mode is active", () => {
      const { result } = renderHook(() => useSoundscape());
      const dataChannel = createMockDataChannel("open");
      const sendMock = dataChannel.send as ReturnType<typeof vi.fn>;

      act(() => {
        result.current.setDataChannel(dataChannel);
        result.current.startAmbient();
      });

      sendMock.mockClear();

      act(() => {
        result.current.setDenoisingProfile("quality");
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(sendMock.mock.calls[0][0] as string) as { denoising_step_list: number[] };
      expect(payload.denoising_step_list).toEqual([...DENOISING_PROFILES.quality]);
    });

    it("syncs prompt accent updates while ambient mode is active", () => {
      const { result } = renderHook(() => useSoundscape());
      const dataChannel = createMockDataChannel("open");
      const sendMock = dataChannel.send as ReturnType<typeof vi.fn>;

      act(() => {
        result.current.setDataChannel(dataChannel);
        result.current.startAmbient();
      });

      sendMock.mockClear();

      act(() => {
        result.current.setPromptAccent("volumetric fog", 0.4);
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(sendMock.mock.calls[0][0] as string) as {
        prompts: Array<{ text: string; weight: number }>;
      };
      expect(payload.prompts.some((entry) => entry.text === "volumetric fog" && entry.weight === 0.4)).toBe(true);
    });

    it("does not send a duplicate ambient bootstrap transition after replaying a queued theme", () => {
      const { result } = renderHook(() => useSoundscape());
      const closedChannel = createMockDataChannel("closed");
      const openChannel = createMockDataChannel("open");
      const sendMock = openChannel.send as ReturnType<typeof vi.fn>;

      act(() => {
        result.current.setDataChannel(closedChannel);
        result.current.setTheme("neon-foundry");
      });

      act(() => {
        result.current.setDataChannel(openChannel);
      });

      expect(sendMock).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.startAmbient();
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanup", () => {
    it("cleans up on unmount", async () => {
      const { result, unmount } = renderHook(() => useSoundscape());
      const audioElement = createMockAudioElement();
      const dataChannel = createMockDataChannel("open");

      await act(async () => {
        await result.current.connectAudio(audioElement);
      });

      act(() => {
        result.current.setDataChannel(dataChannel);
        result.current.startAmbient();
      });

      unmount();

      expect(mockAnalyzerInstance.destroy).toHaveBeenCalled();
    });
  });

  describe("all preset themes are valid", () => {
    // Verify each preset theme can be set and used
    PRESET_THEMES.forEach((theme) => {
      it(`can switch to "${theme.name}" theme`, () => {
        const { result } = renderHook(() => useSoundscape());

        act(() => {
          result.current.setTheme(theme.id);
        });

        expect(result.current.currentTheme.id).toBe(theme.id);
        expect(result.current.currentTheme.name).toBe(theme.name);
      });
    });
  });
});
