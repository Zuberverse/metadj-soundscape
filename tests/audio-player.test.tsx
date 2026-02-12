import React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { AudioPlayer, type AudioPlayerControls } from "@/components/soundscape/AudioPlayer";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let controls: AudioPlayerControls | null = null;

const playMock = vi.fn(async () => undefined);
const pauseMock = vi.fn();

describe("AudioPlayer", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(playMock as never);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pauseMock as never);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    container = null;
    root = null;
    controls = null;
    vi.restoreAllMocks();
  });

  it("registers transport controls and toggles playback", async () => {
    const onAudioElement = vi.fn(async () => undefined);
    const onPlayStateChange = vi.fn();

    act(() => {
      root?.render(
        <AudioPlayer
          compact
          onAudioElement={onAudioElement}
          onPlayStateChange={onPlayStateChange}
          onRegisterControls={(nextControls) => {
            controls = nextControls;
          }}
        />
      );
    });

    expect(controls).toBeTruthy();

    await act(async () => {
      await controls?.togglePlayPause();
    });

    expect(onAudioElement).toHaveBeenCalled();
    expect(onPlayStateChange).toHaveBeenCalledWith(true);

    await act(async () => {
      await controls?.togglePlayPause();
    });

    expect(onPlayStateChange).toHaveBeenCalledWith(false);
  });
});
