import { revalidatePath } from "next/cache";

/**
 * Every surface that renders community structure or settings.
 *
 * This lives in one place because two action modules mutate the same data:
 * `src/app/creator/channels/actions.ts` and `src/app/creator/settings/actions.ts`.
 * Duplicated, the two lists drift and one surface silently serves stale
 * structure after the other edits it.
 */
const COMMUNITY_PATHS = [
  "/creator/settings",
  "/creator/channels",
  "/creator/community",
  "/dashboard/community",
  "/creator",
  "/dashboard",
] as const;

export function revalidateCommunity() {
  for (const path of COMMUNITY_PATHS) revalidatePath(path);
}
