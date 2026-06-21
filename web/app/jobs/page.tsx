"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { SpecLock } from "@/components/SpecLock";
import { getOpenDeals, claimDeal, genFromWei, type Deal } from "@/lib/aegis";

function short(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export default function JobsPage() {
  const router = useRouter();
  const { address, client, connect } = useWallet();
  const [jobs, setJobs] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJobs(await getOpenDeals(36));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onClaim(id: string) {
    if (!client) {
      connect().catch(() => {});
      return;
    }
    setError("");
    setClaiming(id);
    try {
      await claimDeal(client, id);
      router.push(`/deal/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setClaiming("");
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div className="orb orb-mint" style={{ width: 460, height: 460, top: -140, right: "10%" }} />
      <div className="mx-auto max-w-5xl px-5 py-14 relative">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow">Find work</p>
            <h1 className="display text-4xl sm:text-5xl mt-2">Open jobs</h1>
            <p className="mt-3 text-body max-w-xl">
              Each job&apos;s payment is already locked in escrow. Claim one to take it on — if there&apos;s
              ever a dispute, an AI panel decides fairly.
            </p>
          </div>
          <Link href="/new" className="btn-outline">Post a job</Link>
        </div>

        <div className="mt-10">
          <p className="eyebrow">{loading ? "Loading…" : `${jobs.length} open job${jobs.length === 1 ? "" : "s"}`}</p>
          {jobs.length === 0 && !loading ? (
            <div className="card p-10 mt-3 text-center">
              <p className="text-body">No open jobs right now.</p>
              <Link href="/new" className="ink-pill mt-5">Post the first one</Link>
            </div>
          ) : (
            <div className="mt-3 grid sm:grid-cols-2 gap-4">
              {jobs.map((j) => {
                const mine = address && j.client.toLowerCase() === address.toLowerCase();
                return (
                  <div key={j.id} className="card card-hover p-6 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="display text-2xl text-ink">{genFromWei(j.amount)} GEN</span>
                      <span className="badge">escrowed</span>
                    </div>
                    <p className="mt-3 text-body flex-1">{j.terms}</p>
                    <div className="mt-3"><SpecLock terms={j.terms} compact /></div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted font-mono">by {short(j.client)}</span>
                      {mine ? (
                        <Link href={`/deal/${j.id}`} className="btn-outline text-xs">Your job →</Link>
                      ) : (
                        <button
                          onClick={() => onClaim(j.id)}
                          disabled={claiming === j.id}
                          className="ink-pill text-sm"
                        >
                          {claiming === j.id ? "Claiming…" : address ? "Claim job" : "Connect to claim"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {error && <p className="mt-4 text-sm text-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
