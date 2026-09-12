"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * The community's name and logo, for the rail.
 *
 * The creator has been able to set both since the identity phase, and until
 * now **no member could ever see either** — the logo rendered in exactly one
 * place, the "Members see" preview card sitting beside its own upload form,
 * and both shells hardcoded their titles ("Stoicverse", "Community").
 *
 * Read through `community_branding()`, a `stable security definer` RPC that
 * has existed, granted to `anon, authenticated`, with no caller at all. Going
 * through the RPC rather than threading a prop is deliberate: `AppShell` is
 * wrapped individually by about nineteen page components, and adding a
 * required prop would mean editing every one of them to render a logo.
 *
 * A shell that already has the data server-side passes it as `initial` and no
 * request happens. Everything else fetches once per tab and caches in
 * `sessionStorage`, so only the very first navigation can show the fallback.
 * The bucket is public, so the URL is string construction rather than a
 * second round trip.
 */

export type CommunityBranding = { name: string; logoUrl: string | null };

const CACHE_KEY = "sv:community-branding";
const FALLBACK: CommunityBranding = { name: "Community", logoUrl: null };

function readCache(): CommunityBranding | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CommunityBranding>;
    return typeof parsed?.name === "string" ? { name: parsed.name, logoUrl: parsed.logoUrl ?? null } : null;
  } catch {
    // Private-mode Safari throws on storage access rather than returning null,
    // and a rail that cannot draw is a worse outcome than one that refetches.
    return null;
  }
}

function writeCache(value: CommunityBranding) {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Nothing to do and nothing worth telling anybody: the only cost is a
    // second request on the next navigation.
  }
}

export function useCommunityBranding(initial?: CommunityBranding | null): CommunityBranding {
  const [branding, setBranding] = useState<CommunityBranding>(initial ?? FALLBACK);

  useEffect(() => {
    if (initial) return;

    let cancelled = false;

    void (async () => {
      // Read inside the async body rather than in the effect body. A
      // synchronous setState there is a cascading render, and the obvious
      // alternative — a lazy `useState` initializer reading storage — is a
      // hydration mismatch, because this component also renders on the server.
      const cached = readCache();
      if (cached) {
        if (!cancelled) setBranding(cached);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.rpc("community_branding");
      if (cancelled || error) {
        if (error) console.error("[community-branding]", { code: error.code ?? null });
        return;
      }

      const row = (Array.isArray(data) ? data[0] : null) as { community_name?: string; logo_path?: string | null } | null;
      if (!row) return;

      const logoPath = row.logo_path ?? null;
      const next: CommunityBranding = {
        name: row.community_name?.trim() || FALLBACK.name,
        // Public bucket: this builds a string, it does not make a request.
        logoUrl: logoPath ? supabase.storage.from("community-branding").getPublicUrl(logoPath).data.publicUrl : null,
      };

      writeCache(next);
      if (!cancelled) setBranding(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [initial]);

  return branding;
}
