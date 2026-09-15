"use client";

import { Loader2, ShieldOff, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { banMember, bulkDeleteMessages, resolveReport, unbanMember } from "@/app/community/moderation-actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { REPORT_REASON_LABELS, SANCTION_LIMITS, type ReportStatus } from "@/lib/community-settings/model";
import type { BanRow, ReportRow } from "@/lib/community-settings/moderation";
import type { Notify } from "@/components/ui/toast";

/**
 * The reports queue.
 *
 * Every button resolves the report in the same action that acts on the
 * message, because a moderator who deletes a message and then has to remember
 * to close the report leaves a queue full of work already done.
 *
 * Monolith, phase 12b. Beyond the palette: **one transition's `pending` was
 * being read by every row.** `useTransition` returns a single flag for the
 * whole component, and both lists spread it across their entire list - so
 * dismissing one report put a spinner on every other report's action bar, and
 * in Bans, where the flag replaced the button's *label*, lifting one ban blanked
 * the words "Lift ban" on every row at once. The transition still disables all
 * of them, which is right: two sanctions in flight at once is not something to
 * offer. What is wrong is claiming they are all working. `acting` names the row.
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
  onNotice: Notify;
}) {
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = reports.filter((report) => !handled.has(report.id));

  const finish = (reportId: string, message: string) => {
    setHandled((current) => new Set(current).add(reportId));
    onNotice(message, "success");
  };

  const dismiss = (report: ReportRow) => {
    setActing(report.id);
    startTransition(async () => {
      const result = await resolveReport(report.id, "dismissed");
      setActing(null);
      if (result.error) {
        onNotice(result.error, "error");
        return;
      }
      finish(report.id, "Report dismissed.");
    });
  };

  const deleteAndResolve = (report: ReportRow) => {
    setActing(report.id);
    startTransition(async () => {
      const removal = await bulkDeleteMessages([report.postId], `Reported as ${report.reasonKind}`);
      if (removal.error) {
        setActing(null);
        onNotice(removal.error, "error");
        return;
      }
      const result = await resolveReport(report.id, "resolved", "Message deleted");
      setActing(null);
      if (result.error) {
        onNotice(result.error, "error");
        return;
      }
      finish(report.id, "Message deleted and report resolved.");
    });
  };

  const banAndResolve = (report: ReportRow) => {
    const authorId = report.postAuthorId;
    if (!authorId) {
      onNotice("That message has no author to ban.", "error");
      return;
    }
    setActing(report.id);
    startTransition(async () => {
      const ban = await banMember(authorId, `Reported as ${report.reasonKind}`);
      if (ban.error) {
        setActing(null);
        onNotice(ban.error, "error");
        return;
      }
      const result = await resolveReport(report.id, "resolved", "Author banned", ban.caseId);
      setActing(null);
      if (result.error) {
        onNotice(result.error, "error");
        return;
      }
      finish(report.id, "Member banned and report resolved.");
    });
  };

  if (!canModerate) {
    return (
      <div className="rounded-xl border border-border-hairline">
        <EmptyState
          title="You cannot read reports"
          description="Reading the reports queue needs the Moderate members permission."
        />
      </div>
    );
  }

  if (!visible.length) {
    return (
      <div className="rounded-xl border border-border-hairline">
        <EmptyState
          title={status === "open" ? "Nothing is waiting" : "No reports have been closed yet"}
          description={
            status === "open"
              ? "Reported messages land here, with the message as it was and who reported it."
              : "Reports you dismiss or resolve will be listed here."
          }
        />
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {visible.map((report) => (
        <li key={report.id} className="rounded-xl border border-border-hairline p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-content-sm font-medium text-text-strong">
              {REPORT_REASON_LABELS[report.reasonKind] ?? report.reasonKind}
            </p>
            <p className="text-chrome-base text-text-muted">
              #{report.channelName} · reported by {report.reporterName}
            </p>
          </div>

          {/* The fill is the separator. This sits inside a card that already has
              its own border, so a rule down one edge would be a third boundary
              doing what the first two already do. */}
          <blockquote className="mt-3 rounded-lg bg-surface-panel p-chrome-x">
            <p className="text-chrome-base font-medium text-text-muted">{report.postAuthorName}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-content-sm text-text-default">
              {report.postBody || "(no text)"}
            </p>
          </blockquote>

          {report.details && <p className="mt-2 text-chrome-base text-text-muted">What they added: {report.details}</p>}

          {status === "open" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-hairline pt-3">
              <Button type="button" variant="outline" disabled={pending} onClick={() => dismiss(report)}>
                Dismiss
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => deleteAndResolve(report)}>
                <Trash2 size={14} aria-hidden="true" />
                Delete message
              </Button>
              {canBan && report.postAuthorId && (
                <Button type="button" variant="destructive" disabled={pending} onClick={() => banAndResolve(report)}>
                  <ShieldOff size={14} aria-hidden="true" />
                  Ban author
                </Button>
              )}
              {acting === report.id && <Loader2 size={15} aria-hidden="true" className="animate-spin text-text-muted" />}
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
export function BansSection({ bans, canBan, onNotice }: { bans: BanRow[]; canBan: boolean; onNotice: Notify }) {
  const [lifted, setLifted] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = bans.filter((ban) => !lifted.has(ban.caseId));

  const lift = (ban: BanRow) => {
    setActing(ban.caseId);
    startTransition(async () => {
      const result = await unbanMember(ban.memberId);
      setActing(null);
      if (result.error) {
        onNotice(result.error, "error");
        return;
      }
      setLifted((current) => new Set(current).add(ban.caseId));
      onNotice(`${ban.memberName} can take part again.`, "success");
    });
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-border-hairline bg-surface-panel p-4 text-content-sm text-text-default">
        A ban keeps someone out of the community. It does not end their subscription and does not touch their courses
        or events — suspending an account is a separate action in Members.
      </p>

      {!visible.length ? (
        <div className="rounded-xl border border-border-hairline">
          <EmptyState
            title="Nobody is banned"
            description="Bans made from a report or from the member list appear here until they are lifted."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border-hairline rounded-xl border border-border-hairline">
          {visible.map((ban) => (
            <li key={ban.caseId} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-content-sm font-medium text-text-strong">
                  {ban.memberName} <span className="font-normal text-text-muted">· case {ban.caseNumber}</span>
                </p>
                <p className="mt-0.5 text-chrome-base text-text-muted">
                  {ban.reason ?? "No reason recorded"} — by {ban.actorName}
                </p>
              </div>
              {canBan && (
                <Button type="button" variant="outline" disabled={pending} onClick={() => lift(ban)} className="shrink-0">
                  {acting === ban.caseId && <Loader2 size={14} aria-hidden="true" className="animate-spin" />}
                  Lift ban
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-chrome-base text-text-muted">
        Reasons are limited to {SANCTION_LIMITS.reason.max} characters and are shown to the member.
      </p>
    </div>
  );
}
