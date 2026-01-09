/**
 * Scope API Client
 * Handles communication with the Daydream Scope API server
 */

import type {
  HealthResponse,
  IceCandidatePayload,
  IceServersResponse,
  PipelineLoadParams,
  PipelineSchemasResponse,
  PipelineStatusResponse,
  WebRtcOfferRequest,
  WebRtcOfferResponse,
} from "./types";

export class ScopeClient {
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(baseUrl?: string, timeout = 30000) {
    // Use local API proxy to avoid CORS issues with RunPod
    // Browser requests go through /api/scope/* which proxies to the actual Scope API
    // Note: Proxy authentication is handled server-side, not via client headers
    this.baseUrl = baseUrl || "/api/scope";
    // Remove trailing slash if present
    this.baseUrl = this.baseUrl.replace(/\/$/, "");
    this.defaultTimeout = timeout;
  }

  /**
   * Create a fetch request with timeout support
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout?: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = timeout ?? this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check API health and connectivity
   */
  async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/health`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
        10000 // Health checks use a shorter timeout
      );

      if (!response.ok) {
        return { status: "error" };
      }

      const data = await response.json();
      return {
        status: "ok",
        version: data.version,
        gpu: data.gpu,
        vram: data.vram,
      };
    } catch (error) {
      console.error("[Scope] Health check failed:", error);
      return { status: "error" };
    }
  }

  /**
   * Get available pipelines (schema keys)
   */
  async getPipelines(): Promise<string[]> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/pipelines/schemas`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to get pipelines: ${response.status}`);
      }

      const data: PipelineSchemasResponse | Record<string, unknown> | string[] = await response.json();

      if (Array.isArray(data)) {
        return data.filter((item): item is string => typeof item === "string");
      }

      const schemas =
        typeof data === "object" && data && "schemas" in data && typeof data.schemas === "object"
          ? (data.schemas as Record<string, unknown>)
          : (data as Record<string, unknown>);

      return Object.keys(schemas || {});
    } catch (error) {
      console.error("[Scope] Failed to get pipelines:", error);
      return [];
    }
  }

  /**
   * Load a pipeline on the server
   */
  async loadPipeline(pipelineId: string, loadParams?: PipelineLoadParams): Promise<boolean> {
    try {
      const body: Record<string, unknown> = { pipeline_id: pipelineId };
      if (loadParams && Object.keys(loadParams).length > 0) {
        body.load_params = loadParams;
      }

      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/v1/pipeline/load`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        60000 // Pipeline loading can take longer on cold starts
      );

      return response.ok;
    } catch (error) {
      console.error("[Scope] Failed to load pipeline:", error);
      return false;
    }
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(): Promise<PipelineStatusResponse | null> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/pipeline/status`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to get pipeline status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("[Scope] Failed to get pipeline status:", error);
      return null;
    }
  }

  /**
   * Wait for pipeline to reach loaded state
   */
  async waitForPipelineLoaded(
    timeoutMs = 120000,
    pollIntervalMs = 1000
  ): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this.getPipelineStatus();
      if (status?.status === "loaded") {
        return true;
      }
      if (status?.status === "error") {
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    return false;
  }

  /**
   * Get ICE server configuration for WebRTC
   */
  async getIceServers(): Promise<IceServersResponse | null> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/webrtc/ice-servers`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to get ICE servers: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("[Scope] Failed to get ICE servers:", error);
      return null;
    }
  }

  /**
   * Create a WebRTC offer session
   */
  async createWebRtcOffer(payload: WebRtcOfferRequest): Promise<WebRtcOfferResponse | null> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/webrtc/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to create WebRTC offer: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("[Scope] Failed to create WebRTC offer:", error);
      return null;
    }
  }

  /**
   * Add ICE candidates to an existing WebRTC session
   */
  async addIceCandidates(sessionId: string, candidates: IceCandidatePayload[]): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/webrtc/offer/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates }),
      });

      return response.ok;
    } catch (error) {
      console.error("[Scope] Failed to add ICE candidates:", error);
      return false;
    }
  }

  /**
   * Get the base URL for this client
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Singleton instance for the app
let scopeClientInstance: ScopeClient | null = null;

export function getScopeClient(): ScopeClient {
  if (!scopeClientInstance) {
    scopeClientInstance = new ScopeClient();
  }
  return scopeClientInstance;
}
