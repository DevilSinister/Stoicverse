import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Realtime is a WebSocket, and CSP matches on scheme: an origin allowed as
// `https://` does not permit `wss://` to the same host. Without this, every
// subscription in the app fails as a blocked connection — the channel renders,
// and then simply never updates.
const supabaseSocketOrigin = supabaseOrigin?.replace(/^https:/, "wss:");
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  // Audio and video are served from Supabase Storage over signed URLs, and
  // `default-src` would otherwise be the rule that applies to them — a voice
  // note would fail to play with nothing said anywhere but the console.
  // `blob:` is the recorder's own preview, before anything is uploaded.
  `media-src 'self' blob: data:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${supabaseSocketOrigin ? ` ${supabaseSocketOrigin}` : ""}`,
  "frame-src https://drive.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // `next build` and `next dev` both own `.next`, and a build run while the dev
  // server is up leaves production manifests (BUILD_ID, routes-manifest,
  // prerender-manifest) beside the dev output. The dev server then resolves
  // routes against them and answers 404 for pages that exist — and a client
  // that calls .json() on that HTML 404 reports a JSON parse error, which
  // points nowhere near the cause. Build with NEXT_BUILD_DIR set to keep the
  // two apart. Unset, this is exactly the default.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    root: "D:\\Projects\\StoicWealthSociety",
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        // `microphone=(self)`, not `microphone=()`. An empty allow-list disables
        // the microphone for the whole origin, so `getUserMedia({ audio: true })`
        // rejects before any permission prompt is ever shown — which reads as a
        // broken recorder rather than as a policy. Camera and location stay off:
        // nothing in the product asks for either.
        { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ],
    }];
  },
};

export default nextConfig;
