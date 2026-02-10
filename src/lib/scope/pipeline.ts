import type { ScopeClient } from "./client";
import type { PipelineLoadParams } from "./types";

interface PrepareScopePipelineOptions {
  scopeClient: ScopeClient;
  pipelineId: string;
  loadParams: PipelineLoadParams;
  onStatus?: (message: string) => void;
}

export async function prepareScopePipeline({
  scopeClient,
  pipelineId,
  loadParams,
  onStatus,
}: PrepareScopePipelineOptions): Promise<void> {
  onStatus?.(`Loading ${pipelineId} pipeline...`);
  const loaded = await scopeClient.loadPipeline(pipelineId, loadParams);
  if (!loaded) {
    throw new Error(`Failed to load ${pipelineId} pipeline`);
  }

  onStatus?.("Waiting for pipeline...");
  const ready = await scopeClient.waitForPipelineLoaded();
  if (!ready) {
    throw new Error(`Pipeline failed to load: ${pipelineId}`);
  }
}
