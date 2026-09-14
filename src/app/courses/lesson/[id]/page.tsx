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

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <p className="terminal-label text-text-faint">Secured lesson</p>
      <h1 className="mt-3 text-title-lg font-medium text-text-strong">{lesson.title}</h1>
      {lesson.description && <p className="mt-3 max-w-2xl text-content-base text-text-default">{lesson.description}</p>}
      <div className="mt-8">
        <LessonPlayer lessonId={lesson.id} title={lesson.title} />
      </div>
    </main>
  );
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  return renderLessonPage({ params });
}
