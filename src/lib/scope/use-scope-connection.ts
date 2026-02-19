/**
 * Shared Scope WebRTC Connection Hook
 * Manages WebRTC connection lifecycle, reconnection logic, and cleanup
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScopeClient } from "./client";
import type { PipelineLoadParams } from "./types";
import { createScopeWebRtcSession, type ScopeDataChannelConfig } from "./webrtc";
import { prepareScopePipeline } from "./pipeline";
import { getUserFriendlyError, isRecoverableError, type UserFriendlyError } from "./error-messages";

// ============================================================================
// Typed Error Handling
// ============================================================================

export type ScopeErrorCode =
  | "HEALTH_CHECK_FAILED"
  | "PIPELINE_LOAD_FAILED"
  | "CONNECTION_FAILED"
  | "CONNECTION_LOST"
  | "STREAM_STOPPED"
  | "DATA_CHANNEL_ERROR"
  | "UNKNOWN";

export interface ScopeError {
  /** Technical error code for logging/debugging */
  code: ScopeErrorCode;
  /** Technical error message (for console/debugging) */
  message: string;
  /** Whether auto-reconnection should be attempted */
  recoverable: boolean;
  /** User-friendly error information for UI display */
  userFriendly: UserFriendlyError;
}

/**
 * Create a typed Scope error with user-friendly messaging.
 * Technical details are preserved for debugging; user-friendly
 * messages are automatically generated for UI display.
 */
export function createScopeError(
  code: ScopeErrorCode,
  technicalMessage: string,
  recoverable?: boolean
): ScopeError {
  const userFriendly = getUserFriendlyError(code, technicalMessage);
  return {
    code,
    message: technicalMessage,
    recoverable: recoverable ?? isRecoverableError(code),
    userFriendly,
  };
}

// ============================================================================
// Connection State
// ============================================================================

// ConnectionState is defined in soundscape/types.ts (single source of truth)
import type { ConnectionState } from "../soundscape/types";
export type { ConnectionState };

export interface UseScopeConnectionOptions {
  /** Scope client instance */
  scopeClient: ScopeClient;
  /** Primary pipeline ID to load (used when pipelineIds is not provided) */
  pipelineId?: string;
  /** Optional pipeline chain (e.g. [preprocessor, main-pipeline]) */
  pipelineIds?: string[];
  /** Pipeline load parameters */
  loadParams?: PipelineLoadParams;
  /** Max reconnection attempts */
  maxReconnectAttempts?: number;
  /** Base delay between reconnection attempts (ms) */
  reconnectBaseDelay?: number;
  /** Callback when stream is received */
  onStream?: (stream: MediaStream) => void;
  /** Callback when data channel opens */
  onDataChannelOpen?: (channel: RTCDataChannel) => void;
  /** Callback when data channel closes */
  onDataChannelClose?: () => void;
  /** Callback when data channel receives a message */
  onDataChannelMessage?: (event: MessageEvent) => void;
  /** Callback when connection is interrupted and reconnection will be attempted */
  onConnectionInterrupted?: (reason?: string) => void;
  /** Callback when connection is fully disconnected (manual or terminal failure) */
  onDisconnect?: (reason?: string) => void;
  /** Custom peer connection setup */
  setupPeerConnection?: (pc: RTCPeerConnection) => void;
  /** Initial WebRTC parameters */
  initialParameters?: Record<string, unknown>;
  /** Attempt reconnection when data channel closes */
  reconnectOnDataChannelClose?: boolean;
  /** Attempt reconnection when stream stops */
  reconnectOnStreamStopped?: boolean;
  /** Optionally gate reconnection attempts */
  shouldReconnect?: (reason: string) => boolean;
  /** Timeout waiting for first remote video track (ms) */
  videoTrackTimeoutMs?: number;
}

export interface ScopeConnectOverrides {
  /** Override primary pipeline ID for this connect attempt */
  pipelineId?: string;
  /** Override pipeline chain for this connect attempt */
  pipelineIds?: string[];
  /** Override pipeline load params for this connect attempt */
  loadParams?: PipelineLoadParams;
  /** Override initial WebRTC parameters for this connect attempt */
  initialParameters?: Record<string, unknown>;
}

