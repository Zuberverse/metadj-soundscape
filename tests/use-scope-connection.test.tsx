import React, { useEffect } from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { ScopeClient } from "@/lib/scope/client";
import { useScopeConnection } from "@/lib/scope/use-scope-connection";
import { prepareScopePipeline } from "@/lib/scope/pipeline";
import { createScopeWebRtcSession } from "@/lib/scope/webrtc";

vi.mock("@/lib/scope/pipeline", () => ({
  prepareScopePipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/scope/webrtc", () => ({
  createScopeWebRtcSession: vi.fn(),
}));

const prepareScopePipelineMock = vi.mocked(prepareScopePipeline);
const createScopeWebRtcSessionMock = vi.mocked(createScopeWebRtcSession);

type FakePeerConnection = {
  connectionState: RTCPeerConnectionState;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
  ontrack: ((event: RTCTrackEvent) => void) | null;
  onconnectionstatechange: (() => void) | null;
  close: () => void;
};

let lastPeerConnection: FakePeerConnection | null = null;
let connectHarness: (() => Promise<void>) | null = null;

function createFakePeerConnection(): FakePeerConnection {
  return {
    connectionState: "new",
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
    close: vi.fn(),
  };
}

function flushPromises() {
  return Promise.resolve();
}

function renderHarness(scopeClient: ScopeClient) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Harness() {
    const { connect, connectionState } = useScopeConnection({
      scopeClient,
      pipelineId: "longlive",
      loadParams: {},
      maxReconnectAttempts: 1,
      reconnectBaseDelay: 20,
    });

    useEffect(() => {
      connectHarness = connect;
      return () => {
        connectHarness = null;
      };
    }, [connect]);

    return (
      <div data-testid="state" data-connection={connectionState} />
    );
  }

  act(() => {
    root.render(<Harness />);
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  lastPeerConnection = null;
  connectHarness = null;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useScopeConnection", () => {
  it("reconnects after connection loss", async () => {
    vi.useFakeTimers();
    createScopeWebRtcSessionMock.mockImplementation(async (options) => {
      const pc = createFakePeerConnection();
      lastPeerConnection = pc;

      if (options.setupPeerConnection) {
        options.setupPeerConnection(pc as unknown as RTCPeerConnection);
      }

      if (options.onConnectionStateChange) {
        pc.onconnectionstatechange = () => {
          options.onConnectionStateChange?.(pc as unknown as RTCPeerConnection);
        };
      }

      if (options.onTrack) {
        const trackEvent = {
          track: { kind: "video" } as MediaStreamTrack,
          streams: [{} as MediaStream],
        } as unknown as RTCTrackEvent;
        options.onTrack(trackEvent);
      }

      return {
        pc: pc as unknown as RTCPeerConnection,
        dataChannel: undefined,
        sessionId: "session",
      };
    });

    const scopeClient = {
      checkHealth: vi.fn().mockResolvedValue({ status: "ok" }),
    } as unknown as ScopeClient;

    const { container, unmount } = renderHarness(scopeClient);

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      if (!connectHarness) {
        throw new Error("Missing connect harness");
      }
      await connectHarness();
    });

    const state = container.querySelector('[data-testid="state"]');
    expect(prepareScopePipelineMock).toHaveBeenCalledTimes(1);
    expect(createScopeWebRtcSessionMock).toHaveBeenCalledTimes(1);
    expect(state?.getAttribute("data-connection")).toBe("connected");

    act(() => {
      if (!lastPeerConnection?.onconnectionstatechange) {
        throw new Error("Missing connection state handler");
      }
      lastPeerConnection.connectionState = "failed";
      lastPeerConnection.onconnectionstatechange();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(state?.getAttribute("data-connection")).toBe("reconnecting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
      await flushPromises();
    });

    expect(createScopeWebRtcSessionMock).toHaveBeenCalledTimes(2);

    unmount();
  });
});
