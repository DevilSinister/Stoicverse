import { SettingsPageShell } from "@/components/community/settings/SettingsPageShell";
import { loadSettingsWorkspace } from "@/lib/community-settings/workspace";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/settings");
  // The loader validates `?section=` against what this viewer may see and
  // loads only that section's data; a viewer with nothing to see is sent home.
  const workspace = await loadSettingsWorkspace(supabase, user.id, await searchParams, { onForbidden: "/creator" });

  return (
    <SettingsPageShell workspace={workspace} base="/creator/settings" routeBase="/creator" platformRole="influencer" />
  );
}
