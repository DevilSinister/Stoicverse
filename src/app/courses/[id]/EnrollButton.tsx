"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { enrollInCourse } from "@/app/courses/actions";

export function EnrollButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = () => {
    setError(null);
    startTransition(async () => {
      const result = await enrollInCourse(courseId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        disabled={pending}
        onClick={handleEnroll}
        className="rounded-full bg-primary-container px-5 py-2 text-xs font-semibold uppercase text-on-primary-fixed hover:brightness-105 active:scale-95 transition disabled:opacity-60"
      >
        {pending ? "Enrolling..." : "Enroll Now"}
      </button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
