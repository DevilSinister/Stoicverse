"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type NoticeContextValue = {
  notice: (message: string) => void;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

const TOAST_MS = 2600;

/**
 * One polite live region and one toast for every settings shell, so nested
 * sections can announce "Saved." without each owning a timer.
 */
export function SettingsNoticeProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const notice = useCallback((next: string) => {
    setMessage(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setMessage(null);
      timer.current = null;
    }, TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ notice }), [notice]);

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="sr-only">
        {message}
      </div>
      {message && (
        <div
          role="presentation"
          className="fixed bottom-4 left-1/2 z-[90] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-surgical-steel bg-monolith-surface px-4 py-3 text-sm text-on-surface shadow-[0_18px_48px_-24px_rgba(0,0,0,0.9)]"
        >
          {message}
        </div>
      )}
    </NoticeContext.Provider>
  );
}

export function useSettingsNotice() {
  const context = useContext(NoticeContext);
  if (!context) {
    throw new Error("useSettingsNotice must be used inside SettingsNoticeProvider.");
  }
  return context.notice;
}