export interface UseScopeConnectionReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Human-readable status message */
  statusMessage: string;
  /** Current error (if any) */
  error: ScopeError | null;
  /** Current reconnection attempt count */
  reconnectAttempts: number;
  /** Reference to peer connection */
  peerConnection: RTCPeerConnection | null;
  /** Reference to data channel */
  dataChannel: RTCDataChannel | null;
  /** Connect to Scope */
  connect: (overrides?: ScopeConnectOverrides) => Promise<void>;
  /** Disconnect from Scope */
  disconnect: (preserveError?: boolean) => void;
  /** Clear current error */
  clearError: () => void;
  /** Retry connection (resets attempts) */
  retry: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useScopeConnection(
  options: UseScopeConnectionOptions
): UseScopeConnectionReturn {
  const {
    scopeClient,
    pipelineId,
    pipelineIds,
    loadParams,
    maxReconnectAttempts = 3,
    reconnectBaseDelay = 2000,
    onStream,
    onDataChannelOpen,
    onDataChannelClose,
    onDataChannelMessage,
    onConnectionInterrupted,
    onDisconnect,
    setupPeerConnection,
    initialParameters,
    reconnectOnDataChannelClose = false,
    reconnectOnStreamStopped = false,
    shouldReconnect,
    videoTrackTimeoutMs = 15000,
  } = options;

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<ScopeError | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const sessionDisposerRef = useRef<(() => void) | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoTrackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<(overrides?: ScopeConnectOverrides) => Promise<void>>(async () => {});
  const lastConnectOverridesRef = useRef<ScopeConnectOverrides>({});
  const connectAttemptRef = useRef(0);
  const isConnectingRef = useRef(false);
  const isManualDisconnectRef = useRef(false);
  const isRecoveringRef = useRef(false);

  // Clear reconnect timer
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearVideoTrackTimeout = useCallback(() => {
    if (videoTrackTimeoutRef.current) {
      clearTimeout(videoTrackTimeoutRef.current);
      videoTrackTimeoutRef.current = null;
    }
  }, []);

  // Cleanup connection resources
  const cleanup = useCallback(() => {
    clearReconnectTimer();
    clearVideoTrackTimeout();

    const hadDataChannel = Boolean(dataChannelRef.current);
    if (dataChannelRef.current) {
      dataChannelRef.current.onopen = null;
      dataChannelRef.current.onclose = null;
      dataChannelRef.current.onmessage = null;
    }

    if (sessionDisposerRef.current) {
      sessionDisposerRef.current();
      sessionDisposerRef.current = null;
    } else {
      if (dataChannelRef.current && dataChannelRef.current.readyState !== "closed") {
        dataChannelRef.current.close();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.close();
      }
    }

    dataChannelRef.current = null;
    peerConnectionRef.current = null;

    if (hadDataChannel) {
      onDataChannelClose?.();
    }
  }, [clearReconnectTimer, clearVideoTrackTimeout, onDataChannelClose]);

  // Disconnect
  const disconnect = useCallback(
    (preserveError = false) => {
      connectAttemptRef.current += 1;
      isManualDisconnectRef.current = true;
      isRecoveringRef.current = false;
      cleanup();
      onDisconnect?.("manual disconnect");
      setReconnectAttempts(0);
      isConnectingRef.current = false;
      setConnectionState("disconnected");
      setStatusMessage("");
      if (!preserveError) {
        setError(null);
      }
    },
    [cleanup, onDisconnect]
  );

  // Handle connection lost - attempt reconnection
  const handleConnectionLost = useCallback(
    (reason: string) => {
      if (isManualDisconnectRef.current) {
        isManualDisconnectRef.current = false;
        return;
      }
      if (isRecoveringRef.current) {
        return;
      }
      if (shouldReconnect && !shouldReconnect(reason)) {
        cleanup();
        onDisconnect?.(reason);
        setError(createScopeError("CONNECTION_LOST", reason, false));
        setStatusMessage("Connection stopped");
        setConnectionState("failed");
        return;
      }

      isRecoveringRef.current = true;
      cleanup();
      onConnectionInterrupted?.(reason);
      setReconnectAttempts((prev) => {
        const next = prev + 1;
        if (next > maxReconnectAttempts) {
          setError(createScopeError("CONNECTION_LOST", `${reason}. Max retries exceeded.`, false));
          setConnectionState("failed");
          setStatusMessage("Connection failed");
          isRecoveringRef.current = false;
          onDisconnect?.(`${reason}. Max retries exceeded.`);
          return prev;
        }

        const delay = reconnectBaseDelay * next;
        setStatusMessage(`Reconnecting (${next}/${maxReconnectAttempts})...`);
        setConnectionState("reconnecting");

        clearReconnectTimer();
        reconnectTimeoutRef.current = setTimeout(() => {
          void connectRef.current?.();
        }, delay);

        return next;
      });
    },
    [
      cleanup,
      maxReconnectAttempts,
      reconnectBaseDelay,
      clearReconnectTimer,
      shouldReconnect,
      onConnectionInterrupted,
      onDisconnect,
    ]
  );

  // Connect to Scope
  const connect = useCallback(async (overrides: ScopeConnectOverrides = {}) => {
    if (isConnectingRef.current) {
      return;
    }

    const hasOverrides = Object.keys(overrides).length > 0;
    if (hasOverrides) {
      lastConnectOverridesRef.current = { ...overrides };
    }
    const activeOverrides = hasOverrides ? overrides : lastConnectOverridesRef.current;

    const connectAttemptId = connectAttemptRef.current + 1;
    connectAttemptRef.current = connectAttemptId;
    const isCurrentAttempt = () =>
      connectAttemptRef.current === connectAttemptId && !isManualDisconnectRef.current;

    isManualDisconnectRef.current = false;
    isRecoveringRef.current = false;
    isConnectingRef.current = true;
    clearReconnectTimer();
    clearVideoTrackTimeout();
    setConnectionState("connecting");
    setError(null);

    try {
      let hasReceivedVideoTrack = false;

      // Step 1: Health check
      setStatusMessage("Checking server...");
      const health = await scopeClient.checkHealth();
      if (!isCurrentAttempt()) {
        return;
      }
      if (health.status !== "ok") {
        throw createScopeError("HEALTH_CHECK_FAILED", "Scope server is not healthy. Is the pod running?");
      }

      // Step 2: Load pipeline
      const requestedPipelineIds =
        activeOverrides.pipelineIds && activeOverrides.pipelineIds.length > 0
          ? activeOverrides.pipelineIds
          : activeOverrides.pipelineId
            ? [activeOverrides.pipelineId]
            : pipelineIds && pipelineIds.length > 0
              ? pipelineIds
              : pipelineId
                ? [pipelineId]
                : [];

      if (requestedPipelineIds.length === 0) {
        throw createScopeError("PIPELINE_LOAD_FAILED", "No pipeline selected");
      }

      const resolvedLoadParams = activeOverrides.loadParams ?? loadParams ?? {};

      try {
        await prepareScopePipeline({
          scopeClient,
          pipelineIds: requestedPipelineIds,
          loadParams: resolvedLoadParams,
          onStatus: setStatusMessage,
        });
        if (!isCurrentAttempt()) {
          return;
        }
      } catch (pipelineError) {
        throw createScopeError(
          "PIPELINE_LOAD_FAILED",
          pipelineError instanceof Error ? pipelineError.message : "Pipeline failed to load"
        );
      }

      // Step 3: Create WebRTC session
      setStatusMessage("Creating connection...");

      const resolvedInitialParameters =
        activeOverrides.initialParameters ?? initialParameters;

      const { pc, dataChannel, dispose } = await createScopeWebRtcSession({
        scopeClient,
        initialParameters: resolvedInitialParameters,
        setupPeerConnection: (connection) => {
          peerConnectionRef.current = connection;
          setupPeerConnection?.(connection);
        },
        onTrack: (event) => {
          if (!isCurrentAttempt()) {
            return;
          }
          if (event.track.kind !== "video") {
            return;
          }

          const stream = event.streams[0] ?? new MediaStream([event.track]);
          if (stream) {
            hasReceivedVideoTrack = true;
            clearVideoTrackTimeout();
            onStream?.(stream);
            setStatusMessage("Connected");
            setConnectionState("connected");
            setReconnectAttempts(0);
          }
        },
        onConnectionStateChange: (connection) => {
          if (
            connection.connectionState === "failed" ||
            connection.connectionState === "disconnected"
          ) {
            handleConnectionLost("Connection lost");
          }
        },
        dataChannel: {
          label: "parameters",
          options: { ordered: true },
          onOpen: (channel) => {
            dataChannelRef.current = channel;
            onDataChannelOpen?.(channel);
          },
          onClose: () => {
            dataChannelRef.current = null;
            onDataChannelClose?.();
            if (reconnectOnDataChannelClose) {
              handleConnectionLost("Data channel closed");
            }
          },
          onMessage: (event) => {
            // Handle stream_stopped messages
            try {
              const message = JSON.parse(event.data);
              if (message?.type === "stream_stopped") {
                const streamMessage = message.error_message || "Stream stopped";
                setError(
                  createScopeError("STREAM_STOPPED", streamMessage)
                );
                if (reconnectOnStreamStopped) {
                  handleConnectionLost(streamMessage);
                } else {
                  disconnect(true);
                }
                return;
              }
            } catch (e) {
              if (!(e instanceof SyntaxError)) {
                console.error("[Scope] DataChannel message handler error:", e);
              }
              // SyntaxError = not JSON, pass through to consumer
            }
            onDataChannelMessage?.(event);
          },
        } satisfies ScopeDataChannelConfig,
      });

      if (!isCurrentAttempt()) {
        if (dispose) {
          dispose();
        } else {
          pc.onicecandidate = null;
          pc.ontrack = null;
          pc.onconnectionstatechange = null;
          if (dataChannel && dataChannel.readyState !== "closed") {
            dataChannel.onopen = null;
            dataChannel.onclose = null;
            dataChannel.onmessage = null;
            dataChannel.close();
          }
          pc.close();
        }
        return;
      }

      sessionDisposerRef.current = dispose ?? null;
      peerConnectionRef.current = pc;
      dataChannelRef.current = dataChannel ?? null;
      setReconnectAttempts(0);

      if (!hasReceivedVideoTrack) {
        setStatusMessage("Waiting for video stream...");
        clearVideoTrackTimeout();
        videoTrackTimeoutRef.current = setTimeout(() => {
          if (!isCurrentAttempt()) {
            return;
          }
          handleConnectionLost("Timed out waiting for video stream");
        }, videoTrackTimeoutMs);
      }
    } catch (err) {
      if (!isCurrentAttempt()) {
        return;
      }
      const scopeError =
        err && typeof err === "object" && "code" in err
          ? (err as ScopeError)
          : createScopeError(
              "CONNECTION_FAILED",
              err instanceof Error ? err.message : "Connection failed"
            );
      setError(scopeError);
      setConnectionState("failed");
      setStatusMessage("Connection failed");
      cleanup();
      onDisconnect?.(scopeError.message);
    } finally {
      if (connectAttemptRef.current === connectAttemptId) {
        isConnectingRef.current = false;
      }
    }
  }, [
    scopeClient,
    pipelineId,
    pipelineIds,
    loadParams,
    initialParameters,
    setupPeerConnection,
    onStream,
    onDataChannelOpen,
    onDataChannelClose,
    onDataChannelMessage,
    onDisconnect,
    handleConnectionLost,
    disconnect,
    cleanup,
    clearReconnectTimer,
    clearVideoTrackTimeout,
    reconnectOnDataChannelClose,
    reconnectOnStreamStopped,
    videoTrackTimeoutMs,
  ]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    return () => {
      connectAttemptRef.current += 1;
      cleanup();
      isConnectingRef.current = false;
    };
  }, [cleanup]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Retry connection
  const retry = useCallback(() => {
    setReconnectAttempts(0);
    setError(null);
    connect();
  }, [connect]);

  return {
    connectionState,
    statusMessage,
    error,
    reconnectAttempts,
    peerConnection: peerConnectionRef.current,
    dataChannel: dataChannelRef.current,
    connect,
    disconnect,
    clearError,
    retry,
  };
}
