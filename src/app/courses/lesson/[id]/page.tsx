import { LessonScreen } from "@/components/screens/AskStoicScreens";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function LessonPage() {
  await requireActiveMembership("/courses");

  return <LessonScreen />;
}
