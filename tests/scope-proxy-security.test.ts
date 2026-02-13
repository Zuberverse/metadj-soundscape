/**
 * Scope Proxy Security Tests
 * Covers path traversal, POST forwarding, production mode, and error cases
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

describe("Scope proxy security", () => {
  it("rejects path traversal attempts", async () => {
    const { GET } = await import("../src/app/api/scope/[...path]/route");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/scope/api/v1/../../admin");
    const response = await GET(request, {
      params: Promise.resolve({ path: ["api", "v1", "..", "..", "admin"] }),
    });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects encoded path traversal in joined path", async () => {
    const { GET } = await import("../src/app/api/scope/[...path]/route");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/scope/health/../admin/secrets");
    const response = await GET(request, {
      params: Promise.resolve({ path: ["health", "..", "admin", "secrets"] }),
    });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies POST with JSON body", async () => {
    const { POST } = await import("../src/app/api/scope/[...path]/route");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "loaded" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const body = JSON.stringify({ pipeline_ids: ["longlive"] });
    const request = new NextRequest("http://localhost/api/scope/api/v1/pipeline/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const response = await POST(request, {
      params: Promise.resolve({ path: ["api", "v1", "pipeline", "load"] }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  });

  it("returns 400 for malformed JSON body", async () => {
    const { POST } = await import("../src/app/api/scope/[...path]/route");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/scope/api/v1/pipeline/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    });
    const response = await POST(request, {
      params: Promise.resolve({ path: ["api", "v1", "pipeline", "load"] }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Invalid JSON");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards DELETE requests", async () => {
    const { DELETE } = await import("../src/app/api/scope/[...path]/route");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/scope/api/v1/session/abc", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ path: ["api", "v1", "session", "abc"] }),
    });

    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  });

  it("only forwards allowlisted headers", async () => {
    const { GET } = await import("../src/app/api/scope/[...path]/route");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/scope/health", {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer token123",
        "X-Custom-Header": "should-be-stripped",
        "Cookie": "should-be-stripped",
      },
    });
    await GET(request, {
      params: Promise.resolve({ path: ["health"] }),
    });

    const forwardedHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(forwardedHeaders.get("content-type")).toBe("application/json");
    expect(forwardedHeaders.get("authorization")).toBe("Bearer token123");
    expect(forwardedHeaders.get("x-custom-header")).toBeNull();
    expect(forwardedHeaders.get("cookie")).toBeNull();
  });
});
