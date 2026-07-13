import { LessonPlayer } from "@/components/courses/LessonPlayer";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireInfluencerWorkspace(`/creator/courses/lesson/${id}`);
  const { data: lesson, error } = await supabase.from("lessons").select("id, title, description, duration_seconds").eq("id", id).maybeSingle();
  if (error || !lesson) throw new Error("This lesson is unavailable.");

  return <main className="mx-auto min-h-screen max-w-5xl p-6 md:p-10"><p className="font-label text-xs tracking-[0.14em] text-primary-container">CREATOR LESSON</p><h1 className="mt-2 font-headline text-3xl font-bold text-white">{lesson.title}</h1>{lesson.description && <p className="mt-3 max-w-2xl font-body text-on-surface-variant">{lesson.description}</p>}<div className="mt-8"><LessonPlayer lessonId={lesson.id} title={lesson.title} /></div></main>;
}
