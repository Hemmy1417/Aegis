"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { OUTCOME_LABEL } from "@/lib/config";
import { getLatest, genFromWei, type Deal } from "@/lib/aegis";

export default function ResolvedPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLatest(24)
      .then(setDeals)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative overflow-hidden">
      <div className="orb orb-rose" style={{ width: 440, height: 440, top: -120, left: "6%" }} />
      <div className="mx-auto max-w-4xl px-5 py-14 relative">
        <p className="eyebrow">Public ledger</p>
        <h1 className="display text-4xl sm:text-5xl mt-2">Resolved deals</h1>
        <p className="mt-3 text-body max-w-xl">
          Every settlement is on-chain and auditable. Here&apos;s how real deals — and disputes —
          were ruled and paid out.
        </p>

        <div className="mt-10">
          <p className="eyebrow">{loading ? "Loading…" : `${deals.length} settled`}</p>
          {deals.length === 0 && !loading ? (
            <div className="card p-10 mt-3 text-center text-body">No settled deals yet.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {deals.map((d) => {
                const r = d.ruling;
                return (
                  <Link key={d.id} href={`/deal/${d.id}`} className="card card-hover p-6 block">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <span className="display text-2xl text-ink">{genFromWei(d.amount)} GEN</span>
                        {r && (
                          <span className="ml-3 text-body">
                            → {OUTCOME_LABEL[r.outcome] ?? r.outcome}
                            {r.outcome === "SPLIT" && ` (${r.freelancer_pct}/${100 - r.freelancer_pct})`}
                          </span>
                        )}
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                    <p className="mt-2 text-[0.95rem] text-muted line-clamp-2">{d.terms}</p>
                    {r?.reasons?.[0] && (
                      <p className="mt-3 text-[0.9rem] text-body border-l-2 border-hairline-strong pl-3">
                        “{r.reasons[0]}”
                        {d.appealed && <span className="badge ml-2">appealed</span>}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
