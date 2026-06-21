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

  const me = address.toLowerCase();
  const asClient = deals.filter((d) => d.client.toLowerCase() === me);
  const asFreelancer = deals.filter((d) => d.freelancer && d.freelancer.toLowerCase() === me);

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

      {/* role-split deals */}
      {deals.length === 0 && !loading ? (
        <div className="card p-10 mt-10 text-center">
          <p className="text-body">No deals yet.</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link href="/new" className="ink-pill">Post a job</Link>
            <Link href="/jobs" className="btn-outline">Find work</Link>
          </div>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          <DealGroup
            title="Hiring (as client)"
            empty="You haven't posted any jobs."
            cta={{ href: "/new", label: "Post a job" }}
            deals={asClient}
          />
          <DealGroup
            title="Working (as freelancer)"
            empty="You haven't taken on any jobs."
            cta={{ href: "/jobs", label: "Find work" }}
            deals={asFreelancer}
          />
        </div>
      )}
    </div>
  );
}

function DealGroup({
  title, empty, cta, deals,
}: { title: string; empty: string; cta: { href: string; label: string }; deals: Deal[] }) {
  return (
    <section>
      <p className="eyebrow">{title} · {deals.length}</p>
      {deals.length === 0 ? (
        <div className="card p-6 mt-3 flex items-center justify-between gap-4">
          <p className="text-[0.95rem] text-muted">{empty}</p>
          <Link href={cta.href} className="btn-outline text-xs whitespace-nowrap">{cta.label}</Link>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {deals.map((d) => (
            <Link key={d.id} href={`/deal/${d.id}`} className="card card-hover p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="font-medium text-ink">{genFromWei(d.amount)} GEN</span>
                <p className="mt-1 text-[0.9rem] text-muted truncate max-w-md">{d.terms}</p>
              </div>
              <StatusBadge status={d.status} />
            </Link>
          ))}
        </div>
      )}
    </section>
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
