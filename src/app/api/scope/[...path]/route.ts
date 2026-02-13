/**
 * Scope API Proxy Route
 * Proxies requests to the RunPod Scope API to avoid CORS issues
 */

import { NextRequest, NextResponse } from "next/server";

const SCOPE_API_URL = (
  process.env.SCOPE_API_URL ||
  process.env.NEXT_PUBLIC_SCOPE_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");

const HEADER_ALLOWLIST = ["content-type", "accept", "authorization"];

/**
 * Proxy Security Configuration
 *
 * The proxy is disabled by default in production for security.
 * Enable with SCOPE_PROXY_ENABLE=true only when:
 * 1. Your deployment has proper access controls (Vercel auth, VPN, etc.)
 * 2. The app is not publicly accessible
 *
 * For production deployments, prefer connecting directly to Scope if CORS allows,
 * or ensure your proxy endpoint is protected by your hosting platform's auth.
 */
const PROXY_ENABLED = process.env.NODE_ENV !== "production" || process.env.SCOPE_PROXY_ENABLE === "true";

// Security: Allowlist of valid Scope API path prefixes
// Prevents arbitrary endpoint access through the proxy
const PATH_ALLOWLIST = [
  "health",           // Health check (root-level)
  "api/v1/hardware",  // Hardware info
  "api/v1/pipeline",  // Pipeline management
  "api/v1/pipelines", // Pipeline schemas
  "api/v1/models",    // Model status/download endpoints
  "api/v1/webrtc",    // WebRTC signaling
  "api/v1/assets",    // Asset upload/list/serve endpoints
  "api/v1/lora",      // LoRA management endpoints
  "api/v1/plugins",   // Plugin API (if enabled server-side)
  "plugins",          // Plugin API routes exposed at root
  "api/v1/prompts",   // Prompt operations
  "api/v1/session",   // Session management
];

function isPathAllowed(path: string): boolean {
  // Normalize: remove leading/trailing slashes
  const normalized = path.replace(/^\/+|\/+$/g, "");
  // Reject path traversal attempts outright
  if (normalized.includes("..")) {
    return false;
  }
  return PATH_ALLOWLIST.some((allowed) => normalized === allowed || normalized.startsWith(`${allowed}/`));
}

// Timeout configuration (in milliseconds)
const DEFAULT_TIMEOUT = 30000;
const PIPELINE_LOAD_TIMEOUT = 60000;

function getTimeoutForPath(path: string): number {
  // Pipeline loading can take longer on cold starts
  if (path.includes("pipeline/load")) {
    return PIPELINE_LOAD_TIMEOUT;
  }
  return DEFAULT_TIMEOUT;
}

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join("/");

  // Security: Validate path against allowlist before proxying
  if (!isPathAllowed(targetPath)) {
    console.warn(`[Scope Proxy] Blocked request to non-allowed path: ${targetPath}`);
    return NextResponse.json(
      { error: "Path not allowed" },
      { status: 403 }
    );
  }

  const targetUrl = `${SCOPE_API_URL}/${targetPath}${request.nextUrl.search}`;

  if (!PROXY_ENABLED) {
    return NextResponse.json(
      { error: "Scope proxy disabled in production. Set SCOPE_PROXY_ENABLE=true or use platform-level auth." },
      { status: 403 }
    );
  }

  const headers = new Headers();
  for (const headerName of HEADER_ALLOWLIST) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        body = JSON.stringify(await request.json());
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON in request body" },
          { status: 400 }
        );
      }
    } else {
      body = await request.arrayBuffer();
    }
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutMs = getTimeoutForPath(targetPath);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
    });

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const responseHeaders = new Headers();
    const responseContentType = response.headers.get("content-type");
    if (responseContentType) {
      responseHeaders.set("Content-Type", responseContentType);
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort/timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[Scope Proxy] ${request.method} timeout after ${timeoutMs}ms:`, targetPath);
      return NextResponse.json(
        { error: "Request to Scope API timed out" },
        { status: 504 }
      );
    }

    console.error(`[Scope Proxy] ${request.method} error:`, error);
    return NextResponse.json(
      { error: "Failed to proxy request to Scope API" },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}
