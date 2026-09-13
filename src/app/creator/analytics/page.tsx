import { CreatorAnalyticsView } from "@/components/creator/CreatorAnalyticsView";
import { defaultFilters, parseFilters } from "@/lib/analytics/model";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";
import { profileRow } from "@/lib/supabase/viewer";

export default async function CreatorAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireInfluencerWorkspace("/creator/analytics");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") params.set(key, value);
  let initialFilters;
  try { initialFilters = parseFilters(params); } catch { initialFilters = defaultFilters(); }
  const { data } = await profileRow();
  return <CreatorAnalyticsView memberName={data?.full_name?.trim() || "Creator"} initialFilters={initialFilters} initialTab={params.get("tab") ?? "overview"} />;
}
