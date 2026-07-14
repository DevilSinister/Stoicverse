import { requireActiveMembership } from "@/lib/supabase/access";

export default async function MemberWorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership("/dashboard");
  return children;
}
