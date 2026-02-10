/**
 * Scope API Client
 * Handles communication with the Daydream Scope API server
 */

import type {
  HealthResponse,
  IceCandidatePayload,
  IceServersResponse,
  PipelineDescriptor,
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
   * Fetch pipeline schema map from Scope.
   */
  private async fetchPipelineSchemaMap(): Promise<Record<string, Record<string, unknown>> | null> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/pipelines/schemas`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to get pipelines: ${response.status}`);
    }

    const data: PipelineSchemasResponse | Record<string, unknown> | string[] = await response.json();

    if (Array.isArray(data)) {
      return Object.fromEntries(
        data
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((id) => [id, {}])
      );
    }

    if (!data || typeof data !== "object") {
      return {};
    }

    const root = data as Record<string, unknown>;
    const candidate =
      root.schemas && typeof root.schemas === "object" && !Array.isArray(root.schemas)
        ? (root.schemas as Record<string, unknown>)
        : root;

    const normalized: Record<string, Record<string, unknown>> = {};
    for (const [id, schema] of Object.entries(candidate)) {
      if (!id.trim()) continue;
      normalized[id] =
        schema && typeof schema === "object" && !Array.isArray(schema)
          ? (schema as Record<string, unknown>)
          : {};
    }

    return normalized;
  }

  /**
   * Get available pipelines (schema keys)
   */
  async getPipelines(): Promise<string[]> {
    try {
      const schemas = await this.fetchPipelineSchemaMap();
      return Object.keys(schemas ?? {});
    } catch (error) {
      console.error("[Scope] Failed to get pipelines:", error);
      return [];
    }
  }

  /**
   * Get normalized pipeline descriptors from schema metadata.
   */
  async getPipelineDescriptors(): Promise<PipelineDescriptor[]> {
    try {
      const schemas = await this.fetchPipelineSchemaMap();
      if (!schemas) return [];

      const parseUsage = (value: unknown): string[] => {
        if (Array.isArray(value)) {
          return value.filter((item): item is string => typeof item === "string");
        }
        if (typeof value === "string" && value.trim()) {
          return [value];
        }
        return [];
      };

      const parseBoolean = (value: unknown): boolean | undefined => {
        if (typeof value === "boolean") return value;
        return undefined;
      };

      const parseNumber = (value: unknown): number | null | undefined => {
        if (typeof value === "number" && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === "string" && value.trim().length > 0) {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return undefined;
      };

      const parseSource = (value: unknown): "builtin" | "plugin" | "unknown" => {
        if (value === "builtin" || value === "plugin") {
          return value;
        }
        return "unknown";
      };

      return Object.entries(schemas).map(([id, schema]) => ({
        id,
        name:
          (typeof schema.pipeline_name === "string" && schema.pipeline_name) ||
          (typeof schema.name === "string" && schema.name) ||
          id,
        description:
          (typeof schema.pipeline_description === "string" && schema.pipeline_description) ||
          (typeof schema.description === "string" && schema.description) ||
          undefined,
        version:
          (typeof schema.pipeline_version === "string" && schema.pipeline_version) ||
          (typeof schema.version === "string" && schema.version) ||
          undefined,
        usage: parseUsage(schema.usage),
        supportsVace: parseBoolean(schema.supports_vace),
        supportsLora: parseBoolean(schema.supports_lora),
        estimatedVramGb: parseNumber(schema.estimated_vram_gb),
        source: parseSource(schema.source),
      }));
    } catch (error) {
      console.error("[Scope] Failed to get pipeline descriptors:", error);
      return [];
    }
  }

  /**
   * Load a pipeline on the server
   */
  async loadPipeline(pipelineId: string | string[], loadParams?: PipelineLoadParams): Promise<boolean> {
    try {
      const pipelineIds = Array.isArray(pipelineId) ? pipelineId : [pipelineId];
      const normalizedPipelineIds = Array.from(
        new Set(pipelineIds.map((id) => id.trim()).filter((id) => id.length > 0))
      );

      if (normalizedPipelineIds.length === 0) {
        throw new Error("No pipeline IDs provided");
      }

      const body: Record<string, unknown> = { pipeline_ids: normalizedPipelineIds };
      if (loadParams && Object.keys(loadParams).length > 0) {
        body.load_params = loadParams;
      }

      let response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/v1/pipeline/load`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        60000 // Pipeline loading can take longer on cold starts
      );

      // Compatibility fallback for older Scope servers that still expect `pipeline_id`.
      if (
        !response.ok &&
        normalizedPipelineIds.length === 1 &&
        (response.status === 400 || response.status === 422)
      ) {
        const legacyBody: Record<string, unknown> = { pipeline_id: normalizedPipelineIds[0] };
        if (loadParams && Object.keys(loadParams).length > 0) {
          legacyBody.load_params = loadParams;
        }

        response = await this.fetchWithTimeout(
          `${this.baseUrl}/api/v1/pipeline/load`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(legacyBody),
          },
          60000
        );
      }

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
