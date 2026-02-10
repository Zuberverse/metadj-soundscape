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
let lastTrackHandler: ((event: RTCTrackEvent) => void) | undefined;
let connectHarness: (() => Promise<void>) | null = null;
let disconnectHarness: ((preserveError?: boolean) => void) | null = null;

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

function renderHarness(
  scopeClient: ScopeClient,
  options: { videoTrackTimeoutMs?: number } = {}
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Harness() {
    const { connect, disconnect, connectionState, error } = useScopeConnection({
      scopeClient,
      pipelineId: "longlive",
      loadParams: {},
      maxReconnectAttempts: 1,
      reconnectBaseDelay: 20,
      ...options,
    });

    useEffect(() => {
      connectHarness = connect;
      disconnectHarness = disconnect;
      return () => {
        connectHarness = null;
        disconnectHarness = null;
      };
    }, [connect, disconnect]);

    return (
      <div
        data-testid="state"
        data-connection={connectionState}
        data-error-code={error?.code ?? ""}
      />
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
  lastTrackHandler = undefined;
  connectHarness = null;
  disconnectHarness = null;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useScopeConnection", () => {
  it("reconnects after connection loss", async () => {
    vi.useFakeTimers();
    createScopeWebRtcSessionMock.mockImplementation(async (options) => {
      const pc = createFakePeerConnection();
      lastPeerConnection = pc;
      lastTrackHandler = options.onTrack;

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

  it("waits for a video track before setting connected state", async () => {
    createScopeWebRtcSessionMock.mockImplementation(async (options) => {
      const pc = createFakePeerConnection();
      lastPeerConnection = pc;
      lastTrackHandler = options.onTrack;

      if (options.setupPeerConnection) {
        options.setupPeerConnection(pc as unknown as RTCPeerConnection);
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
      if (!connectHarness) {
        throw new Error("Missing connect harness");
      }
      await connectHarness();
    });

    const state = container.querySelector('[data-testid="state"]');
    expect(state?.getAttribute("data-connection")).toBe("connecting");

    await act(async () => {
      lastTrackHandler?.({
        track: { kind: "video" } as MediaStreamTrack,
        streams: [{} as MediaStream],
      } as unknown as RTCTrackEvent);
    });

    expect(state?.getAttribute("data-connection")).toBe("connected");

    unmount();
  });

  it("maps pipeline load failures to PIPELINE_LOAD_FAILED", async () => {
    prepareScopePipelineMock.mockRejectedValueOnce(new Error("pipeline unavailable"));
    createScopeWebRtcSessionMock.mockResolvedValue({
      pc: createFakePeerConnection() as unknown as RTCPeerConnection,
      dataChannel: undefined,
      sessionId: "unused",
    });

    const scopeClient = {
      checkHealth: vi.fn().mockResolvedValue({ status: "ok" }),
    } as unknown as ScopeClient;

    const { container, unmount } = renderHarness(scopeClient);

    await act(async () => {
      if (!connectHarness) {
        throw new Error("Missing connect harness");
      }
      await connectHarness();
    });

    const state = container.querySelector('[data-testid="state"]');
    expect(state?.getAttribute("data-connection")).toBe("failed");
    expect(state?.getAttribute("data-error-code")).toBe("PIPELINE_LOAD_FAILED");
    expect(createScopeWebRtcSessionMock).not.toHaveBeenCalled();

    unmount();
  });

  it("fails with CONNECTION_LOST when no video track arrives before timeout", async () => {
    vi.useFakeTimers();
    createScopeWebRtcSessionMock.mockImplementation(async (options) => {
      const pc = createFakePeerConnection();
      lastPeerConnection = pc;
      lastTrackHandler = options.onTrack;

      if (options.setupPeerConnection) {
        options.setupPeerConnection(pc as unknown as RTCPeerConnection);
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

    const { container, unmount } = renderHarness(scopeClient, { videoTrackTimeoutMs: 25 });

    await act(async () => {
      if (!connectHarness) {
        throw new Error("Missing connect harness");
      }
      await connectHarness();
    });

    const state = container.querySelector('[data-testid="state"]');
    expect(state?.getAttribute("data-connection")).toBe("connecting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(35);
      await flushPromises();
    });

    expect(state?.getAttribute("data-connection")).toBe("reconnecting");
    expect(state?.getAttribute("data-error-code")).toBe("");

    unmount();
  });

  it("ignores stale async connect results after manual disconnect", async () => {
    let resolveSession:
      | ((value: { pc: RTCPeerConnection; dataChannel: undefined; sessionId: string }) => void)
      | null = null;

    createScopeWebRtcSessionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        })
    );

    const scopeClient = {
      checkHealth: vi.fn().mockResolvedValue({ status: "ok" }),
    } as unknown as ScopeClient;

    const { container, unmount } = renderHarness(scopeClient);

    let connectPromise: Promise<void> | null = null;
    await act(async () => {
      if (!connectHarness) {
        throw new Error("Missing connect harness");
      }
      connectPromise = connectHarness();
      await flushPromises();
    });

    await act(async () => {
      await flushPromises();
      disconnectHarness?.(true);
      const pc = createFakePeerConnection() as unknown as RTCPeerConnection;
      resolveSession?.({
        pc,
        dataChannel: undefined,
        sessionId: "late-session",
      });
    });

    if (!connectPromise) {
      throw new Error("Missing connect promise");
    }
    await act(async () => {
      await connectPromise;
    });

    const state = container.querySelector('[data-testid="state"]');
    expect(state?.getAttribute("data-connection")).toBe("disconnected");
    expect(state?.getAttribute("data-error-code")).toBe("");

    unmount();
  });
});
