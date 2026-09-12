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
  "/channels",
  "/creator/settings",
  "/creator/channels",
  "/creator",
  "/dashboard",
] as const;

export function revalidateCommunity() {
  for (const path of COMMUNITY_PATHS) revalidatePath(path);
  // The dynamic segment needs its own call with the `type` argument: a bare
  // revalidatePath("/channels/[channelId]") is a no-op in Next 16 and the
  // failure is silent — every channel keeps serving the page it had.
  revalidatePath("/channels/[channelId]", "page");
}
