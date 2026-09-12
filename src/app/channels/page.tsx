import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireCommunityAccess } from "@/lib/supabase/access";

export const dynamic = "force-dynamic";

/**
 * `/channels` picks a channel rather than showing an empty frame.
 *
 * Order: the channel the member was last in, then the first one they can
 * actually open. A locked channel is never chosen — landing on a teaser as
 * your first impression of the community reads as a paywall, not a home.
 */
export default async function ChannelsIndexPage() {
  const { supabase } = await requireCommunityAccess("/channels");

  const { data, error } = await supabase.rpc("community_channel_directory");
  if (error) {
    console.error("[channels]", { code: error.code ?? null });
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).filter((row) => !row.is_locked);
  if (rows.length === 0) return <NoChannels />;

  const store = await cookies();
  const remembered = store.get("sv-last-channel")?.value;
  const target = rows.find((row) => row.channel_id === remembered) ?? rows[0];

  redirect(`/channels/${target.channel_id as string}`);
}

function NoChannels() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <h1 className="text-base font-semibold text-on-surface">Nothing here yet</h1>
        <p className="mt-2 text-sm text-fog-muted">
          There are no channels you can open. If you have just joined, the creator may still be setting the community
          up.
        </p>
      </div>
    </div>
  );
}
