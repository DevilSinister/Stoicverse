import { LessonPlayer } from "@/components/courses/LessonPlayer";
import { requireActiveMembership, requireInfluencerWorkspace } from "@/lib/supabase/access";

type LessonPageOptions = {
  params: Promise<{ id: string }>;
  nextPathBase?: string;
  creatorWorkspace?: boolean;
  routeBase?: string;
};

export async function renderLessonPage({ params, nextPathBase = "/courses/lesson", creatorWorkspace = false }: LessonPageOptions) {
  const { id } = await params;
  const nextPath = `${nextPathBase}/${id}`;
  const { supabase } = creatorWorkspace
    ? await requireInfluencerWorkspace(nextPath)
    : await requireActiveMembership(nextPath);
  const { data: lesson, error } = await supabase.from("lessons").select("id, title, description, duration_seconds").eq("id", id).maybeSingle();
  if (error || !lesson) throw new Error("This lesson is unavailable.");

  return <main className="mx-auto min-h-screen max-w-5xl p-6 md:p-10"><p className="font-label text-xs tracking-[0.14em] text-primary-container">SECURED LESSON</p><h1 className="mt-2 font-headline text-3xl font-bold text-white">{lesson.title}</h1>{lesson.description && <p className="mt-3 max-w-2xl font-body text-on-surface-variant">{lesson.description}</p>}<div className="mt-8"><LessonPlayer lessonId={lesson.id} title={lesson.title} /></div></main>;
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  return renderLessonPage({ params });
}
