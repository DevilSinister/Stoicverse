import { AdminScreen } from "@/components/screens/AskStoicScreens";
import { requirePlatformRole } from "@/lib/supabase/access";

export default async function AdminPage() {
  await requirePlatformRole("super_admin");

  return <AdminScreen />;
}
