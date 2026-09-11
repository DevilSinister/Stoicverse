"use client";

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { csvText } from '@/lib/analytics/model';

export type RevenueColumn = { label: string; numeric?: boolean; format?: (value: number) => string };
export type RevenueRow = { id: string; values: (string | number | null)[]; references?: string[]; detail?: ReactNode };
const control = 'focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-surgical-steel px-4 text-sm font-semibold text-on-surface transition hover:border-primary-container disabled:opacity-40';

export function RevenueTable({ title, columns, rows, filename, referenceLabels = ['Record ID'] }: { title: string; columns: RevenueColumn[]; rows: RevenueRow[]; filename: string; referenceLabels?: string[] }) {
  const [sort, setSort] = useState<{ index: number; ascending: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const ordered = useMemo(() => sort ? [...rows].sort((a, b) => {
    const left = a.values[sort.index], right = b.values[sort.index];
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
    return (sort.ascending ? comparison : -comparison) || a.id.localeCompare(b.id);
  }) : rows, [rows, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const current = Math.min(page, pages - 1);
  const download = () => {
    const csv = csvText([...referenceLabels, ...columns.map(column => column.label)], ordered.map(row => [...(row.references ?? [row.id]), ...row.values]));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${filename}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="min-w-0 overflow-hidden rounded-xl border border-surgical-steel">
    <div className="flex items-center justify-between gap-3 border-b border-surgical-steel bg-surface-container-low px-4 py-3">
      <p aria-live="polite" className="text-xs leading-5 text-fog-muted">{rows.length.toLocaleString()} {rows.length === 1 ? 'record' : 'records'} · sort by any column</p>
      <button type="button" className={control} onClick={download} disabled={!rows.length} aria-label={`Export ${title} as CSV`}><ArrowDownToLine size={15} />Export CSV</button>
    </div>
    {rows.length ? <div className="overflow-x-auto" tabIndex={0} aria-label={`${title}, scroll for more columns`}>
      <table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">{title}</caption>
        <thead className="bg-surface-container-lowest"><tr>{columns.map((column, index) => <th key={column.label} scope="col" aria-sort={sort?.index === index ? sort.ascending ? 'ascending' : 'descending' : 'none'} className={`px-4 py-2 text-xs font-medium text-fog-muted ${column.numeric ? 'text-right' : ''}`}>
          <button type="button" className="focus-ring min-h-11 rounded text-left" onClick={() => { setSort({ index, ascending: sort?.index === index ? !sort.ascending : !column.numeric }); setPage(0); }}>{column.label}{sort?.index === index ? sort.ascending ? ' ↑' : ' ↓' : ''}</button>
        </th>)}</tr></thead>
        <tbody className="divide-y divide-surgical-steel">{ordered.slice(current * 20, current * 20 + 20).map(row => <tr key={row.id} className="transition hover:bg-surface-container-low">{row.values.map((value, index) => <td key={index} className={`px-4 py-4 align-top ${columns[index].numeric ? 'whitespace-nowrap text-right font-mono tabular-nums' : ''} ${index === 0 ? 'font-medium text-white' : 'text-on-surface-variant'}`}>
          {index === 0 && row.detail ? <details><summary className="focus-ring min-h-6 cursor-pointer rounded leading-6">{value}</summary><div className="mt-3 min-w-48 max-w-sm text-xs font-normal leading-6 text-fog-muted">{row.detail}</div></details> : typeof value === 'number' ? columns[index].format?.(value) ?? value.toLocaleString() : value ?? '—'}
        </td>)}</tr>)}</tbody>
      </table>
    </div> : <div className="grid min-h-52 place-items-center p-6 text-center"><div><Search size={24} className="mx-auto text-fog-muted" /><h3 className="mt-3 font-semibold text-white">No matching records</h3><p className="mt-2 text-sm text-fog-muted">Change the period or clear a filter to see more.</p></div></div>}
    <footer className="flex items-center justify-between border-t border-surgical-steel px-4 py-3"><p className="text-xs text-fog-muted">Page {current + 1} of {pages} · 20 per page</p><div className="flex gap-2"><button type="button" className={control} disabled={current === 0} aria-label={`Previous ${title} page`} onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></button><button type="button" className={control} disabled={current + 1 >= pages} aria-label={`Next ${title} page`} onClick={() => setPage(current + 1)}><ChevronRight size={16} /></button></div></footer>
  </div>;
}
