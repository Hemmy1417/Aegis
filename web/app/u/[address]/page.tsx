"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAddress } from "viem";
import { StatusBadge } from "@/components/StatusBadge";
import { getReputation, getDealsByAddress, genFromWei, type Reputation, type Deal } from "@/lib/aegis";

function short(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

const TIER_TONE: Record<string, string> = {
  New: "!bg-surface-strong !text-muted",
  Building: "!bg-sky-100 !text-sky-800",
  Reliable: "!bg-emerald-100 !text-emerald-800",
  "Highly Reliable": "!bg-emerald-100 !text-emerald-800",
};

export default function ProfilePage() {
  const params = useParams<{ address: string }>();
  // Reputation/deals are keyed by the EIP-55 checksummed address on-chain; normalize a
  // shared/typed link (which may be lowercase) so it matches, like Credence learned.
  const address = useMemo(() => {
    try {
      return getAddress(params.address);
    } catch {
      return params.address;
    }
  }, [params.address]);
  const [rep, setRep] = useState<Reputation | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getReputation(address), getDealsByAddress(address)])
      .then(([r, d]) => {
        setRep(r);
        setDeals(d.sort((a, b) => b.created_seq - a.created_seq));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  const settled = deals.filter((d) => d.status === "SETTLED").length;

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <Link href="/resolved" className="eyebrow hover:text-ink">← Public ledger</Link>

      <div className="card p-8 mt-6 relative overflow-hidden">
        <div className="orb orb-sky" style={{ width: 260, height: 260, top: -80, right: -40, opacity: 0.3 }} />
        <p className="eyebrow relative">Reputation</p>
        <div className="mt-3 flex items-end gap-4 relative flex-wrap">
          <span className="display text-6xl text-ink">{rep ? rep.score : "—"}</span>
          {rep && <span className={`badge ${TIER_TONE[rep.tier] ?? ""}`}>{rep.tier}</span>}
        </div>
        <p className="mt-3 font-mono text-sm text-muted break-all relative">{address}</p>

        <div className="grid grid-cols-3 gap-4 mt-6 relative">
          <Mini label="Completed" value={rep ? rep.completed : 0} />
          <Mini label="Disputes won" value={rep ? rep.dispute_wins : 0} />
          <Mini label="Disputes lost" value={rep ? rep.dispute_losses : 0} />
        </div>
      </div>

      <div className="mt-8">
        <p className="eyebrow">{loading ? "Loading…" : `Track record · ${settled} settled of ${deals.length}`}</p>
        {deals.length === 0 && !loading ? (
          <p className="card p-8 mt-3 text-center text-body">No deals yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {deals.map((d) => {
              const role = d.client.toLowerCase() === address.toLowerCase() ? "Client" : "Freelancer";
              return (
                <Link key={d.id} href={`/deal/${d.id}`} className="card card-hover p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
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

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="display text-3xl text-ink">{value}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
    </div>
  );
}
