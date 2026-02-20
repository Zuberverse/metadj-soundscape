import { existsSync, readFileSync } from "node:fs";

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const result = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

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

function getEnv(name) {
  return String(mergedEnv[name] ?? "").trim();
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const errors = [];
const warnings = [];

const scopeApiUrl = getEnv("SCOPE_API_URL");
const proxyEnabled = getEnv("SCOPE_PROXY_ENABLE") === "true";
const requireWriteToken = getEnv("SCOPE_PROXY_REQUIRE_WRITE_TOKEN") !== "false";
const writeToken = getEnv("SCOPE_PROXY_WRITE_TOKEN");
const writeTokenHeader = getEnv("SCOPE_PROXY_WRITE_TOKEN_HEADER") || "x-scope-proxy-token";
const trustForwardedIp = getEnv("SCOPE_PROXY_TRUST_FORWARDED_IP") === "true";
const forwardedHeader = getEnv("SCOPE_PROXY_IP_HEADER");
const hfToken = getEnv("HF_TOKEN");

if (!scopeApiUrl) {
  errors.push("SCOPE_API_URL is required for production-safe proxying.");
} else if (!isValidHttpUrl(scopeApiUrl)) {
  errors.push("SCOPE_API_URL must be a valid http(s) URL.");
}

if (!proxyEnabled) {
  errors.push(
    "SCOPE_PROXY_ENABLE is not true. In production, /api/scope writes will be blocked."
  );
}

if (proxyEnabled && requireWriteToken && !writeToken) {
  errors.push(
    "SCOPE_PROXY_WRITE_TOKEN is required when proxy writes are enabled with token enforcement."
  );
}

if (!/^[a-z0-9-]+$/i.test(writeTokenHeader)) {
  errors.push("SCOPE_PROXY_WRITE_TOKEN_HEADER must be a valid HTTP header token.");
}

if (trustForwardedIp && !forwardedHeader) {
  warnings.push(
    "SCOPE_PROXY_TRUST_FORWARDED_IP=true but SCOPE_PROXY_IP_HEADER is empty; default forwarding headers will be used."
  );
}

if (scopeApiUrl.includes("runpod") && !hfToken) {
  errors.push(
    "HF_TOKEN is not set. RunPod Scope deployments typically require it for TURN relay and gated downloads."
  );
}

console.log("Launch preflight configuration report:");
console.log(`- SCOPE_API_URL: ${scopeApiUrl || "(missing)"}`);
console.log(`- SCOPE_PROXY_ENABLE: ${proxyEnabled}`);
console.log(`- SCOPE_PROXY_REQUIRE_WRITE_TOKEN: ${requireWriteToken}`);
console.log(`- SCOPE_PROXY_WRITE_TOKEN_HEADER: ${writeTokenHeader}`);

if (warnings.length > 0) {
  console.log("");
  console.log("Warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

if (errors.length > 0) {
  console.error("");
  console.error("Errors:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("");
  console.log("Preflight checks passed.");
}
