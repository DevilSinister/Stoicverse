"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Lock, PlayCircle, Users, Clapperboard, Clock, X, Info } from "lucide-react";
import { enrollInCourse } from "@/app/courses/actions";
import { AppShell } from "@/components/layout/AppShell";
import { withRouteBase } from "@/lib/navigation/paths";

export type CourseCard = {
  id: string;
  title: string;
  description: string | null;
  minTier: number;
  rewardTier: number | null;
  isFinished: boolean;
  isCompleted: boolean;
  isEnrolled: boolean;
  isLocked: boolean;
  missingCount: number;
  missingCourses: string[];
  enrollmentCount: number;
  videos: { id: string; title: string; durationSeconds: number; isOptional: boolean }[];
  progressPercent: number;
};

export function CourseCatalog({
  courses,
  memberName,
  platformRole,
  currentTier,
  isMaster,
  routeBase = "",
}: {
  courses: CourseCard[];
  memberName: string;
  platformRole: string;
  currentTier: number;
  isMaster: boolean;
  routeBase?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedCourse, setSelectedCourse] = useState<CourseCard | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<boolean>(false);

  const handleEnrollClick = (course: CourseCard) => {
    setSelectedCourse(course);
    setEnrollSuccess(false);
    setMessage(null);
  };

  const handleConfirmEnroll = (id: string) => {
    startTransition(async () => {
      const result = await enrollInCourse(id);
      if (result.error) {
        setMessage(result.error);
      } else {
        setEnrollSuccess(true);
        setMessage("You are successfully enrolled! Start watching the first video below.");
        router.refresh();
      }
    });
  };

  // Helper to sum total duration of videos
  const formatTotalDuration = (videos: CourseCard["videos"]) => {
    const totalSeconds = videos.reduce((acc, v) => acc + v.durationSeconds, 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.ceil((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  return (
    <AppShell
      active="Courses"
      title="Courses"
      memberName={memberName}
      platformRole={platformRole}
      currentTier={currentTier}
      isMaster={isMaster}
      routeBase={routeBase}
    >
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8">
        <header className="border-b border-surgical-steel pb-6">
          <p className="font-label text-xs uppercase tracking-[.16em] text-primary-container">Structured curriculum</p>
          <h1 className="mt-2 font-headline text-3xl font-bold text-white">Your courses</h1>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            Watch each video to 80% to open the next. Complete every required video after the creator finishes a course to earn its next tier.
          </p>
        </header>

        {message && !selectedCourse && (
          <p role="status" className="rounded border border-surgical-steel bg-surface-container-low p-3 text-sm text-on-surface-variant">
            {message}
          </p>
        )}

        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <article
              key={course.id}
              className={`flex flex-col justify-between rounded border p-6 transition-all duration-200 ${
                course.isLocked
                  ? "border-surgical-steel/40 bg-surface-container-low/20 opacity-80"
                  : "border-surgical-steel bg-monolith-surface hover:border-surgical-steel/80"
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="font-label text-xs uppercase tracking-wider text-primary-container">
                    Tier {course.minTier} Required
                  </span>
                  {course.isCompleted ? (
                    <CheckCircle2 className="text-primary-container" size={18} />
                  ) : course.isLocked ? (
                    <Lock className="text-fog-muted" size={18} />
                  ) : (
                    <PlayCircle className="text-primary-container" size={18} />
                  )}
                </div>

                <h2 className="mt-4 font-headline text-2xl font-semibold text-white">{course.title}</h2>
                <p className="mt-2 min-h-12 text-sm text-on-surface-variant line-clamp-3">
                  {course.description || "No description provided."}
                </p>

                {/* Progress bar for enrolled courses */}
                {course.isEnrolled && !course.isLocked && (
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-label uppercase tracking-wider">
                      <span className="text-fog-muted font-bold">Progress</span>
                      <span className="text-primary-container font-extrabold">{course.progressPercent}%</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden border border-surgical-steel/50 p-px">
                      <div
                        className="h-full bg-primary-container rounded-full transition-all duration-350 emerald-glow"
                        style={{ width: `${course.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Requirements / Missing info for locked courses */}
                {course.isLocked && (
                  <div className="mt-4 rounded border border-red-500/20 bg-red-500/5 p-3 text-xs space-y-2">
                    <p className="font-semibold text-red-300 flex items-center gap-1.5">
                      <Info size={13} /> Prerequisites missing:
                    </p>
                    <ul className="space-y-1 text-on-surface-variant pl-4 list-disc">
                      {currentTier < course.minTier && (
                        <li>Requires membership Tier {course.minTier} (You are Tier {currentTier})</li>
                      )}
                      {course.missingCourses.map((c, i) => (
                        <li key={i}>Must complete course: &ldquo;{c}&rdquo;</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Info block for unenrolled, unlocked courses */}
                {!course.isEnrolled && !course.isLocked && (
                  <p className="mt-4 text-xs text-fog-muted leading-relaxed">
                    Enroll to unlock {course.videos.length} lessons and progress tracking.
                    {course.isFinished && course.rewardTier && (
                      <span className="text-primary-container font-semibold block mt-1">
                        Completion grants membership Tier {course.rewardTier}.
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-surgical-steel/30 flex items-center justify-between">
                <span className="text-xs text-fog-muted flex items-center gap-1">
                  <Users size={12} /> {course.enrollmentCount} studying
                </span>

                <div>
                  {course.isLocked ? (
                    <span className="text-xs font-semibold uppercase tracking-wider text-fog-muted">Locked</span>
                  ) : course.isEnrolled ? (
                    <Link
                      className="inline-flex items-center gap-2 rounded-full border border-primary-container px-4 py-1.5 text-xs uppercase font-semibold text-primary-container transition hover:bg-primary-container/10"
                      href={withRouteBase(routeBase, `/courses/${course.id}`)}
                    >
                      {course.isCompleted ? "Review" : "Continue"}
                      <ChevronRight size={14} />
                    </Link>
                  ) : (
                    <button
                      disabled={pending}
                      onClick={() => handleEnrollClick(course)}
                      className="rounded-full bg-primary-container px-4 py-1.5 text-xs font-semibold uppercase text-on-primary-fixed hover:brightness-105 active:scale-95 transition"
                    >
                      Enroll
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {!courses.length && <p className="text-on-surface-variant">No courses are published yet.</p>}
        </section>
      </div>

      {/* Enrollment Information Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl rounded-lg border border-surgical-steel bg-monolith-surface p-6 shadow-2xl space-y-6">
            <button
              onClick={() => setSelectedCourse(null)}
              className="absolute right-4 top-4 text-fog-muted hover:text-white transition"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            <header className="space-y-1.5 pr-8">
              <span className="text-xs uppercase font-semibold tracking-widest text-primary-container">
                Course Preview · Tier {selectedCourse.minTier}
              </span>
              <h2 className="font-headline text-3xl font-bold text-white">{selectedCourse.title}</h2>
              
              <div className="flex items-center gap-4 text-xs text-fog-muted pt-1">
                <span className="flex items-center gap-1 text-primary-container/90">
                  <Users size={14} /> {selectedCourse.enrollmentCount} practitioners studying
                </span>
                <span className="flex items-center gap-1">
                  <Clapperboard size={14} /> {selectedCourse.videos.length} lessons
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} /> {formatTotalDuration(selectedCourse.videos)}
                </span>
              </div>
            </header>

            <div className="space-y-4">
              <div>
                <h3 className="text-xs uppercase font-semibold tracking-wider text-white">Description</h3>
                <p className="mt-1.5 text-sm text-on-surface-variant leading-relaxed">
                  {selectedCourse.description || "No description provided."}
                </p>
              </div>

              <div>
                <h3 className="text-xs uppercase font-semibold tracking-wider text-white">Curriculum</h3>
                <div className="mt-2 max-h-48 overflow-y-auto border border-surgical-steel/45 rounded bg-surface-container-lowest/50 divide-y divide-surgical-steel/30">
                  {selectedCourse.videos.map((video, idx) => (
                    <div key={video.id} className="flex items-center justify-between p-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-fog-muted font-mono">{String(idx + 1).padStart(2, "0")}</span>
                        <span className="text-white font-medium">{video.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-fog-muted">
                        <span>{Math.ceil(video.durationSeconds / 60)}m</span>
                        {video.isOptional && (
                          <span className="rounded bg-surgical-steel/40 px-1.5 py-0.5 text-[10px] text-fog-muted">
                            Optional
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {selectedCourse.videos.length === 0 && (
                    <p className="p-4 text-center text-sm text-fog-muted">No lessons published in this course yet.</p>
                  )}
                </div>
              </div>
            </div>

            {message && (
              <p
                role="status"
                className={`rounded border p-3 text-xs ${
                  enrollSuccess
                    ? "border-primary-container/45 bg-primary-container/10 text-primary-container"
                    : "border-red-500/35 bg-red-500/10 text-red-300"
                }`}
              >
                {message}
              </p>
            )}

            <footer className="flex items-center justify-end gap-3 pt-4 border-t border-surgical-steel/30">
              {enrollSuccess ? (
                <Link
                  href={withRouteBase(routeBase, `/courses/${selectedCourse.id}`)}
                  className="rounded-full bg-primary-container px-5 py-2 text-xs font-semibold uppercase text-on-primary-fixed hover:brightness-105 active:scale-95 transition flex items-center gap-1"
                >
                  Start Studying <ChevronRight size={14} />
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedCourse(null)}
                    className="rounded-full border border-surgical-steel px-5 py-2 text-xs font-semibold uppercase text-fog-muted hover:text-white hover:border-surgical-steel/80 transition"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => handleConfirmEnroll(selectedCourse.id)}
                    className="rounded-full bg-primary-container px-5 py-2 text-xs font-semibold uppercase text-on-primary-fixed hover:brightness-105 active:scale-95 transition disabled:opacity-60"
                  >
                    {pending ? "Enrolling..." : "Enroll in Course"}
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}
