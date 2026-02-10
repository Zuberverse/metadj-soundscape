import { afterEach, describe, expect, it, vi } from "vitest";
import { ScopeClient } from "@/lib/scope/client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("ScopeClient", () => {
  it("falls back to legacy pipeline_id when pipeline_ids request is rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 422 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const client = new ScopeClient("/api/scope");
    const ok = await client.loadPipeline("longlive", { width: 576, height: 320 });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstRequest = fetchMock.mock.calls[0][1] as RequestInit;
    const firstBody = JSON.parse(firstRequest.body as string);
    expect(firstBody.pipeline_ids).toEqual(["longlive"]);
    expect(firstBody.load_params).toMatchObject({ width: 576, height: 320 });

    const secondRequest = fetchMock.mock.calls[1][1] as RequestInit;
    const secondBody = JSON.parse(secondRequest.body as string);
    expect(secondBody.pipeline_id).toBe("longlive");
    expect(secondBody.load_params).toMatchObject({ width: 576, height: 320 });
  });

  it("parses pipeline schema maps into pipeline IDs", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          schemas: {
            longlive: {},
            streamdiffusionv2: {},
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new ScopeClient("/api/scope");
    const pipelines = await client.getPipelines();

    expect(pipelines).toEqual(["longlive", "streamdiffusionv2"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
