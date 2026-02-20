# Operations & Deployment - MetaDJ Soundscape

**Last Modified**: 2026-02-20 15:09 ET  
**Status**: Active

## Purpose

This runbook is the operational source of truth for deploying, validating, monitoring, and recovering MetaDJ Soundscape.

## System Baseline

- Frontend: Next.js app on port `3500`
- Scope backend: RunPod-hosted Daydream Scope instance
- Proxy: Next.js route `/api/scope/[...path]` with method/path allowlist, origin checks, and write-token policy
- Transport: WebRTC video + data channel

## Environment Contract

| Variable | Required | Notes |
|----------|----------|-------|
| `SCOPE_API_URL` | Yes | Server-side Scope base URL. Required for production proxy safety checks. |
| `NEXT_PUBLIC_SCOPE_API_URL` | Optional | Dev fallback only. Do not rely on this in production. |
| `SCOPE_PROXY_ENABLE` | Yes (prod) | Must be `true` to use proxy in production. |
| `SCOPE_PROXY_REQUIRE_WRITE_TOKEN` | Recommended `true` | Keep `true` for production unless deployment is fully private. |
| `SCOPE_PROXY_WRITE_TOKEN` | Yes when write token required | Missing token causes production writes to fail fast. |
| `SCOPE_PROXY_WRITE_TOKEN_HEADER` | Recommended | Default: `x-scope-proxy-token`. |
| `SCOPE_PROXY_MAX_BODY_BYTES` | Optional | Proxy request-body guardrail. Default `524288`. |
| `SCOPE_PROXY_TRUST_FORWARDED_IP` | Optional | Keep `false` unless platform sanitizes forwarding headers. |
| `SCOPE_PROXY_IP_HEADER` | Optional | Set only if forwarded IP trust is enabled. |
| `HF_TOKEN` | Yes (RunPod) | Required for Cloudflare TURN relay and gated model downloads on RunPod Scope instances. |

## Deployment Workflow

### 1. Pre-Deploy Checklist

1. Confirm current branch is release-ready and CI is green in `.github/workflows/ci.yml`.
2. Run local gates:
   - `npm run lint`
   - `npm run type-check`
   - `npm run test`
   - `npm run build`
   - `npm run check:launch`
3. Verify Scope health endpoint from operator machine:
   - `npm run check:scope`

### 2. Deploy/Verify Scope (RunPod)

1. Launch Scope using the official template:  
   `https://console.runpod.io/deploy?template=aca8mw9ivw&ref=5k8hxjq3`
2. Set pod env vars including `HF_TOKEN`.
3. Confirm Scope responds:
   - `GET /health`
   - `GET /api/v1/pipeline/status`
   - `GET /api/v1/pipelines/schemas`

### 3. Configure Soundscape Runtime

1. Set production app secrets:
   - `SCOPE_API_URL`
   - `SCOPE_PROXY_ENABLE=true`
   - `SCOPE_PROXY_REQUIRE_WRITE_TOKEN=true`
   - `SCOPE_PROXY_WRITE_TOKEN`
   - `SCOPE_PROXY_WRITE_TOKEN_HEADER` (if customized)
2. Deploy the frontend.
3. Verify `/soundscape` renders and Scope diagnostics reports Online.

### 4. Post-Deploy Smoke Test

1. Open `/soundscape`.
2. Click **Refresh** in Scope readiness.
3. Connect Scope successfully.
4. Confirm live video renders.
5. Start demo audio or microphone mode.
6. Confirm visuals react to audio changes.
7. Toggle a generation profile control and verify stream remains stable.
8. Record and download a short clip.

## Security Audit Policy

- Required gate: `npm audit --production` must report zero high/critical issues.
- Advisory visibility: run full `npm audit` for developer-tooling visibility and track unresolved upstream advisories separately.
- Current known limitation: ESLint toolchain transitive advisories may remain until compatible upstream releases land; do not treat these as production-runtime CVEs for this app.

## Monitoring & Health Checks

### Operator Signals

- Scope health: `/health`
- Pipeline readiness: `/api/v1/pipeline/status`
- App-level diagnostics panel: connection status, pipeline, FPS, dropped frames
- Proxy errors: Next.js server logs for `/api/scope` responses (`401`, `403`, `429`, `503`)

### Suggested Alert Thresholds

- Scope health not `ok` for 2 consecutive checks (1 minute window)
- Proxy write failures (`401/503`) > 5/minute for 5 minutes
- Sustained dropped frame ratio > `12%` for 5 minutes during active sessions
- Reconnect loops repeatedly hitting max reconnect attempts

## Incident Runbook

### Incident A: Scope Offline / Health Check Fails

1. Confirm `SCOPE_API_URL` is correct.
2. Validate RunPod instance is running.
3. Check Scope pod logs.
4. Restart Scope pod if unhealthy.
5. Re-run `npm run check:scope`.

### Incident B: Connect Fails with Proxy Write Errors

1. Check app secrets:
   - `SCOPE_PROXY_ENABLE=true`
   - `SCOPE_PROXY_REQUIRE_WRITE_TOKEN=true`
   - `SCOPE_PROXY_WRITE_TOKEN` present
2. Confirm client is sending header defined by `SCOPE_PROXY_WRITE_TOKEN_HEADER`.
3. Verify request origin is same-origin in production.
4. Re-test connection and inspect `/api/scope` response codes.

### Incident C: Connected but No Video Frames

1. Confirm pipeline is loaded (`/api/v1/pipeline/status`).
2. Reconnect from UI.
3. Validate Scope GPU memory availability.
4. Check WebRTC negotiation logs and track events.

### Incident D: Severe Performance Degradation

1. Check dropped frames/FPS in telemetry.
2. Reduce load:
   - switch to lighter denoising profile
   - disable auxiliary input stream features if not required
3. Recycle Scope instance if GPU state appears degraded.

## Rollback Plan

### Frontend Rollback

1. Revert frontend deployment to last known-good release.
2. Re-validate `/soundscape` load and diagnostics.

### Configuration Rollback

1. Restore previous production env values from secret history.
2. Redeploy frontend with restored env.
3. Re-run smoke test.

### Scope Rollback

1. Revert to prior stable Scope pod/template configuration.
2. Reattach known-good `SCOPE_API_URL`.
3. Validate health/pipeline endpoints, then run full smoke test.

## Escalation Path

1. First responder: run this playbook + collect logs.
2. If unresolved in 15 minutes: escalate to project owner.
3. If unresolved in 30 minutes: rollback to last known-good frontend + Scope config.

## Local Development Note

> [!IMPORTANT]
> Soundscape runs on port `3500`. Use `http://localhost:3500` for local operation.
