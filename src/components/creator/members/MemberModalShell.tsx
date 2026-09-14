"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

const FOCUSABLE = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

export function MemberModalShell({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const firstFocus = panel?.querySelector<HTMLElement>("[data-autofocus]");
    if (firstFocus) firstFocus.focus(); else panel?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => !item.hidden);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previousFocus.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-scrim sm:items-center sm:justify-center sm:p-5" onMouseDown={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="member-modal-title" aria-describedby={description ? "member-modal-description" : undefined} tabIndex={-1} onMouseDown={(event) => event.stopPropagation()} className={`flex h-[100svh] max-h-[100svh] w-full flex-col overflow-hidden border border-surgical-steel bg-monolith-surface pb-[env(safe-area-inset-bottom)] shadow-[0_28px_80px_-28px_rgba(0,0,0,0.95)] sm:h-auto sm:min-h-0 sm:max-h-[88vh] sm:rounded-xl sm:pb-0 ${wide ? "sm:max-w-4xl" : "sm:max-w-2xl"}`}>
        <header className="flex shrink-0 items-start justify-between gap-6 border-b border-surgical-steel px-5 py-5 sm:px-7">
          <div><h2 id="member-modal-title" className="font-headline text-xl font-semibold tracking-[-0.02em] text-text-strong">{title}</h2>{description && <p id="member-modal-description" className="mt-1 max-w-[65ch] text-sm leading-6 text-on-surface-variant">{description}</p>}</div>
          <button type="button" data-autofocus onClick={onClose} aria-label="Close" className="focus-ring grid size-11 shrink-0 place-items-center rounded-lg text-fog-muted transition hover:bg-surface-container-high hover:text-text-strong"><X size={19} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
