"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownToLine, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { csvText } from "@/lib/analytics/model";

/**
 * The revenue tables. Monolith, phase 11a.
 *
 * Tokens, the type scale, `ui/button` in place of a hand-written `control`
 * string, and the whole thing legible — the header row, the body and the pager
 * were one line each.
 *
 * Two behaviours worth naming because they are easy to lose in a rewrite: the
 * CSV carries reference ids the visible table does not (a row is identified by
 * a member's name on screen and by their id in the export), and the scroll
 * container is focusable so the table can be reached by keyboard on a narrow
 * viewport.
 */

export type RevenueColumn = { label: string; numeric?: boolean; format?: (value: number) => string };
export type RevenueRow = { id: string; values: (string | number | null)[]; references?: string[]; detail?: ReactNode };

const ROWS_PER_PAGE = 20;

export function RevenueTable({
  title,
  columns,
  rows,
  filename,
  referenceLabels = ["Record ID"],
}: {
  title: string;
  columns: RevenueColumn[];
  rows: RevenueRow[];
  filename: string;
  referenceLabels?: string[];
}) {
  const [sort, setSort] = useState<{ index: number; ascending: boolean } | null>(null);
  const [page, setPage] = useState(0);

  const ordered = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const left = a.values[sort.index];
      const right = b.values[sort.index];
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right));
      return (sort.ascending ? comparison : -comparison) || a.id.localeCompare(b.id);
    });
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const current = Math.min(page, pages - 1);

  const download = () => {
    const csv = csvText(
      [...referenceLabels, ...columns.map((column) => column.label)],
      ordered.map((row) => [...(row.references ?? [row.id]), ...row.values]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border-hairline">
      <div className="flex items-center justify-between gap-3 border-b border-border-hairline bg-surface-panel px-4 py-3">
        <p aria-live="polite" className="text-content-sm text-text-muted">
          {rows.length.toLocaleString()} {rows.length === 1 ? "record" : "records"} · sort by any column
        </p>
        <Button
          variant="outline"
          size="chrome"
          onClick={download}
          disabled={!rows.length}
          aria-label={`Export ${title} as CSV`}
        >
          <ArrowDownToLine size={14} />
          Export CSV
        </Button>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto" tabIndex={0} aria-label={`${title}, scroll for more columns`}>
          <table className="w-full min-w-[720px] text-left">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column.label}
                    scope="col"
                    aria-sort={sort?.index === index ? (sort.ascending ? "ascending" : "descending") : "none"}
                    className={`px-4 py-2 ${column.numeric ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      className="focus-ring terminal-label min-h-11 rounded-md text-left text-text-muted transition-colors hover:text-text-strong"
                      onClick={() => {
                        setSort({
                          index,
                          ascending: sort?.index === index ? !sort.ascending : !column.numeric,
                        });
                        setPage(0);
                      }}
                    >
                      {column.label}
                      {sort?.index === index ? (sort.ascending ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline">
              {ordered.slice(current * ROWS_PER_PAGE, current * ROWS_PER_PAGE + ROWS_PER_PAGE).map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-surface-raised">
                  {row.values.map((value, index) => (
                    <td
                      key={index}
                      className={`px-4 py-4 align-top text-content-sm ${
                        columns[index].numeric ? "whitespace-nowrap text-right font-mono tabular-nums" : ""
                      } ${index === 0 ? "font-medium text-text-strong" : "text-text-default"}`}
                    >
                      {index === 0 && row.detail ? (
                        <details>
                          <summary className="focus-ring min-h-6 cursor-pointer rounded-md">{value}</summary>
                          <div className="mt-3 max-w-sm min-w-48 space-y-1 text-chrome-base font-normal text-text-muted">
                            {row.detail}
                          </div>
                        </details>
                      ) : typeof value === "number" ? (
                        (columns[index].format?.(value) ?? value.toLocaleString())
                      ) : (
                        (value ?? "—")
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-h-52 place-items-center p-6 text-center">
          <div>
            <Search size={22} className="mx-auto text-text-faint" />
            <h3 className="mt-3 text-content-base text-text-strong">No matching records</h3>
            <p className="mt-2 text-content-sm text-text-muted">Change the period or clear a filter to see more.</p>
          </div>
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-border-hairline px-4 py-3">
        <p className="font-mono text-mono-xs text-text-muted tabular-nums">
          Page {current + 1} of {pages} · {ROWS_PER_PAGE} per page
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon-chrome"
            disabled={current === 0}
            aria-label={`Previous ${title} page`}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={15} />
          </Button>
          <Button
            variant="outline"
            size="icon-chrome"
            disabled={current + 1 >= pages}
            aria-label={`Next ${title} page`}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </footer>
    </div>
  );
}
