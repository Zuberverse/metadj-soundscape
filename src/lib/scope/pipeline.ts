import type { ScopeClient } from "./client";
import type { PipelineLoadParams } from "./types";

interface PrepareScopePipelineOptions {
  scopeClient: ScopeClient;
  pipelineId?: string;
  pipelineIds?: string[];
  loadParams: PipelineLoadParams;
  onStatus?: (message: string) => void;
}

export async function prepareScopePipeline({
  scopeClient,
  pipelineId,
  pipelineIds,
  loadParams,
  onStatus,
}: PrepareScopePipelineOptions): Promise<void> {
  const resolvedPipelineIds = [
    ...(pipelineIds ?? []),
    ...(pipelineId ? [pipelineId] : []),
  ]
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (resolvedPipelineIds.length === 0) {
    throw new Error("No pipeline selected");
  }

  const pipelineLabel = resolvedPipelineIds.join(" → ");

  onStatus?.(`Loading ${pipelineLabel}...`);
  const loaded = await scopeClient.loadPipeline(resolvedPipelineIds, loadParams);
  if (!loaded) {
    throw new Error(`Failed to load ${pipelineLabel}`);
  }

  onStatus?.("Waiting for pipeline...");
  const ready = await scopeClient.waitForPipelineLoaded();
  if (!ready) {
    throw new Error(`Pipeline failed to load: ${pipelineLabel}`);
  }
}
