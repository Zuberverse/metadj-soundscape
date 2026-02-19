import type { NextConfig } from "next";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function toConnectSources(rawUrl?: string): string[] {
  if (!rawUrl) return [];

  try {
    const url = new URL(rawUrl);
    const sources = new Set<string>([url.origin]);

    if (url.protocol === "https:") {
      sources.add(`wss://${url.host}`);
    } else if (url.protocol === "http:") {
      sources.add(`ws://${url.host}`);
    }

    return Array.from(sources);
  } catch {
    return [];
  }
}

const connectSources = new Set<string>(["'self'"]);
for (const source of toConnectSources(process.env.SCOPE_API_URL)) {
  connectSources.add(source);
}
for (const source of toConnectSources(process.env.NEXT_PUBLIC_SCOPE_API_URL)) {
  connectSources.add(source);
}
if (!IS_PRODUCTION) {
  connectSources.add("https:");
  connectSources.add("http:");
  connectSources.add("ws:");
  connectSources.add("wss:");
}

const scriptSources = ["'self'", "'unsafe-inline'"];
if (!IS_PRODUCTION) {
  scriptSources.push("'unsafe-eval'");
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSources.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src ${Array.from(connectSources).join(" ")}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Permissions-Policy",
            value: "microphone=(self), camera=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
