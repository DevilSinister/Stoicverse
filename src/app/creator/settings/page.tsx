import {
  CommunitySettingsWorkspace,
  type CommunitySettingsSection,
} from "@/components/creator/settings/CommunitySettingsWorkspace";
import { loadAuditPage, loadBlockedWords, loadCommunityRoles } from "@/lib/community-settings/governance";
import { loadCommunityIdentity } from "@/lib/community-settings/server";
import { loadCommunityStructure } from "@/lib/community-settings/structure";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

/** Validated server-side: `?section=` comes from the URL bar as readily as from the rail. */
const VALID_SECTIONS = new Set<CommunitySettingsSection>([
  "identity",
  "channels",
  "roles",
  "composer",
  "moderation",
  "audit",
]);

export default async function CreatorSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { supabase } = await requireInfluencerWorkspace("/creator/settings");
  const [params, structure, identity, roles, blocked, audit] = await Promise.all([
    searchParams,
    loadCommunityStructure(supabase),
    loadCommunityIdentity(supabase),
    loadCommunityRoles(supabase),
    loadBlockedWords(supabase),
    loadAuditPage(supabase),
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
      moderation={identity.moderation}
      roles={roles.roles}
      blockedPhrases={blocked.phrases}
      auditEvents={audit.events}
      auditDegraded={audit.degraded}
      logoUrl={identity.logoUrl}
      // Each loader degrades independently; the banner names every read that
      // failed, and every write it gates stays disabled.
      degraded={[...identity.degraded, ...roles.degraded, ...blocked.degraded]}
    />
  );
}
