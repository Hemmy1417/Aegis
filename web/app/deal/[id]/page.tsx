"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { StatusBadge } from "@/components/StatusBadge";
import { SpecLock } from "@/components/SpecLock";
import { OUTCOME_LABEL, explorerTxUrl } from "@/lib/config";
import {
  getDeal, getAppealBond, claimDeal, submitDeliverable, approve, dispute, submitCase, resolve, appeal, finalize, cancel,
  genFromWei, type Deal,
} from "@/lib/aegis";

function short(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

// Human-readable countdown for an enforced on-chain window (seconds of real time remaining).
function fmtUntil(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

export default function DealPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { address, client } = useWallet();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [uri, setUri] = useState("");
  const [statement, setStatement] = useState("");
  const [bond, setBond] = useState<bigint>(0n);

  const load = useCallback(async () => {
    try {
      const d = await getDeal(id);
      setDeal(d);
      if (d && (d.status === "RULED" || d.status === "NEEDS_REVIEW") && !d.appealed) {
        getAppealBond(id).then(setBond).catch(() => setBond(0n));
      }
    } catch {
      setDeal(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const me = address.toLowerCase();
  const isClient = !!deal && me === deal.client.toLowerCase();
  const isFreelancer = !!deal && !!deal.freelancer && me === deal.freelancer.toLowerCase();
  const isParty = isClient || isFreelancer;
  const isOpen = deal?.status === "OPEN";

  async function run(label: string, fn: () => Promise<string>) {
    if (!client) return;
    setError("");
    setTxHash("");
    setBusy(label);
    try {
      const hash = await fn();
      setTxHash(hash);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <p className="mx-auto max-w-3xl px-5 py-24 text-body flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-ink pulse-soft" /> Reading the contract…
      </p>
    );
  }
  if (!deal) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="display text-3xl">Deal not found</h1>
        <Link href="/dashboard" className="ink-pill mt-6">Back to dashboard</Link>
      </div>
    );
  }

  const s = deal.status;
  const myCase = isClient ? deal.client_case : isFreelancer ? deal.freelancer_case : "";
  const mySealed = !!myCase;
  const bothCasesIn = !!deal.client_case && !!deal.freelancer_case;
  // enforced windows — client clock is advisory; the contract re-fetches the real
  // clock to enforce both, so this only mirrors what the chain will accept
  const nowSec = Math.floor(Date.now() / 1000);
  const respondBy = deal.respond_by_epoch ?? 0;
  const respondPast = respondBy > 0 && nowSec >= respondBy;
  const appealDeadline = deal.appeal_open_until_epoch ?? 0;
  const appealPast = appealDeadline > 0 && nowSec >= appealDeadline;
  const canResolve = bothCasesIn || respondPast;   // one-sided only after the window
  const r = deal.ruling;
  const isResolver = !!deal.resolver && me === deal.resolver.toLowerCase();
  const bondLabel = genFromWei(bond.toString());

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <Link href="/dashboard" className="eyebrow hover:text-ink">← Dashboard</Link>

      {/* header */}
      <div className="mt-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Deal {deal.id}</p>
          <h1 className="display text-4xl mt-2">{genFromWei(deal.amount)} GEN</h1>
        </div>
        <StatusBadge status={s} />
      </div>

      {/* parties + terms */}
      <div className="card p-7 mt-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={`Client${isClient ? " · you" : ""}`} value={short(deal.client)} mono href={`/u/${deal.client}`} />
          <Field label={`Freelancer${isFreelancer ? " · you" : ""}`} value={deal.freelancer ? short(deal.freelancer) : "Unclaimed"} mono={!!deal.freelancer} href={deal.freelancer ? `/u/${deal.freelancer}` : undefined} />
        </div>
        <div>
          <p className="eyebrow">Terms</p>
          <p className="mt-1.5 text-body whitespace-pre-wrap">{deal.terms}</p>
          <div className="mt-3">
            <SpecLock terms={deal.terms} />
          </div>
        </div>
        {deal.deliverable_uri && (
          <div>
            <p className="eyebrow">Deliverable</p>
            <a href={deal.deliverable_uri} target="_blank" rel="noreferrer" className="mt-1 inline-block text-ink underline underline-offset-4 break-all">
              {deal.deliverable_uri}
            </a>
          </div>
        )}
      </div>

      {/* the two cases, if disputed */}
      {(deal.client_case || deal.freelancer_case) && (
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <CaseCard label="Client's case" body={deal.client_case} />
          <CaseCard label="Freelancer's case" body={deal.freelancer_case} />
        </div>
      )}

      {/* ruling card */}
      {r && (
        <div className="card p-7 mt-4 relative overflow-hidden">
          <div className="orb orb-lavender" style={{ width: 240, height: 240, top: -60, right: -40, opacity: 0.3 }} />
          <p className="eyebrow relative">
            AI ruling{deal.appealed ? (deal.appeal_moved ? " · appealed · revised" : " · appealed · upheld") : ""}
            {deal.resolver ? ` · resolved by ${short(deal.resolver)}` : ""}
          </p>
          <div className="mt-2 flex items-baseline gap-3 relative flex-wrap">
            <h2 className="display text-3xl">{OUTCOME_LABEL[r.outcome] ?? r.outcome}</h2>
            <span className="text-body">freelancer {r.freelancer_pct}% · client {100 - r.freelancer_pct}%</span>
            <span className="badge">{r.confidence} confidence</span>
          </div>
          {r.reasons?.length > 0 && (
            <ul className="mt-4 space-y-1.5 relative">
              {r.reasons.map((reason, i) => (
                <li key={i} className="text-[0.95rem] text-body flex gap-2">
                  <span className="text-ink">·</span>
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* open job: claim (visitors) or withdraw (client) */}
      {isOpen && (
        <div className="card p-7 mt-4">
          {isClient ? (
            <>
              <h2 className="text-[1.15rem] font-medium text-ink">Your open job</h2>
              <p className="mt-2 text-body">It&apos;s live on the job board, awaiting a freelancer. You can withdraw it while it&apos;s unclaimed and get refunded.</p>
              <button onClick={() => run("cancel", () => cancel(client, id))} disabled={!!busy} className="btn-outline mt-4">
                {busy === "cancel" ? "Withdrawing…" : "Withdraw job & refund"}
              </button>
            </>
          ) : address ? (
            <>
              <h2 className="text-[1.15rem] font-medium text-ink">Claim this job</h2>
              <p className="mt-2 text-body">The <strong className="text-ink">{genFromWei(deal.amount)} GEN</strong> payment is already locked in escrow. Claim it to become the assigned freelancer.</p>
              <button onClick={() => run("claim", () => claimDeal(client, id))} disabled={!!busy} className="ink-pill mt-4">
                {busy === "claim" ? "Claiming…" : "Claim this job"}
              </button>
            </>
          ) : (
            <p className="text-body">Connect a wallet to claim this job.</p>
          )}
          {error && <p className="mt-4 text-sm text-error break-words">{error}</p>}
        </div>
      )}

      {/* actions */}
      {isParty && !isOpen && s !== "SETTLED" && s !== "CANCELLED" && (
        <div className="card p-7 mt-4">
          <h2 className="text-[1.15rem] font-medium text-ink">Actions</h2>

          {/* freelancer: submit deliverable */}
          {isFreelancer && (s === "CREATED" || s === "DELIVERED") && (
            <div className="mt-4">
              <label className="eyebrow">Submit / update deliverable (a public URL, e.g. a GitHub link)</label>
              <div className="mt-2 flex gap-2 flex-col sm:flex-row">
                <input value={uri} onChange={(e) => setUri(e.target.value)} placeholder="https://…" className="field font-mono text-sm" />
                <button onClick={() => run("deliver", () => submitDeliverable(client, id, uri))} disabled={!uri.trim() || !!busy} className="ink-pill whitespace-nowrap">
                  {busy === "deliver" ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          )}

          {/* client: approve */}
          {isClient && (s === "CREATED" || s === "DELIVERED") && (
            <button onClick={() => run("approve", () => approve(client, id))} disabled={!!busy} className="ink-pill mt-4 mr-2">
              {busy === "approve" ? "Approving…" : "Approve & pay freelancer"}
            </button>
          )}

          {/* either: dispute */}
          {(s === "CREATED" || s === "DELIVERED") && (
            <button onClick={() => run("dispute", () => dispute(client, id))} disabled={!!busy} className="btn-outline mt-4">
              {busy === "dispute" ? "Opening…" : "Dispute this deal"}
            </button>
          )}

          {/* disputed: submit case (sealed — one shot) */}
          {s === "DISPUTED" && (
            <div className="mt-4">
              {mySealed ? (
                <>
                  <label className="eyebrow">Your case · sealed</label>
                  <p className="mt-2 text-[0.95rem] text-body whitespace-pre-wrap border-l border-hairline pl-3">{myCase}</p>
                  <p className="mt-2 text-xs text-muted">Submitted and locked — statements are sealed so neither side can rewrite after reading the other&apos;s.</p>
                </>
              ) : (
                <>
                  <label className="eyebrow">Your case · one submission, then sealed</label>
                  <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={4} placeholder="Explain your side, referencing the agreed terms. You cannot edit this once submitted." className="field mt-2 resize-y" />
                  <button onClick={() => run("case", () => submitCase(client, id, statement))} disabled={!statement.trim() || !!busy} className="ink-pill mt-3">
                    {busy === "case" ? "Sealing…" : "Submit & seal my case"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* disputed: resolve when both in, or one-sided after the response window */}
          {s === "DISPUTED" && (
            <div className="mt-5 pt-4 border-t border-hairline">
              <button onClick={() => run("resolve", () => resolve(client, id))} disabled={!canResolve || !!busy} className="ink-pill">
                {busy === "resolve" ? "Arbitrating…" : bothCasesIn ? "Resolve (run the AI arbitrator)" : "Resolve on the filed case"}
              </button>
              {bothCasesIn ? null : !respondPast ? (
                <p className="mt-2 text-xs text-muted">
                  ⏳ Contract-enforced response window: the other party has
                  {respondBy > 0 ? ` ${fmtUntil(respondBy - nowSec)} of real time left` : " a real window"} to
                  file their case. Only after it passes can the arbitrator rule on one side&apos;s case — real
                  minutes no one can snipe shut. A response filed in time is heard.
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  ⏰ Response window passed — the other party did not file a case in time. The arbitrator will rule
                  on the submitted case, weighing the silent party&apos;s default against them.
                </p>
              )}
            </div>
          )}

          {/* ruled: finalize + appeal */}
          {s === "RULED" && (
            <div className="mt-4">
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => run("finalize", () => finalize(client, id))} disabled={!!busy || (isResolver && !deal.appealed)} className="ink-pill">
                  {busy === "finalize" ? "Settling…" : "Finalize & release funds"}
                </button>
                {!deal.appealed && (
                  <button onClick={() => run("appeal", () => appeal(client, id, bond))} disabled={!!busy || bond === 0n} className="btn-outline">
                    {busy === "appeal" ? "Re-arbitrating…" : `Appeal · bond ${bondLabel} GEN`}
                  </button>
                )}
              </div>
              {!deal.appealed && appealDeadline > 0 && !appealPast && (
                <p className="mt-2 text-xs text-muted">
                  ⏳ Contract-enforced appeal window: finalizing is refused for {fmtUntil(appealDeadline - nowSec)} more of
                  real time (until the fetched clock clears epoch {appealDeadline}), so the losing side gets a genuine chance
                  to appeal before the escrow is released — no wallet can snipe it shut.
                </p>
              )}
              {isResolver && !deal.appealed && (
                <p className="mt-2 text-xs text-muted">You triggered this ruling, so the other party must finalize it — that&apos;s the appeal window.</p>
              )}
              {!deal.appealed && (
                <p className="mt-2 text-xs text-muted">Appeal bond ({bondLabel} GEN) returns if the re-review moves the ruling; if it&apos;s upheld the bond is paid to the other party for the delay.</p>
              )}
            </div>
          )}

          {/* needs review: appeal + cancel */}
          {s === "NEEDS_REVIEW" && !deal.appealed && (
            <div className="mt-4">
              <button onClick={() => run("appeal", () => appeal(client, id, bond))} disabled={!!busy || bond === 0n} className="ink-pill">
                {busy === "appeal" ? "Re-arbitrating…" : `Appeal — ask for another review · bond ${bondLabel} GEN`}
              </button>
              <p className="mt-2 text-xs text-muted">Or both parties cancel below to void the deal and refund the escrow (any appeal bond returns).</p>
            </div>
          )}

          {/* cancel (mutual) */}
          {(s === "CREATED" || s === "DELIVERED" || s === "DISPUTED" || s === "NEEDS_REVIEW") && (
            <div className="mt-5 pt-4 border-t border-hairline">
              <button onClick={() => run("cancel", () => cancel(client, id))} disabled={!!busy} className="btn-outline text-xs">
                {busy === "cancel" ? "Recording…" : "Cancel (refunds client when both agree)"}
              </button>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-error break-words">{error}</p>}
        </div>
      )}

      {!isParty && !isOpen && address && (
        <p className="mt-4 text-sm text-muted">You&apos;re viewing this deal as an observer — only the client and freelancer can act on it.</p>
      )}

      {/* tx receipt */}
      {txHash && (
        <div className="card p-5 mt-4">
          <p className="eyebrow">Last transaction</p>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <code className="font-mono text-xs text-body break-all">{txHash}</code>
            {explorerTxUrl(txHash) && (
              <a href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer" className="text-xs text-ink underline underline-offset-4 whitespace-nowrap">
                View on explorer ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  const cls = `mt-1 text-ink ${mono ? "font-mono text-sm" : ""}`;
  return (
    <div>
      <p className="eyebrow">{label}</p>
      {href ? (
        <Link href={href} className={`${cls} block hover:underline underline-offset-4`}>{value}</Link>
      ) : (
        <p className={cls}>{value}</p>
      )}
    </div>
  );
}

function CaseCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="card p-5">
      <p className="eyebrow">{label}</p>
      {body ? (
        <p className="mt-2 text-[0.95rem] text-body whitespace-pre-wrap">{body}</p>
      ) : (
        <p className="mt-2 text-[0.95rem] text-muted-soft italic">Not submitted yet.</p>
      )}
    </div>
  );
}
