import type { ScopeClient } from "./client";
import type { IceCandidatePayload, WebRtcOfferRequest } from "./types";

export interface ScopeDataChannelConfig {
  label?: string;
  options?: RTCDataChannelInit;
  onOpen?: (channel: RTCDataChannel) => void;
  onClose?: (channel: RTCDataChannel) => void;
  onMessage?: (event: MessageEvent, channel: RTCDataChannel) => void;
}

export interface ScopeWebRtcSessionOptions {
  scopeClient: ScopeClient;
  initialParameters?: WebRtcOfferRequest["initialParameters"];
  setupPeerConnection?: (pc: RTCPeerConnection) => void;
  onTrack?: (event: RTCTrackEvent) => void;
  onConnectionStateChange?: (pc: RTCPeerConnection) => void;
  dataChannel?: ScopeDataChannelConfig | null;
}

export interface ScopeWebRtcSession {
  pc: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  sessionId: string;
  dispose?: () => void;
}

export async function createScopeWebRtcSession(
  options: ScopeWebRtcSessionOptions
): Promise<ScopeWebRtcSession> {
  const { scopeClient, initialParameters, setupPeerConnection, onTrack, onConnectionStateChange } =
    options;

  const iceConfig = await scopeClient.getIceServers();
  if (!iceConfig) {
    throw new Error("Failed to get ICE servers");
  }

  const pc = new RTCPeerConnection({ iceServers: iceConfig.iceServers });
  const pendingCandidates: IceCandidatePayload[] = [];
  const retryCandidates: IceCandidatePayload[] = [];
  let sessionId: string | null = null;
  let dataChannel: RTCDataChannel | undefined;
  let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let isRetryFlushInProgress = false;
  let disposed = false;

  const clearRetryTimeout = () => {
    if (retryTimeoutId) {
      clearTimeout(retryTimeoutId);
      retryTimeoutId = null;
    }
  };

  const disposeSession = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    clearRetryTimeout();
    sessionId = null;
    pendingCandidates.length = 0;
    retryCandidates.length = 0;
    isRetryFlushInProgress = false;
    pc.removeEventListener("connectionstatechange", handleConnectionCleanup);
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
  };

  const handleConnectionCleanup = () => {
    if (
      pc.connectionState === "closed" ||
      pc.connectionState === "failed" ||
      pc.connectionState === "disconnected"
    ) {
      clearRetryTimeout();
    }
  };
  pc.addEventListener("connectionstatechange", handleConnectionCleanup);

  const scheduleRetryFlush = () => {
    if (disposed || retryTimeoutId || !sessionId || retryCandidates.length === 0) {
      return;
    }
    retryTimeoutId = setTimeout(async () => {
      retryTimeoutId = null;
      if (disposed || !sessionId || retryCandidates.length === 0 || isRetryFlushInProgress) {
        return;
      }

      isRetryFlushInProgress = true;
      const batch = retryCandidates.splice(0, retryCandidates.length);
      const ok = await scopeClient.addIceCandidates(sessionId, batch);
      isRetryFlushInProgress = false;

      if (disposed) {
        return;
      }

      if (!ok) {
        retryCandidates.unshift(...batch);
        console.warn("[Scope] Failed to flush retry ICE candidates");
        scheduleRetryFlush();
      }
    }, 400);
  };

  try {
    pc.onicecandidate = async (event) => {
      if (disposed) return;
      if (!event.candidate) return;

      const payload: IceCandidatePayload = {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      };

      if (sessionId) {
        const ok = await scopeClient.addIceCandidates(sessionId, [payload]);
        if (disposed) return;
        if (!ok) {
          retryCandidates.push(payload);
          console.warn("[Scope] Failed to send ICE candidate (queued for retry)");
          scheduleRetryFlush();
        } else if (retryCandidates.length > 0) {
          scheduleRetryFlush();
        }
      } else {
        pendingCandidates.push(payload);
      }
    };

    if (onTrack) {
      pc.ontrack = onTrack;
    }

    if (onConnectionStateChange) {
      pc.onconnectionstatechange = () => onConnectionStateChange(pc);
    }

    setupPeerConnection?.(pc);

    if (options.dataChannel !== null) {
      const {
        label = "parameters",
        options: channelOptions = { ordered: true },
        onOpen,
        onClose,
        onMessage,
      } = options.dataChannel ?? {};

      dataChannel = pc.createDataChannel(label, channelOptions);
      // Capture reference for callbacks - channel is guaranteed defined at this point
      const channel = dataChannel;

      if (onOpen) {
        channel.onopen = () => onOpen(channel);
      }

      if (onClose) {
        channel.onclose = () => onClose(channel);
      }

      if (onMessage) {
        channel.onmessage = (event) => onMessage(event, channel);
      }
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const localDesc = pc.localDescription;
    if (!localDesc?.sdp) {
      throw new Error("Failed to create local description");
    }

    const answer = await scopeClient.createWebRtcOffer({
      sdp: localDesc.sdp,
      type: localDesc.type,
      initialParameters,
    });

    if (!answer) {
      throw new Error("Failed to get answer from Scope");
    }

    await pc.setRemoteDescription({ sdp: answer.sdp, type: answer.type });
    sessionId = answer.sessionId;

    if (pendingCandidates.length > 0) {
      const pendingBatch = pendingCandidates.splice(0, pendingCandidates.length);
      const ok = await scopeClient.addIceCandidates(sessionId, pendingBatch);
      if (!ok) {
        retryCandidates.push(...pendingBatch);
        console.warn("[Scope] Failed to flush pending ICE candidates (queued for retry)");
        scheduleRetryFlush();
      }
    }

    return { pc, dataChannel, sessionId, dispose: disposeSession };
  } catch (error) {
    disposeSession();
    throw error;
  }
}
