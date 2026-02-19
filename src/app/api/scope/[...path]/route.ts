/**
 * Scope API Proxy Route
 * Proxies requests to the RunPod Scope API to avoid CORS issues
 */

import { NextRequest, NextResponse } from "next/server";

const SERVER_SCOPE_API_URL = process.env.SCOPE_API_URL?.trim();
const PUBLIC_SCOPE_API_URL = process.env.NEXT_PUBLIC_SCOPE_API_URL?.trim();
const SCOPE_API_URL = (
  SERVER_SCOPE_API_URL ||
  PUBLIC_SCOPE_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const HEADER_ALLOWLIST = ["content-type", "accept"];
const WRITE_AUTH_TOKEN = process.env.SCOPE_PROXY_WRITE_TOKEN?.trim() || "";
const REQUIRE_WRITE_TOKEN_IN_PROD = process.env.SCOPE_PROXY_REQUIRE_WRITE_TOKEN !== "false";
const WRITE_AUTH_HEADER = (process.env.SCOPE_PROXY_WRITE_TOKEN_HEADER || "x-scope-proxy-token")
  .trim()
  .toLowerCase();
const TRUST_FORWARDED_IP = !IS_PRODUCTION || process.env.SCOPE_PROXY_TRUST_FORWARDED_IP === "true";
const FORWARDED_IP_HEADER = process.env.SCOPE_PROXY_IP_HEADER?.trim().toLowerCase();
const DEFAULT_MAX_REQUEST_BODY_BYTES = 512 * 1024;
const MAX_REQUEST_BODY_BYTES = (() => {
  const value = Number.parseInt(process.env.SCOPE_PROXY_MAX_BODY_BYTES ?? "", 10);
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_MAX_REQUEST_BODY_BYTES;
  }
  return value;
})();

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
const PROXY_ENABLED = !IS_PRODUCTION || process.env.SCOPE_PROXY_ENABLE === "true";

// Security: strict endpoint matrix based on what the Soundscape app actually uses.
const PATH_ALLOWLIST: Record<string, RegExp[]> = {
  GET: [
    /^health$/,
    /^api\/v1\/hardware\/info$/,
    /^api\/v1\/pipeline\/status$/,
    /^api\/v1\/pipelines\/schemas$/,
    /^api\/v1\/models\/status$/,
    /^api\/v1\/lora\/list$/,
    /^api\/v1\/plugins(?:\/[a-zA-Z0-9._~-]+)*$/,
    /^plugins(?:\/[a-zA-Z0-9._~-]+)*$/,
    /^api\/v1\/webrtc\/ice-servers$/,
  ],
  HEAD: [/^health$/],
  POST: [
    /^api\/v1\/pipeline\/load$/,
    /^api\/v1\/webrtc\/offer$/,
  ],
  PATCH: [/^api\/v1\/webrtc\/offer\/[a-zA-Z0-9._~-]+$/],
};

const SAFE_METHODS = new Set(["GET", "HEAD"]);
const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_READS = 240;
const RATE_LIMIT_MAX_WRITES = 90;
const RATE_LIMIT_MAX_KEYS = 2000;
const rateLimitStore = new Map<string, { windowStart: number; count: number }>();
let lastRateLimitSweep = 0;

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
  }
}

class InvalidJsonBodyError extends Error {
  constructor() {
    super("Invalid JSON in request body");
  }
}

function normalizePathSegments(path: string[]): string[] | null {
  const normalized: string[] = [];

  for (const segment of path) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }

    const trimmed = decoded.replace(/^\/+|\/+$/g, "");
    if (!trimmed || trimmed === "." || trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) {
      return null;
    }
    normalized.push(trimmed);
  }

  return normalized;
}

function isPathAllowed(method: string, path: string): boolean {
  const rules = PATH_ALLOWLIST[method];
  if (!rules || rules.length === 0) {
    return false;
  }
  return rules.some((rule) => rule.test(path));
}

function isPrivateHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }
  if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)) return true;
  return false;
}

function isUpstreamConfigSafe(): boolean {
  let parsed: URL;
  try {
    parsed = new URL(SCOPE_API_URL);
  } catch {
    return false;
  }

  if (!IS_PRODUCTION) {
    return true;
  }

  // In production, enforce server-only configuration to avoid relying on public client env fallbacks.
  if (!SERVER_SCOPE_API_URL) {
    return false;
  }

  if (parsed.protocol === "https:") {
    return true;
  }

  return parsed.protocol === "http:" && isPrivateHost(parsed.hostname);
}

