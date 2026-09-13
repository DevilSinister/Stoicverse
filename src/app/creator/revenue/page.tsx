import { CreatorRevenueView } from "@/components/creator/CreatorRevenueView";
import { defaultRevenueFilters, parseRevenueFilters } from "@/lib/revenue/model";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";
import { profileRow } from "@/lib/supabase/viewer";

export default async function CreatorRevenuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireInfluencerWorkspace("/creator/revenue");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") params.set(key, value);
  let initialFilters;
  try { initialFilters = parseRevenueFilters(params); } catch { initialFilters = defaultRevenueFilters(); }
  const { data } = await profileRow();
  return <CreatorRevenueView memberName={data?.full_name?.trim() || "Creator"} initialFilters={initialFilters} initialTab={params.get("tab") ?? "overview"} />;
}
