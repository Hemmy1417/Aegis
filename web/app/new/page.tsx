"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { createDeal, getDealsByAddress, genToWei } from "@/lib/aegis";

type Mode = "open" | "assign";

export default function NewDealPage() {
  const router = useRouter();
  const { address, client, connect } = useWallet();

  const [mode, setMode] = useState<Mode>("open");
  const [freelancer, setFreelancer] = useState("");
  const [amount, setAmount] = useState("");
  const [overview, setOverview] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [criteria, setCriteria] = useState("");
  const [outOfScope, setOutOfScope] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const addrOk = /^0x[a-fA-F0-9]{40}$/.test(freelancer.trim());
  const amtOk = Number(amount) > 0;
  const termsOk = overview.trim().length > 0;

  function composeTerms() {
    let t = overview.trim();
    if (deliverables.trim()) t += `\n\nDeliverables:\n${deliverables.trim()}`;
    if (criteria.trim()) t += `\n\nAcceptance criteria:\n${criteria.trim()}`;
    if (outOfScope.trim()) t += `\n\nOut of scope:\n${outOfScope.trim()}`;
    return t;
  }
  const notSelf = address && freelancer.trim().toLowerCase() !== address.toLowerCase();
  const freelancerOk = mode === "open" ? true : addrOk && notSelf;
  const valid = freelancerOk && amtOk && termsOk;

  async function onCreate() {
    if (!client || !valid) return;
    setError("");
    setBusy(true);
    try {
      const fr = mode === "open" ? "" : freelancer.trim();
      await createDeal(client, fr, composeTerms(), genToWei(amount));
      const mine = await getDealsByAddress(address);
      const newest = mine.sort((a, b) => b.created_seq - a.created_seq)[0];
      router.push(newest ? `/deal/${newest.id}` : "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="display text-4xl">Post a job</h1>
        <p className="mt-4 text-body">Connect your wallet to fund an escrow. Aegis works with MetaMask, Rabby, or any browser wallet — gas is sponsored on Studionet.</p>
        <button onClick={() => connect().catch(() => {})} className="ink-pill mt-7">Connect wallet</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <Link href="/dashboard" className="eyebrow hover:text-ink">← Dashboard</Link>
      <h1 className="display text-4xl sm:text-5xl mt-5">Post a job</h1>
      <p className="mt-3 text-body">
        You&apos;re the <strong className="text-ink">client</strong>. Lock the payment in escrow now;
        the freelancer is paid when you approve — or by an AI ruling if it&apos;s ever disputed.
      </p>

      {/* mode toggle */}
      <div className="mt-7 grid grid-cols-2 gap-2 p-1 bg-surface-strong rounded-xl">
        <button
          onClick={() => setMode("open")}
          className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${mode === "open" ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          Open to anyone
        </button>
        <button
          onClick={() => setMode("assign")}
          className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${mode === "assign" ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          Assign directly
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {mode === "open"
          ? "Posts to the public job board — any freelancer can claim it."
          : "Assigns the job to one freelancer's wallet address."}
      </p>

      <div className="card p-7 mt-5 space-y-6">
        {mode === "assign" && (
          <div>
            <label className="eyebrow">Freelancer wallet</label>
            <input
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              placeholder="0x… the freelancer's address"
              className="field mt-2 font-mono text-sm"
            />
            {freelancer && !addrOk && <p className="mt-1.5 text-xs text-error">That doesn&apos;t look like a valid address.</p>}
            {freelancer && addrOk && !notSelf && <p className="mt-1.5 text-xs text-error">The freelancer must be a different wallet than you.</p>}
          </div>
        )}

        <div>
          <label className="eyebrow">Escrow amount (GEN)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="e.g. 2"
            inputMode="decimal"
            className="field mt-2"
          />
        </div>

        <div>
          <label className="eyebrow">Overview</label>
          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            placeholder="What's the job, in a sentence or two?"
            rows={3}
            className="field mt-2 resize-y"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="eyebrow">Deliverables</label>
            <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} placeholder="- 3 logo concepts&#10;- Vector source files" rows={3} className="field mt-2 resize-y text-sm" />
          </div>
          <div>
            <label className="eyebrow">Acceptance criteria</label>
            <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="- Delivered by Friday&#10;- PNG + SVG formats" rows={3} className="field mt-2 resize-y text-sm" />
          </div>
        </div>
        <div>
          <label className="eyebrow">Out of scope (optional)</label>
          <textarea value={outOfScope} onChange={(e) => setOutOfScope(e.target.value)} placeholder="Anything explicitly NOT included — protects both sides from scope creep." rows={2} className="field mt-2 resize-y text-sm" />
        </div>
        <p className="text-xs text-muted">
          These compose into the locked, on-chain terms. The clearer the criteria, the sharper an AI ruling — it judges the work against this exact checklist.
        </p>

        {error && <p className="text-sm text-error break-words">{error}</p>}

        <button onClick={onCreate} disabled={!valid || busy} className="ink-pill w-full">
          {busy ? "Locking escrow…" : `Lock ${amtOk ? amount : ""} GEN ${mode === "open" ? "& post job" : "in escrow"}`}
        </button>
        <p className="text-xs text-muted text-center">Gas is sponsored on Studionet — you only send the escrow amount.</p>
      </div>
    </div>
  );
}
