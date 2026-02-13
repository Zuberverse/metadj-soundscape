/**
 * Scope API Client
 * Handles communication with the Daydream Scope API server
 */

import type {
  HealthResponse,
  HardwareInfoResponse,
  IceCandidatePayload,
  IceServersResponse,
  LoraListResponse,
  ScopePluginDescriptor,
  ModelStatusResponse,
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
   * Get hardware details (GPU/VRAM/Spout capabilities).
   */
  async getHardwareInfo(): Promise<HardwareInfoResponse | null> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/hardware/info`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to get hardware info: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("[Scope] Failed to get hardware info:", error);
      return null;
    }
  }

  /**
   * Get model readiness status, optionally for a specific pipeline.
   */
  async getModelStatus(pipelineId?: string): Promise<ModelStatusResponse | null> {
    try {
      const query = pipelineId ? `?pipeline_id=${encodeURIComponent(pipelineId)}` : "";
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/models/status${query}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to get model status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("[Scope] Failed to get model status:", error);
      return null;
    }
  }

  /**
   * List available LoRA files.
   */
  async getLoraList(): Promise<string[]> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/lora/list`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to get lora list: ${response.status}`);
      }

      const data: LoraListResponse | unknown = await response.json();
      if (!data || typeof data !== "object") {
        return [];
      }

      const source = (data as LoraListResponse).loras ?? (data as LoraListResponse).items ?? [];
      if (!Array.isArray(source)) {
        return [];
      }

      return source
        .map((entry) => {
          if (typeof entry === "string") return entry;
          if (!entry || typeof entry !== "object") return "";
          const candidate = entry.name ?? entry.path;
          return typeof candidate === "string" ? candidate : "";
        })
        .filter((entry) => entry.trim().length > 0);
    } catch (error) {
      console.error("[Scope] Failed to get lora list:", error);
      return [];
    }
  }

  /**
   * List registered plugins (if plugin server enabled).
   */
  async getPlugins(): Promise<ScopePluginDescriptor[]> {
    const toDescriptor = (
      id: string,
      name: string,
      record?: Record<string, unknown>
    ): ScopePluginDescriptor => {
      const descriptor: ScopePluginDescriptor = { id, name };
      if (!record) return descriptor;
      if (typeof record.version === "string") descriptor.version = record.version;
      if (typeof record.enabled === "boolean") descriptor.enabled = record.enabled;
      if (typeof record.source === "string") descriptor.source = record.source;
      return descriptor;
    };

    const normalizePlugins = (data: unknown): ScopePluginDescriptor[] => {
      if (Array.isArray(data)) {
        const normalized: ScopePluginDescriptor[] = [];
        data.forEach((entry, index) => {
          if (!entry || typeof entry !== "object") return;
          const record = entry as Record<string, unknown>;
          const idCandidate = record.id ?? record.name ?? `plugin-${index + 1}`;
          const nameCandidate = record.name ?? record.id ?? `Plugin ${index + 1}`;
          normalized.push(toDescriptor(String(idCandidate), String(nameCandidate), record));
        });
        return normalized;
      }

      if (!data || typeof data !== "object") {
        return [];
      }

      const root = data as Record<string, unknown>;
      const entries = root.plugins ?? root.items ?? root.data;
      if (Array.isArray(entries)) {
        return normalizePlugins(entries);
      }

      if (entries && typeof entries === "object") {
        return Object.entries(entries as Record<string, unknown>).map(([id, value]) => {
          if (value && typeof value === "object") {
            const record = value as Record<string, unknown>;
            return toDescriptor(id, typeof record.name === "string" ? record.name : id, record);
          }
          return toDescriptor(id, id, { source: "plugin" });
        });
      }

      return [];
    };

    const fetchPluginEndpoint = async (path: string): Promise<ScopePluginDescriptor[]> => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/${path}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return normalizePlugins(data);
    };

    try {
      const fromApi = await fetchPluginEndpoint("api/v1/plugins");
      if (fromApi.length > 0) {
        return fromApi;
      }
      return fetchPluginEndpoint("plugins");
    } catch (error) {
      console.error("[Scope] Failed to get plugins:", error);
      return [];
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

      const data = await response.json();

      // Validate critical sessionId field — downstream ICE candidate calls depend on it
      if (!data.sessionId || typeof data.sessionId !== "string") {
        throw new Error("Invalid WebRTC offer response: missing sessionId");
      }

      return data;
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
