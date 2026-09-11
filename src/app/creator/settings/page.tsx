import {
  CommunitySettingsWorkspace,
  type CommunitySettingsSection,
} from "@/components/creator/settings/CommunitySettingsWorkspace";
import { loadCommunityIdentity } from "@/lib/community-settings/server";
import { loadCommunityStructure } from "@/lib/community-settings/structure";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

/** Validated server-side: `?section=` comes from the URL bar as readily as from the rail. */
const VALID_SECTIONS = new Set<CommunitySettingsSection>(["identity", "channels", "composer"]);

export default async function CreatorSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { supabase } = await requireInfluencerWorkspace("/creator/settings");
  const [params, structure, identity] = await Promise.all([
    searchParams,
    loadCommunityStructure(supabase),
    loadCommunityIdentity(supabase),
  ]);

  const requested = params.section as CommunitySettingsSection | undefined;
  const initialSection = requested && VALID_SECTIONS.has(requested) ? requested : "identity";

  return (
    <CommunitySettingsWorkspace
      initialSection={initialSection}
      categories={structure.categories}
      channels={structure.channels}
      identity={identity.identity}
      composer={identity.composer}
      logoUrl={identity.logoUrl}
      degraded={identity.degraded}
    />
  );
}
