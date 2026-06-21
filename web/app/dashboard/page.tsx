"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getDealsByAddress, getReputation, getStats, genFromWei,
  type Deal, type Reputation, type Stats,
} from "@/lib/aegis";

export default function DashboardPage() {
  const { address, connect } = useWallet();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [rep, setRep] = useState<Reputation | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [d, r, s] = await Promise.all([
        getDealsByAddress(address),
        getReputation(address),
        getStats(),
      ]);
      setDeals(d.sort((a, b) => b.created_seq - a.created_seq));
      setRep(r);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  if (!address) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="display text-4xl">Your dashboard</h1>
        <p className="mt-4 text-body">Connect your wallet to see your deals and reputation.</p>
        <button onClick={() => connect().catch(() => {})} className="ink-pill mt-7">Connect wallet</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="display text-4xl sm:text-5xl mt-2">Your deals</h1>
        </div>
        <Link href="/new" className="ink-pill">Start a deal</Link>
      </div>

      {/* reputation + stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <Stat label="Reputation" value={rep ? `${rep.score}` : "—"} sub={rep?.tier ?? ""} accent />
        <Stat label="Deals completed" value={rep ? `${rep.completed}` : "—"} />
        <Stat label="Disputes won" value={rep ? `${rep.dispute_wins}` : "—"} sub={rep ? `${rep.dispute_losses} lost` : ""} />
        <Stat label="Network deals" value={stats ? `${stats.total_deals}` : "—"} sub={stats ? `${stats.total_settled} settled` : ""} />
      </div>

      {/* deals list */}
      <div className="mt-10">
        <p className="eyebrow">{loading ? "Loading…" : `${deals.length} deal${deals.length === 1 ? "" : "s"}`}</p>
        {deals.length === 0 && !loading ? (
          <div className="card p-10 mt-3 text-center">
            <p className="text-body">No deals yet.</p>
            <Link href="/new" className="ink-pill mt-5">Start your first deal</Link>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {deals.map((d) => {
              const role = d.client.toLowerCase() === address.toLowerCase() ? "Client" : "Freelancer";
              return (
                <Link key={d.id} href={`/deal/${d.id}`} className="card card-hover p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink">{genFromWei(d.amount)} GEN</span>
                      <span className="badge">{role}</span>
                    </div>
                    <p className="mt-1 text-[0.9rem] text-muted truncate max-w-md">{d.terms}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <p className="eyebrow">{label}</p>
      <p className={`display mt-2 text-4xl ${accent ? "" : "text-ink"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
