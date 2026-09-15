"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { nativeSelectClass } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AuditEvent } from "@/lib/community-settings/governance";

const ACTIONS = ["edit", "delete", "pin", "unpin", "flag"] as const;

const ACTION_COPY: Record<string, string> = {
  edit: "edited a message",
  delete: "deleted a message",
  pin: "pinned a message",
  unpin: "unpinned a message",
  flag: "posted a flagged message",
};

/**
 * The moderation trail, read-only.
 *
 * The table has been collecting since the audit migration shipped; this is the
 * first thing that displays it. Filtering happens here over the loaded page
 * rather than round-tripping, because a page is 25 rows.
 *
 * Monolith, phase 12a. The table is `ui/table` and both empty states are
 * `ui/empty-state`; the filter stays a native `<select>`, on the reasoning
 * recorded in phase 11a and now written down once in `ui/select`.
 */
export function AuditLogSection({ events, degraded }: { events: AuditEvent[]; degraded: string[] }) {
  const [action, setAction] = useState<string>("");

  const filtered = useMemo(
    () => (action ? events.filter((event) => event.action === action) : events),
    [events, action],
  );

  const download = () => {
    const rows = [
      ["when", "who", "action", "channel", "reason"],
      ...filtered.map((event) => [
        event.createdAt,
        event.actorName,
        event.action,
        event.channelName ?? "",
        event.reason ?? "",
      ]),
    ];
    const csv = rows
      // Quote everything and double interior quotes: a reason containing a
      // comma would otherwise shift every later column.
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `community-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (degraded.length > 0) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-status-danger/40 bg-status-danger/10 p-chrome-x text-content-sm text-status-danger"
      >
        {degraded.join(" ")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="audit-action" className="terminal-label">
          Action
        </label>
        <select
          id="audit-action"
          value={action}
          onChange={(event) => setAction(event.target.value)}
          // `cn`, not a template string. `nativeSelectClass` carries `w-full`,
          // and two width classes in one attribute are resolved by stylesheet
          // order rather than by the order they are written - `w-full` wins and
          // the filter stretches across the row. twMerge is what drops the
          // loser. Lesson 96, in a string one character shorter than the fix.
          className={cn(nativeSelectClass, "w-auto")}
        >
          <option value="">All</option>
          {ACTIONS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>

        <Button type="button" variant="outline" onClick={download} disabled={filtered.length === 0} className="ml-auto">
          <Download size={15} aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-border-hairline">
          <EmptyState
            title="Nothing has been moderated yet"
            description="Every edit, deletion, pin and flag will appear here, with the message as it was before the change."
          />
        </div>
      ) : filtered.length === 0 ? (
        // Filtered-empty gets its own words. Reusing the empty-state copy here
        // would tell the creator nothing has ever happened, which is false.
        <div className="rounded-xl border border-border-hairline">
          <EmptyState title={`No ${action} events on this page`} description="Clear the filter to see the rest." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-hairline">
          <Table className="min-w-[40rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((event) => (
                <TableRow key={event.id} className="align-top">
                  <TableCell className="px-2 py-3 text-text-muted">
                    {new Date(event.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="px-2 py-3 text-text-strong">{event.actorName}</TableCell>
                  <TableCell className="px-2 py-3 text-text-default">
                    {ACTION_COPY[event.action] ?? event.action}
                    {event.channelName && <span className="text-text-muted"> in {event.channelName}</span>}
                  </TableCell>
                  <TableCell className="whitespace-normal px-2 py-3 text-text-muted">
                    {event.reason && <span className="block">{event.reason}</span>}
                    {event.previousBody && (
                      <details>
                        <summary className="focus-ring inline-block min-h-9 cursor-pointer py-1 text-chrome-sm font-medium text-text-default">
                          Previous text
                        </summary>
                        <p className="mt-1 max-w-md whitespace-pre-wrap text-chrome-sm leading-5">
                          {event.previousBody}
                        </p>
                      </details>
                    )}
                    {!event.reason && !event.previousBody && "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
