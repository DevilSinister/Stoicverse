"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { settingsHref, type SettingsSectionId } from "@/lib/community-settings/sections";

const OPENED_FROM_KEY = "settings:openedFrom";

export type SettingsTarget = { channelId?: string; roleId?: string; memberId?: string; tab?: string };

/**
 * The one client API the community page uses to reach settings. `base` is the
 * settings page path (e.g. "/channels/settings"); when that path is also
 * intercepted by an overlay route, `openSettings` opens the overlay and
 * `closeSettings` returns to where it was opened from.
 */
export function useOpenSettings(base: string, fallback: string) {
  const router = useRouter();

  const hrefFor = useCallback(
    (section: SettingsSectionId, target?: SettingsTarget) => settingsHref(base, section, target),
    [base],
  );

  const openSettings = useCallback(
    (section: SettingsSectionId, target?: SettingsTarget) => {
      try {
        window.sessionStorage.setItem(OPENED_FROM_KEY, `${window.location.pathname}${window.location.search}`);
      } catch {
        // Storage can be unavailable; closing then falls back to `fallback`.
      }
      router.push(hrefFor(section, target));
    },
    [hrefFor, router],
  );

  const closeSettings = useCallback(() => {
    let openedFrom: string | null = null;
    try {
      openedFrom = window.sessionStorage.getItem(OPENED_FROM_KEY);
      window.sessionStorage.removeItem(OPENED_FROM_KEY);
    } catch {
      openedFrom = null;
    }
    if (openedFrom) {
      router.back();
      return;
    }
    router.push(fallback);
  }, [fallback, router]);

  return useMemo(
    () => ({ openSettings, closeSettings, settingsHref: hrefFor }),
    [closeSettings, hrefFor, openSettings],
  );
}
