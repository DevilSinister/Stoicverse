"use client";

import { StructureEditor } from "@/components/community/structure/StructureEditor";
import { AuditLogSection } from "@/components/community/settings/AuditLogSection";
import { IdentitySection } from "@/components/community/settings/IdentitySection";
import { ModerationSection } from "@/components/community/settings/ModerationSection";
import { RolesSection } from "@/components/community/settings/RolesSection";
import { useSettingsNotice } from "@/components/community/settings/SettingsNoticeProvider";
import type { SettingsWorkspace } from "@/lib/community-settings/workspace";

/**
 * The one switch from a section id to its component. Every settings shell
 * renders exactly this, so the page and the overlay cannot drift apart.
 * A section whose data did not load renders nothing rather than a control
 * with no policy behind it.
 */
export function SettingsSectionBody({ workspace }: { workspace: SettingsWorkspace }) {
  const notice = useSettingsNotice();
  const { query, data, degraded } = workspace;
  const canSave = degraded.length === 0;

  switch (query.section) {
    case "overview":
      return data.identity ? (
        <IdentitySection identity={data.identity.identity} logoUrl={data.identity.logoUrl} canSave={canSave} />
      ) : null;
    case "channels":
      return data.structure ? (
        <div className="overflow-hidden rounded-xl border border-surgical-steel bg-surface-container-low">
          <StructureEditor
            variant="inline"
            categories={data.structure.categories}
            channels={data.structure.channels}
            roles={data.structure.roles}
            overrides={data.structure.overrides}
            onNotice={notice}
          />
        </div>
      ) : null;
    case "roles":
      return data.roles ? <RolesSection data={data.roles} viewer={workspace.viewer} canSave={canSave} /> : null;
    case "safety":
      return data.identity && data.blockedPhrases ? (
        <ModerationSection moderation={data.identity.moderation} phrases={data.blockedPhrases} canSave={canSave} />
      ) : null;
    case "audit":
      return data.audit ? <AuditLogSection events={data.audit.events} degraded={data.audit.degraded} /> : null;
    default:
      return null;
  }
}
