import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import SoundscapePage from "../src/app/soundscape/page";

vi.mock("@/components/soundscape", () => ({
  SoundscapeStudio: () => <div data-testid="soundscape-stub" />,
}));

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function renderSoundscape() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(<SoundscapePage />);
  });

  return {
    container,
    unmount: () => {
      act(() => root!.unmount());
      container!.remove();
    },
  };
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
  }
  if (container) {
    container.remove();
  }
  container = null;
  root = null;
});

describe("Soundscape page", () => {
  it("renders the studio inside the main content container", () => {
    const { container, unmount } = renderSoundscape();

    const studio = container.querySelector('[data-testid="soundscape-stub"]');
    const main = container.querySelector("main#main-content");

    expect(studio).toBeTruthy();
    expect(main).toBeTruthy();
    expect(main?.contains(studio)).toBe(true);

    unmount();
  });

  it("uses the expected viewport shell classes", () => {
    const { container, unmount } = renderSoundscape();

    const shell = container.firstElementChild as HTMLElement | null;

    expect(shell).toBeTruthy();
    expect(shell?.className).toContain("min-h-dvh");
    expect(shell?.className).toContain("h-dvh");
    expect(shell?.className).toContain("bg-scope-bg");

    unmount();
  });

  it("renders both ambient glow background layers", () => {
    const { container, unmount } = renderSoundscape();

    const glowLayers = container.querySelectorAll(".glow-bg");
    expect(glowLayers.length).toBe(2);

    unmount();
  });
});
