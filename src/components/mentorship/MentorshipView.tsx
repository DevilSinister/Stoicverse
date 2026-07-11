"use client";

import Link from "next/link";
import { BookOpen, Calendar, Check, ChevronRight, MessageSquare, Video, ShieldAlert, Sparkles, ExternalLink, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";

type MentorshipViewProps = {
  isMaster: boolean;
  memberName: string;
  platformRole: string;
  currentTier: number;
  notifications: any[];
  hasMentorship: boolean;
  bookingUrl: string | null;
  mentorName: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export default function MentorshipView({
  isMaster,
  memberName,
  platformRole,
  currentTier,
  notifications,
  hasMentorship: dbHasMentorship,
  bookingUrl,
  mentorName = "Marcus Aurelius",
  startsAt,
  endsAt,
}: MentorshipViewProps) {
  const [hasLocalMentorship, setHasLocalMentorship] = useState(false);

  useEffect(() => {
    // Check if local cookie or storage has mentorship active
    const localActive = localStorage.getItem("stoicverse_mentorship_active") === "true" ||
      document.cookie.includes("stoicverse_mentorship_active=true");
    setHasLocalMentorship(localActive);
  }, []);

  const hasMentorship = dbHasMentorship || hasLocalMentorship;

  return (
    <AppShell
      active="Mentorship"
      title="Stoic Mentorship"
      isMaster={isMaster}
      memberName={memberName}
      platformRole={platformRole}
      currentTier={currentTier}
      notifications={notifications}
    >
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        {hasMentorship ? (
          /* Active Mentorship Workspace */
          <div className="space-y-8">
            {/* Header Badge */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 rounded-lg">
              <div>
                <span className="font-label text-[10px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                  <Sparkles size={12} className="animate-pulse" />
                  Active Mentorship Session
                </span>
                <h2 className="mt-1 font-headline text-lg font-bold text-white">Your guidance slot is fully provisioned.</h2>
              </div>
              <div className="font-label text-xs text-emerald-300">
                Ends: {endsAt ? new Date(endsAt).toLocaleDateString() : "2 months from purchase"}
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 md:grid-cols-12">
              {/* Mentor Card */}
              <div className="border border-surgical-steel bg-surface-container-low p-6 rounded-lg md:col-span-7 space-y-6">
                <h3 className="font-headline text-base font-bold text-white border-b border-surgical-steel pb-3">Your Assigned Mentor</h3>
                <div className="flex items-start gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded bg-primary-container border border-surgical-steel font-headline text-xl font-bold text-primary-container">
                    {mentorName ? mentorName[0] : "M"}
                  </div>
                  <div>
                    <h4 className="font-headline text-md font-bold text-white">{mentorName || "Marcus Aurelius"}</h4>
                    <p className="mt-1 font-body text-sm text-on-surface-variant leading-relaxed">
                      Your guide will personally review your daily journal reflection logs, provide corrections, and hold reflection slots.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-surgical-steel">
                  <h4 className="font-label text-[10px] uppercase tracking-wider text-fog-muted">Mentorship Guidelines</h4>
                  <ul className="space-y-2 font-body text-xs text-on-surface-variant">
                    <li className="flex items-start gap-2">
                      <span className="text-primary-container font-semibold">•</span>
                      <span>Log reflections in the `#morning-reflections` channel; select private feedback options.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-container font-semibold">•</span>
                      <span>Your mentor reviews submissions within 24 hours Monday through Friday.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Call Booking Card */}
              <div className="border border-surgical-steel bg-surface-container-low p-6 rounded-lg md:col-span-5 space-y-6">
                <h3 className="font-headline text-base font-bold text-white border-b border-surgical-steel pb-3">Booking Calendar</h3>
                <div className="space-y-4">
                  <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                    You have private 60-minute reflection slots available every two weeks. Use the calendar link below to schedule your video call.
                  </p>
                  <a
                    href={bookingUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-4 font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider transition hover:brightness-105 active:scale-[0.98] emerald-glow"
                  >
                    <Calendar size={16} />
                    Book Private Session
                    <ExternalLink size={14} className="ml-1" />
                  </a>
                </div>
              </div>
            </div>

            {/* Guidance Logs Section */}
            <div className="border border-surgical-steel bg-surface-container-low p-6 rounded-lg space-y-4">
              <h3 className="font-headline text-base font-bold text-white">Private Guidance Logs</h3>
              <div className="py-8 text-center border border-dashed border-surgical-steel rounded bg-surface-container-low/20">
                <MessageCircle size={40} className="mx-auto text-fog-muted mb-3" />
                <p className="font-headline text-sm font-semibold text-white">No active reviews yet</p>
                <p className="font-body text-xs text-fog-muted mt-1">Submit your first reflection log to start receiving private guidance.</p>
              </div>
            </div>
          </div>
        ) : (
          /* Mentorship Landing / Sales Pitch Screen */
          <div className="space-y-10">
            {/* Hero pitch */}
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-1.5 border border-primary-container/20 bg-primary-container/10 px-3 py-1 rounded-full font-label text-[10px] text-primary-container uppercase tracking-wider font-semibold">
                <Sparkles size={12} />
                Now Open For Enrollment
              </span>
              <h1 className="font-headline text-3xl font-extrabold text-white leading-tight md:text-5xl">
                Stoic Mentorship.
              </h1>
              <p className="font-body text-base md:text-lg text-on-surface-variant leading-relaxed">
                Direct, personal alignment on your practice. Work 1-on-1 with a Master Stoic to refine your judgment, discipline, and emotional control.
              </p>
            </div>

            {/* Benefits Grid */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="border border-surgical-steel bg-surface-container-low p-6 rounded-lg space-y-3">
                <div className="size-10 rounded-full bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary-container mb-2">
                  <BookOpen size={20} />
                </div>
                <h3 className="font-headline text-base font-bold text-white">1-on-1 Daily Log Review</h3>
                <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                  Your assigned mentor reads and annotates your daily journal reflections, giving you direct feedback on how you apply Stoic logic.
                </p>
              </div>

              <div className="border border-surgical-steel bg-surface-container-low p-6 rounded-lg space-y-3">
                <div className="size-10 rounded-full bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary-container mb-2">
                  <Video size={20} />
                </div>
                <h3 className="font-headline text-base font-bold text-white">Bi-Weekly Private Calls</h3>
                <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                  Two private 60-minute video reflection calls per month to calibrate your practice, test your progress, and align direction.
                </p>
              </div>

              <div className="border border-surgical-steel bg-surface-container-low p-6 rounded-lg space-y-3">
                <div className="size-10 rounded-full bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary-container mb-2">
                  <MessageSquare size={20} />
                </div>
                <h3 className="font-headline text-base font-bold text-white">Custom Study Roadmap</h3>
                <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                  An individualized exercise plan mapped to your personal hurdles, providing readings and meditations focused on your objectives.
                </p>
              </div>
            </div>

            {/* Call-to-action pricing box */}
            <div className="mx-auto max-w-xl border-t-2 border-t-primary-container border-x border-b border-surgical-steel bg-monolith-surface p-8 rounded-lg shadow-xl text-center space-y-6">
              <div className="space-y-2">
                <h3 className="font-headline text-xl font-bold text-white">Private Guidance Cohort</h3>
                <p className="font-body text-sm text-on-surface-variant">2 Months of Private 1-on-1 Mentorship</p>
              </div>

              <div className="font-headline text-4xl font-extrabold text-primary-container">
                $1,000.00
                <span className="text-sm font-normal text-fog-muted block mt-1">One-time payment for 60 days of full access</span>
              </div>

              <Link
                href="/checkout?product=mentorship"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-6 font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition duration-200 shadow-md emerald-glow"
              >
                Enroll in Mentorship
                <ChevronRight size={16} />
              </Link>

              <div className="flex items-center justify-center gap-2 text-[10px] font-label text-fog-muted uppercase tracking-wider">
                <Check size={12} className="text-primary-container" /> Limited capacity (max 5 active slots per cohort)
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
