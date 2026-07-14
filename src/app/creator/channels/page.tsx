import { redirect } from "next/navigation";

import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorChannelsPage() {
  await requireInfluencerWorkspace("/creator/channels");
  redirect("/creator/community");
}
