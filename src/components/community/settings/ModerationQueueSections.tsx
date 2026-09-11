"use client";

import { Loader2, ShieldOff, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { banMember, bulkDeleteMessages, resolveReport, unbanMember } from "@/app/community/moderation-actions";
import { REPORT_REASON_LABELS, SANCTION_LIMITS, type ReportStatus } from "@/lib/community-settings/model";
import type { BanRow, ReportRow } from "@/lib/community-settings/moderation";

/**
 * The reports queue.
 *
 * Every button resolves the report in the same action that acts on the
 * message, because a moderator who deletes a message and then has to remember
 * to close the report leaves a queue full of work already done.
 */
export function ReportsSection({
  reports,
  status,
  canModerate,
  canBan,
  onNotice,
}: {
  reports: ReportRow[];
  status: ReportStatus;
  canModerate: boolean;
  canBan: boolean;
  onNotice: (value: string) => void;
}) {
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = reports.filter((report) => !handled.has(report.id));

  const finish = (reportId: string, message: string) => {
    setHandled((current) => new Set(current).add(reportId));
    onNotice(message);
  };

  const dismiss = (report: ReportRow) =>
    startTransition(async () => {
      const result = await resolveReport(report.id, "dismissed");
      if (result.error) {
        onNotice(result.error);
        return;
      }
      finish(report.id, "Report dismissed.");
    });

  const deleteAndResolve = (report: ReportRow) =>
    startTransition(async () => {
      const removal = await bulkDeleteMessages([report.postId], `Reported as ${report.reasonKind}`);
      if (removal.error) {
        onNotice(removal.error);
        return;
      }
      const result = await resolveReport(report.id, "resolved", "Message deleted");
      if (result.error) {
        onNotice(result.error);
        return;
      }
      finish(report.id, "Message deleted and report resolved.");
    });

  const banAndResolve = (report: ReportRow) =>
    startTransition(async () => {
      if (!report.postAuthorId) {
        onNotice("That message has no author to ban.");
        return;
      }
      const ban = await banMember(report.postAuthorId, `Reported as ${report.reasonKind}`);
      if (ban.error) {
        onNotice(ban.error);
        return;
      }
      const result = await resolveReport(report.id, "resolved", "Author banned", ban.caseId);
      if (result.error) {
        onNotice(result.error);
        return;
      }
      finish(report.id, "Member banned and report resolved.");
    });

  if (!canModerate) {
    return (
      <p className="rounded-xl border border-surgical-steel p-6 text-sm leading-6 text-on-surface-variant">
        You do not have permission to read reports.
      </p>
    );
  }

  if (!visible.length) {
    return (
      <p className="rounded-xl border border-surgical-steel p-6 text-sm leading-6 text-on-surface-variant">
        {status === "open" ? "Nothing is waiting. Reported messages land here." : "No reports have been closed yet."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {visible.map((report) => (
        <li key={report.id} className="rounded-xl border border-surgical-steel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-white">
              {REPORT_REASON_LABELS[report.reasonKind] ?? report.reasonKind}
            </p>
            <p className="text-xs text-fog-muted">
              #{report.channelName} · reported by {report.reporterName}
            </p>
          </div>

          <blockquote className="mt-3 rounded-lg border-l-2 border-surgical-steel bg-surface-container-low p-3">
            <p className="text-xs font-semibold text-on-surface-variant">{report.postAuthorName}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface">
              {report.postBody || "(no text)"}
            </p>
          </blockquote>

          {report.details && (
            <p className="mt-2 text-xs leading-5 text-fog-muted">What they added: {report.details}</p>
          )}

          {status === "open" && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-surgical-steel pt-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => dismiss(report)}
                className="focus-ring inline-flex min-h-11 items-center rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high/50 disabled:opacity-40"
              >
                Dismiss
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => deleteAndResolve(report)}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high/50 disabled:opacity-40"
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete message
              </button>
              {canBan && report.postAuthorId && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => banAndResolve(report)}
                  className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-error/40 px-4 text-sm font-semibold text-error transition hover:bg-error/10 disabled:opacity-40"
                >
                  <ShieldOff size={14} aria-hidden="true" />
                  Ban author
                </button>
              )}
              {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin self-center text-fog-muted" />}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Every ban in force, and the one control that lifts it.
 *
 * The copy says what a ban is and is not, because the difference between
 * "barred from the community" and "subscription ended" is invisible from a list
 * of names and is the thing most likely to be assumed wrongly.
 */
export function BansSection({
  bans,
  canBan,
  onNotice,
}: {
  bans: BanRow[];
  canBan: boolean;
  onNotice: (value: string) => void;
}) {
  const [lifted, setLifted] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = bans.filter((ban) => !lifted.has(ban.caseId));

  const lift = (ban: BanRow) =>
    startTransition(async () => {
      const result = await unbanMember(ban.memberId);
      if (result.error) {
        onNotice(result.error);
        return;
      }
      setLifted((current) => new Set(current).add(ban.caseId));
      onNotice(`${ban.memberName} can take part again.`);
    });

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-surgical-steel bg-surface-container-low p-4 text-sm leading-6 text-on-surface">
        A ban keeps someone out of the community. It does not end their subscription and does not touch their courses
        or events — suspending an account is a separate action in Members.
      </p>

      {!visible.length ? (
        <p className="rounded-xl border border-surgical-steel p-6 text-sm leading-6 text-on-surface-variant">
          Nobody is banned.
        </p>
      ) : (
        <ul className="divide-y divide-surgical-steel rounded-xl border border-surgical-steel">
          {visible.map((ban) => (
            <li key={ban.caseId} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {ban.memberName} <span className="font-normal text-fog-muted">· case {ban.caseNumber}</span>
                </p>
                <p className="mt-0.5 text-xs leading-5 text-fog-muted">
                  {ban.reason ?? "No reason recorded"} — by {ban.actorName}
                </p>
              </div>
              {canBan && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => lift(ban)}
                  className="focus-ring inline-flex min-h-11 shrink-0 items-center rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high/50 disabled:opacity-40"
                >
                  {pending ? <Loader2 size={14} aria-hidden="true" className="animate-spin" /> : "Lift ban"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-5 text-fog-muted">
        Reasons are limited to {SANCTION_LIMITS.reason.max} characters and are shown to the member.
      </p>
    </div>
  );
}
