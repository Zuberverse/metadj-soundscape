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
    expect(heading?.textContent).toContain("Soundscape");

    unmount();
  });

  it("closes the help modal on Escape and restores focus", () => {
    const { container, unmount } = renderSoundscape();

    const helpButton = container.querySelector(
      'button[aria-label="Show keyboard shortcuts"]'
    ) as HTMLButtonElement;
    expect(helpButton).toBeTruthy();

    helpButton.focus();
    act(() => {
      helpButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    const closeButton = container.querySelector('button[aria-label="Close help"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(closeButton);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(helpButton);

    unmount();
  });

  it("keeps keyboard focus trapped inside the help modal", () => {
    const { container, unmount } = renderSoundscape();

    const helpButton = container.querySelector(
      'button[aria-label="Show keyboard shortcuts"]'
    ) as HTMLButtonElement;

    act(() => {
      helpButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const closeButton = container.querySelector('button[aria-label="Close help"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(closeButton);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(document.activeElement).toBe(closeButton);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })
      );
    });
    expect(document.activeElement).toBe(closeButton);

    unmount();
  });
});
