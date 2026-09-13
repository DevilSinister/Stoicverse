"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

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
      <p role="alert" className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm leading-6 text-error">
        {degraded.join(" ")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="audit-action" className="text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">
          Action
        </label>
        <select
          id="audit-action"
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="focus-ring h-11 rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-text-strong outline-none"
        >
          <option value="">All</option>
          {ACTIONS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={download}
          disabled={filtered.length === 0}
          className="focus-ring ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-text-strong transition hover:border-primary-container disabled:opacity-40"
        >
          <Download size={15} aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-surgical-steel p-6">
          <p className="text-sm leading-6 text-on-surface-variant">
            Nothing has been moderated yet. Every edit, deletion, pin and flag will appear here, with the message as it
            was before the change.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        // Filtered-empty gets its own words. Reusing the empty-state copy here
        // would tell the creator nothing has ever happened, which is false.
        <div className="rounded-xl border border-surgical-steel p-6">
          <p className="text-sm leading-6 text-on-surface-variant">
            No {action} events on this page. Clear the filter to see the rest.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surgical-steel">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-surgical-steel text-xs uppercase tracking-[0.08em] text-fog-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  When
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Who
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  What
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <tr key={event.id} className="border-b border-surgical-steel/60 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-fog-muted">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-text-strong">{event.actorName}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {ACTION_COPY[event.action] ?? event.action}
                    {event.channelName && <span className="text-fog-muted"> in {event.channelName}</span>}
                  </td>
                  <td className="px-4 py-3 text-fog-muted">
                    {event.reason && <span className="block">{event.reason}</span>}
                    {event.previousBody && (
                      <details>
                        <summary className="focus-ring inline-block min-h-9 cursor-pointer py-1 text-xs font-semibold text-on-surface-variant">
                          Previous text
                        </summary>
                        <p className="mt-1 max-w-md whitespace-pre-wrap text-xs leading-5">{event.previousBody}</p>
                      </details>
                    )}
                    {!event.reason && !event.previousBody && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
