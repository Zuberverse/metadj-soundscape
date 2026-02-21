import { existsSync, readFileSync } from "node:fs";

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const result = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    result[key] = value;
  }

  return result;
}

const mergedEnv = {
  ...parseEnvFile(".env"),
  ...parseEnvFile(".env.local"),
  ...process.env,
};

const baseUrl = (
  mergedEnv.SCOPE_API_URL ||
  mergedEnv.NEXT_PUBLIC_SCOPE_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");

async function fetchJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function run() {
  console.log(`Scope API check: ${baseUrl}`);

  try {
    const health = await fetchJson("/health");
    console.log("Health:", health);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Health check failed:", message);
    process.exitCode = 1;
    return;
  }

  try {
    const status = await fetchJson("/api/v1/pipeline/status");
    console.log("Pipeline status:", status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Pipeline status unavailable:", message);
  }

  try {
    const schemas = await fetchJson("/api/v1/pipelines/schemas");
    const keys = schemas?.schemas ? Object.keys(schemas.schemas) : Object.keys(schemas || {});
    console.log("Pipelines:", keys.length ? keys.join(", ") : "None detected");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Pipeline schema lookup failed:", message);
  }

  try {
    const ice = await fetchJson("/api/v1/webrtc/ice-servers");
    console.log("ICE servers:", ice);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("ICE server lookup failed:", message);
  }
}

run();