function isTrustedWriteOrigin(request: NextRequest): boolean {
  if (!IS_PRODUCTION) {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function safeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function isWriteAuthorized(request: NextRequest): boolean {
  if (!IS_PRODUCTION) {
    return true;
  }
  if (!WRITE_AUTH_TOKEN) {
    return !REQUIRE_WRITE_TOKEN_IN_PROD;
  }

  const providedToken = request.headers.get(WRITE_AUTH_HEADER);
  if (!providedToken) {
    return false;
  }
  return safeStringEqual(providedToken.trim(), WRITE_AUTH_TOKEN);
}

function getClientIp(request: NextRequest): string {
  const requestWithIp = request as NextRequest & { ip?: string };
  if (requestWithIp.ip && requestWithIp.ip.trim()) {
    return requestWithIp.ip.trim();
  }

  if (TRUST_FORWARDED_IP) {
    const headerNames = FORWARDED_IP_HEADER
      ? [FORWARDED_IP_HEADER]
      : ["x-forwarded-for", "x-real-ip"];
    for (const headerName of headerNames) {
      const forwarded = request.headers.get(headerName);
      if (forwarded) {
        const candidate = forwarded.split(",")[0]?.trim();
        if (candidate) {
          return candidate;
        }
      }
    }
  }

  return "unknown";
}

function pruneRateLimitStore(now: number): void {
  if (
    now - lastRateLimitSweep < RATE_LIMIT_WINDOW_MS / 2 &&
    rateLimitStore.size < RATE_LIMIT_MAX_KEYS
  ) {
    return;
  }

  lastRateLimitSweep = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }

  if (rateLimitStore.size <= RATE_LIMIT_MAX_KEYS) {
    return;
  }

  const excess = rateLimitStore.size - RATE_LIMIT_MAX_KEYS;
  const oldestFirst = Array.from(rateLimitStore.entries())
    .sort((a, b) => a[1].windowStart - b[1].windowStart);
  for (let i = 0; i < excess; i += 1) {
    const entry = oldestFirst[i];
    if (entry) {
      rateLimitStore.delete(entry[0]);
    }
  }
}

function isRateLimited(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  const limit = SAFE_METHODS.has(method) ? RATE_LIMIT_MAX_READS : RATE_LIMIT_MAX_WRITES;
  const now = Date.now();
  pruneRateLimitStore(now);

  const key = `${getClientIp(request)}:${method}`;
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return false;
  }

  if (entry.count >= limit) {
    return true;
  }

  entry.count += 1;
  rateLimitStore.set(key, entry);
  return false;
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

function parseContentLength(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function assertBodyWithinLimit(byteLength: number): void {
  if (byteLength > MAX_REQUEST_BODY_BYTES) {
    throw new RequestBodyTooLargeError();
  }
}

async function readRequestBody(request: NextRequest): Promise<BodyInit | undefined> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const declaredContentLength = parseContentLength(request.headers.get("content-length"));
  if (declaredContentLength !== null) {
    assertBodyWithinLimit(declaredContentLength);
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const rawBody = await request.text();
    assertBodyWithinLimit(new TextEncoder().encode(rawBody).byteLength);

    if (!rawBody.trim()) {
      return undefined;
    }

    try {
      return JSON.stringify(JSON.parse(rawBody));
    } catch {
      throw new InvalidJsonBodyError();
    }
  }

  const binaryBody = await request.arrayBuffer();
  assertBodyWithinLimit(binaryBody.byteLength);
  return binaryBody.byteLength > 0 ? binaryBody : undefined;
}

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const method = request.method.toUpperCase();
  const { path } = await params;
  const normalizedSegments = normalizePathSegments(path);

  if (!normalizedSegments) {
    console.warn("[Scope Proxy] Blocked malformed path segments");
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  if (!PATH_ALLOWLIST[method]) {
    return NextResponse.json(
      { error: `Method ${method} not allowed` },
      { status: 405 }
    );
  }

  const targetPath = normalizedSegments.join("/");

  // Security: Validate path against allowlist before proxying
  if (!isPathAllowed(method, targetPath)) {
    console.warn(`[Scope Proxy] Blocked request to non-allowed path: ${targetPath}`);
    return NextResponse.json(
      { error: "Path not allowed" },
      { status: 403 }
    );
  }

  if (!isUpstreamConfigSafe()) {
    return NextResponse.json(
      { error: "Invalid or insecure Scope proxy upstream configuration for current environment" },
      { status: 500 }
    );
  }

  const targetUrl = `${SCOPE_API_URL}/${targetPath}${request.nextUrl.search}`;

  if (!PROXY_ENABLED) {
    return NextResponse.json(
      { error: "Scope proxy disabled in production. Set SCOPE_PROXY_ENABLE=true or use platform-level auth." },
      { status: 403 }
    );
  }

  if (WRITE_METHODS.has(method) && !isTrustedWriteOrigin(request)) {
    return NextResponse.json(
      { error: "Write operations require a same-origin Origin header" },
      { status: 403 }
    );
  }

  if (WRITE_METHODS.has(method) && IS_PRODUCTION && REQUIRE_WRITE_TOKEN_IN_PROD && !WRITE_AUTH_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Scope proxy write operations require SCOPE_PROXY_WRITE_TOKEN in production. Configure the server token or explicitly set SCOPE_PROXY_REQUIRE_WRITE_TOKEN=false.",
      },
      { status: 503 }
    );
  }

  if (WRITE_METHODS.has(method) && !isWriteAuthorized(request)) {
    return NextResponse.json(
      {
        error:
          "Write operation unauthorized for Scope proxy. Configure SCOPE_PROXY_WRITE_TOKEN and send it via the configured header.",
      },
      { status: 401 }
    );
  }

  if (isRateLimited(request)) {
    return NextResponse.json(
      { error: "Rate limit exceeded for Scope proxy" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
      }
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
  try {
    body = await readRequestBody(request);
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        {
          error: `Request body exceeds proxy limit of ${MAX_REQUEST_BODY_BYTES} bytes`,
        },
        { status: 413 }
      );
    }
    throw error;
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

export async function HEAD(
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
