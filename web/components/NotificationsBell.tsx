"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { getDealsByAddress } from "@/lib/aegis";
import { deriveNotices, actionCount, type Notice } from "@/lib/notifications";

export function NotificationsBell() {
  const { address } = useWallet();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!address) {
      setNotices([]);
      return;
    }
    try {
      setNotices(deriveNotices(await getDealsByAddress(address), address));
    } catch {
      /* reads degrade gracefully */
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!address) return null;
  const count = actionCount(notices);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="btn-outline !px-2.5 relative"
        aria-label={`Notifications${count ? ` (${count})` : ""}`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-[11px] font-medium text-white flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 card p-2 z-30 shadow-lg max-h-[70vh] overflow-auto">
          <div className="flex items-center justify-between px-2 py-2">
            <span className="eyebrow">Needs your attention</span>
            <button onClick={load} className="text-xs text-muted hover:text-ink" aria-label="Refresh">↻</button>
          </div>
          {notices.length === 0 ? (
            <p className="px-2 py-6 text-sm text-muted text-center">You&apos;re all caught up.</p>
          ) : (
            notices.map((n, i) => (
              <Link
                key={`${n.dealId}-${i}`}
                href={`/deal/${n.dealId}`}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-lg hover:bg-surface-strong transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${n.kind === "action" ? "bg-ink" : "bg-muted-soft"}`} />
                  <span className="text-sm font-medium text-ink">{n.title}</span>
                </div>
                <p className="mt-1 ml-3.5 text-xs text-muted">{n.detail}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
