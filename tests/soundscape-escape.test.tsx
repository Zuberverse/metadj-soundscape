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
  it("renders the soundscape studio", () => {
    const { container, unmount } = renderSoundscape();

    const studio = container.querySelector('[data-testid="soundscape-stub"]');
    expect(studio).toBeTruthy();

    // Verify branding is present
    const heading = container.querySelector("h1");
    expect(heading?.textContent).toContain("MetaDJ Soundscape");

    unmount();
  });
});
