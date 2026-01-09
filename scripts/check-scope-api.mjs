const baseUrl = (process.env.SCOPE_API_URL || process.env.NEXT_PUBLIC_SCOPE_API_URL || "http://localhost:8000")
  .replace(/\/$/, "");

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
