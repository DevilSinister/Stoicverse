import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorWorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireInfluencerWorkspace("/creator");
  return children;
}
