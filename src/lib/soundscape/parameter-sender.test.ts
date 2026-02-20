/**
 * ParameterSender Tests
 * Tests rate-limited WebRTC parameter transmission
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParameterSender } from "./mapping-engine";
import type { ScopeParameters } from "./types";

function createMockDataChannel(readyState: RTCDataChannelState = "open") {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
    onopen: null,
    onclose: null,
    onmessage: null,
  } as unknown as RTCDataChannel;
}

function createTestParams(overrides?: Partial<ScopeParameters>): ScopeParameters {
  return {
    prompts: [{ text: "cosmic voyage, neon lights", weight: 1.0 }],
    denoisingSteps: [1000, 750, 500, 250],
    noiseScale: 0.55,
    ...overrides,
  };
}

describe("ParameterSender", () => {
  let sender: ParameterSender;

  beforeEach(() => {
    vi.useFakeTimers();
    sender = new ParameterSender(30);
  });

  afterEach(() => {
    sender.setDataChannel(null);
    vi.useRealTimers();
  });

  it("sends parameters when channel is open", () => {
    const channel = createMockDataChannel("open");
    sender.setDataChannel(channel);

    const params = createTestParams();
    sender.send(params);
    vi.advanceTimersByTime(50);

    expect(channel.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((channel.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.prompts).toEqual(params.prompts);
    expect(sent.noise_scale).toBe(params.noiseScale);
    expect(sent.denoising_step_list).toEqual(params.denoisingSteps);
  });

  it("drops params when channel is not open", () => {
    const channel = createMockDataChannel("closing");
    sender.setDataChannel(channel);

    sender.send(createTestParams());
    vi.advanceTimersByTime(50);

    expect(channel.send).not.toHaveBeenCalled();
  });

  it("drops params when channel is null", () => {
    sender.setDataChannel(null);

    // Should not throw
    sender.send(createTestParams());
    vi.advanceTimersByTime(50);
  });

  it("does not schedule send timers when channel is not open", () => {
    const channel = createMockDataChannel("closed");
    sender.setDataChannel(channel);

    sender.send(createTestParams());

    expect(vi.getTimerCount()).toBe(0);
    expect(channel.send).not.toHaveBeenCalled();
  });

  it("rate limits sends", () => {
    const channel = createMockDataChannel("open");
    sender.setDataChannel(channel);

    // Send 5 rapid updates
    for (let i = 0; i < 5; i++) {
      sender.send(createTestParams({ noiseScale: 0.5 + i * 0.1 }));
    }

    // Only 1 send should happen (the last pending)
    vi.advanceTimersByTime(50);
    expect(channel.send).toHaveBeenCalledTimes(1);

    // The sent params should be the last one queued
    const sent = JSON.parse((channel.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.noise_scale).toBe(0.9);
  });

  it("clears pending params", () => {
    const channel = createMockDataChannel("open");
    sender.setDataChannel(channel);

    sender.send(createTestParams());
    sender.clearPending();
    vi.advanceTimersByTime(50);

    expect(channel.send).not.toHaveBeenCalled();
  });

  it("formats transition parameters correctly", () => {
    const channel = createMockDataChannel("open");
    sender.setDataChannel(channel);

    const params = createTestParams({
      transition: {
        target_prompts: [{ text: "new theme prompt", weight: 1.0 }],
        num_steps: 6,
        temporal_interpolation_method: "slerp",
      },
    });

    sender.send(params);
    vi.advanceTimersByTime(50);

    const sent = JSON.parse((channel.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.transition).toBeDefined();
    expect(sent.transition.num_steps).toBe(6);
    expect(sent.transition.temporal_interpolation_method).toBe("slerp");
  });

  it("handles send errors gracefully", () => {
    const channel = createMockDataChannel("open");
    (channel.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("DataChannel send failed");
    });
    sender.setDataChannel(channel);

    // Should not throw
    sender.send(createTestParams());
    vi.advanceTimersByTime(50);

    expect(channel.send).toHaveBeenCalled();
  });

  it("resets when channel is set to null", () => {
    const channel = createMockDataChannel("open");
    sender.setDataChannel(channel);
    sender.send(createTestParams());

    sender.setDataChannel(null);
    vi.advanceTimersByTime(50);

    // No sends after channel removal
    expect(channel.send).not.toHaveBeenCalled();
  });

  it("disposes sender resources", () => {
    const channel = createMockDataChannel("open");
    sender.setDataChannel(channel);
    sender.send(createTestParams());

    sender.dispose();
    vi.advanceTimersByTime(50);

    expect(channel.send).not.toHaveBeenCalled();
  });
});
