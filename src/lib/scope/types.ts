/**
 * Scope API Types
 * Based on Daydream Scope API documentation
 */

// Pipeline configuration
export interface PipelineConfig {
  id: string;
  name: string;
  model: string;
  width: number;
  height: number;
}

// Optional pipeline load parameters (Scope API)
export interface PipelineLoadParams {
  width?: number;
  height?: number;
  seed?: number;
  vace_enabled?: boolean;
  output_ndi?: boolean;
  output_spout?: boolean;
  loras?: Array<{ path: string; scale?: number }>;
  lora_merge_mode?: "permanent_merge" | "runtime_peft";
  [key: string]: unknown;
}

// Stream status response
export interface StreamStatus {
  id: string;
  status: "idle" | "starting" | "running" | "stopping" | "error";
  fps?: number;
  bitrate?: number;
  error?: string;
}

// API health check response
export interface HealthResponse {
  status: "ok" | "error";
  version?: string;
  gpu?: string;
  vram?: string;
}

export interface HardwareInfoResponse {
  gpu_name?: string;
  gpu?: string;
  total_vram_mb?: number;
  free_vram_mb?: number;
  spout_available?: boolean;
  ndi_available?: boolean;
  [key: string]: unknown;
}

export interface ModelStatusResponse {
  [key: string]: unknown;
}

export interface LoraListResponse {
  loras?: Array<string | { name?: string; path?: string }>;
  items?: Array<string | { name?: string; path?: string }>;
  [key: string]: unknown;
}

export interface ScopePluginDescriptor {
  id: string;
  name: string;
  version?: string;
  enabled?: boolean;
  source?: string;
}

// Pipeline status values returned by Scope API
export type PipelineStatus = "not_loaded" | "loading" | "loaded" | "error" | "idle" | "unloading";

export interface PipelineStatusResponse {
  status: PipelineStatus;
  error?: string;
}

export interface PipelineSchemasResponse {
  schemas?: Record<string, unknown>;
}

export type PipelineSource = "builtin" | "plugin" | "unknown";

export interface PipelineDescriptor {
  id: string;
  name: string;
  description?: string;
  version?: string;
  usage: string[];
  supportsVace?: boolean;
  supportsLora?: boolean;
  estimatedVramGb?: number | null;
  source: PipelineSource;
}

export interface IceServersResponse {
  iceServers: RTCIceServer[];
}

export interface WebRtcOfferRequest {
  sdp: string;
  type: RTCSdpType;
  initialParameters?: Record<string, unknown>;
}

export interface WebRtcOfferResponse {
  sessionId: string;
  sdp: string;
  type: RTCSdpType;
}

export interface IceCandidatePayload {
  candidate: string | undefined;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}
