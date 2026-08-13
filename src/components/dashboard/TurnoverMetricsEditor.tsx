"use client";

import { useActionState, useState } from "react";
import { Check, LoaderCircle, PencilLine, X } from "lucide-react";

import {
  EMPTY_TURNOVER_ACTION_STATE,
  updateTurnoverMetrics,
} from "@/app/dashboard/actions";

export type TurnoverMetrics = {
  turnoverThisWeek: number;
  allTimeTurnover: number;
  updatedAt: string | null;
};

export function TurnoverMetricsEditor({ metrics }: { metrics: TurnoverMetrics }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateTurnoverMetrics, EMPTY_TURNOVER_ACTION_STATE);

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-surgical-steel px-4 text-xs font-semibold text-on-surface transition hover:border-primary-container hover:text-primary-container"
        >
          <PencilLine size={14} /> Update turnover
        </button>
      ) : (
        <form action={action} className="rounded-xl border border-surgical-steel bg-surface-container-low p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Update member turnover</h3>
              <p className="mt-1 text-xs leading-5 text-fog-muted">Published immediately to every member dashboard. Amounts are shown in USD.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="focus-ring grid size-10 shrink-0 place-items-center rounded-full text-fog-muted transition hover:bg-surface-container-high hover:text-white" aria-label="Close turnover editor"><X size={17} /></button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-on-surface">This week
              <span className="relative mt-2 block"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-fog-muted">$</span><input name="turnoverThisWeek" type="number" inputMode="decimal" min="0" max="999999999999.99" step="0.01" defaultValue={metrics.turnoverThisWeek} required className="focus-ring min-h-12 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest pl-8 pr-3 text-base tabular-nums text-white" /></span>
            </label>
            <label className="text-sm font-semibold text-on-surface">All time
              <span className="relative mt-2 block"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-fog-muted">$</span><input name="allTimeTurnover" type="number" inputMode="decimal" min="0" max="999999999999.99" step="0.01" defaultValue={metrics.allTimeTurnover} required className="focus-ring min-h-12 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest pl-8 pr-3 text-base tabular-nums text-white" /></span>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{pending ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}Save figures</button>
            {(state.error || state.message) && <p role={state.error ? "alert" : "status"} className={`text-sm ${state.error ? "text-error" : "text-primary-container"}`}>{state.error || state.message}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
