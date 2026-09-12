"use client";

import { StructureEditor } from "@/components/community/structure/StructureEditor";
import { AuditLogSection } from "@/components/community/settings/AuditLogSection";
import { AutomodSection } from "@/components/community/settings/AutomodSection";
import { IdentitySection } from "@/components/community/settings/IdentitySection";
import { SafetySection } from "@/components/community/settings/SafetySection";
import { BansSection, ReportsSection } from "@/components/community/settings/ModerationQueueSections";
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
  const permissions = new Set(workspace.viewer.permissions);

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
    case "automod":
      return data.automod ? (
        <AutomodSection
          rules={data.automod.rules}
          presets={data.automod.presets}
          alerts={data.automod.alerts}
          roles={data.automod.roles}
          channels={data.automod.channels}
          canSave={canSave}
          onNotice={notice}
        />
      ) : null;
    case "safety":
      return data.safety ? (
        <SafetySection
          safety={data.safety.identity.safety}
          rulesChannels={data.safety.rulesChannels}
          acceptedCount={data.safety.acceptedCount}
          canSave={canSave}
        />
      ) : null;
    case "reports":
      return data.reports ? (
        <ReportsSection
          reports={data.reports.rows}
          status={data.reports.status}
          canModerate={permissions.has("moderate_members") || workspace.viewer.isInfluencer}
          canBan={permissions.has("ban_members") || workspace.viewer.isInfluencer}
          onNotice={notice}
        />
      ) : null;
    case "bans":
      return data.bans ? (
        <BansSection
          bans={data.bans}
          canBan={permissions.has("ban_members") || workspace.viewer.isInfluencer}
          onNotice={notice}
        />
      ) : null;
    case "audit":
      return data.audit ? <AuditLogSection events={data.audit.events} degraded={data.audit.degraded} /> : null;
    default:
      return null;
  }
}
