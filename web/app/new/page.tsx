"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { createDeal, getDealsByAddress, genToWei } from "@/lib/aegis";

export default function NewDealPage() {
  const router = useRouter();
  const { address, client, connectBuiltIn } = useWallet();

  const [freelancer, setFreelancer] = useState("");
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const addrOk = /^0x[a-fA-F0-9]{40}$/.test(freelancer.trim());
  const amtOk = Number(amount) > 0;
  const termsOk = terms.trim().length > 0;
  const notSelf = address && freelancer.trim().toLowerCase() !== address.toLowerCase();
  const valid = addrOk && amtOk && termsOk && notSelf;

  async function onCreate() {
    if (!client || !valid) return;
    setError("");
    setBusy(true);
    try {
      await createDeal(client, freelancer.trim(), terms.trim(), genToWei(amount));
      // find the new deal id (latest for this address)
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
        <h1 className="display text-4xl">Start a deal</h1>
        <p className="mt-4 text-body">Connect a wallet to fund an escrow. The Instant Wallet is free and gas is sponsored on Studionet.</p>
        <button onClick={connectBuiltIn} className="ink-pill mt-7">⚡ Create instant wallet</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <Link href="/dashboard" className="eyebrow hover:text-ink">← Dashboard</Link>
      <h1 className="display text-4xl sm:text-5xl mt-5">Start a deal</h1>
      <p className="mt-3 text-body">
        You&apos;re the <strong className="text-ink">client</strong>. Define the work, set the
        payment, and lock it in escrow. The freelancer is paid when you approve — or by an AI ruling
        if it&apos;s ever disputed.
      </p>

      <div className="card p-7 mt-8 space-y-6">
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
          <label className="eyebrow">Job terms (plain English)</label>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Describe exactly what the freelancer must deliver to earn payment. The clearer the terms, the cleaner an arbitration ruling will be."
            rows={5}
            className="field mt-2 resize-y"
          />
          <p className="mt-1.5 text-xs text-muted">Tip: spell out scope, deliverables, and what &quot;done&quot; means — vague terms make disputes harder to judge.</p>
        </div>

        {error && <p className="text-sm text-error break-words">{error}</p>}

        <button onClick={onCreate} disabled={!valid || busy} className="ink-pill w-full">
          {busy ? "Locking escrow…" : `Lock ${amtOk ? amount : ""} GEN in escrow`}
        </button>
        <p className="text-xs text-muted text-center">Gas is sponsored on Studionet — you only send the escrow amount.</p>
      </div>
    </div>
  );
}
