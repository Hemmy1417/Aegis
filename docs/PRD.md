# Aegis — Product Requirements Document (v1.0)

> **AI-arbitrated freelance escrow on GenLayer.** Lock payment for a job in escrow; if there's a
> dispute, an AI-validator panel reads the agreed terms and both sides' cases and rules how the
> money splits — trustlessly, on-chain.

## 1. Problem
Freelance escrow today needs a trusted middleman (platforms taking 10–20%, or lawyers) to answer
the one question that matters: *"did they actually deliver what was agreed?"* A normal smart
contract can't read a plain-English brief or judge whether work meets it — so today you either
trust a centralized arbiter, or you skip escrow and trust the other person. Aegis removes the
middleman: the arbiter is an AI-validator panel whose ruling is binding and moves the funds.

## 2. Target users
- Freelancers + clients who want trustless escrow without a platform cut.
- DAOs / communities paying contributors who want neutral dispute resolution.
- Anyone doing a two-party deal with plain-English terms.

## 3. Why GenLayer (the core)
Resolving a dispute needs three things **at once**: (1) *interpret* plain-English terms, (2) *weigh*
both parties' arguments and evidence, (3) *move real funds* on the result. A normal contract can't
judge; a normal backend can't settle escrow trustlessly. GenLayer's AI-validator consensus does
both in the same place — and it can fetch a live deliverable (e.g. a GitHub repo) to check the work.

## 4. Core GenLayer decision (the verdict)
Given the agreed **terms** + both parties' **written statements** (+ optional **deliverable URL**),
the arbitrator returns a structured ruling:
`outcome ∈ {RELEASE→freelancer, REFUND→client, SPLIT, UNCLEAR}`, a `freelancer_pct (0–100)`,
`reasons[]`, `risk_flags[]`, and `confidence (LOW|MEDIUM|HIGH)`.

## 5. User flows
1. **Create job** — client writes terms (plain English), sets amount + freelancer address, and
   funds the escrow (payable). [optionally requires a Credence-verified identity — see §7.D]
2. **Deliver** — freelancer submits work (optionally a GitHub deliverable URL).
3. **Happy path** — client approves → escrow released to freelancer.
4. **Dispute path** — either party disputes → both submit a written case → anyone calls `resolve`
   → AI arbitrator rules → contract settles the escrow (release / refund / split).
5. **Confidence gate** — if the ruling is UNCLEAR or LOW confidence, the deal parks in
   `NEEDS_REVIEW` instead of auto-paying (see §7.A).
6. **Appeal** — the losing party may appeal once → a fresh, larger panel re-rules (see §7.B).

## 6. MVP features (Tier 1 — core)
- Create + fund escrow (payable), with plain-English terms.
- Deliver / approve happy-path release.
- Dispute → both submit cases → AI ruling → settlement (release / refund / split).
- Mutual cancellation (both agree → refund client).
- Read views: `get_deal`, `get_ruling`, `get_deals_by_address`, `get_reputation`, `get_stats`,
  `get_latest`.
- Frontend: create job, fund, dispute flow, ruling card, deal registry, shareable deal page.

## 7. Approved high-impact features (Tier 2)
- **A. Confidence-gated settlement.** If `confidence == LOW` or `outcome == UNCLEAR`, the contract
  parks the escrow in `NEEDS_REVIEW` rather than settling, and the UI explains why. Honest
  ambiguity handling.
- **B. Appeal (bigger panel).** After a ruling, the losing party can call `appeal` once → judgement
  re-runs with more validators / a stricter equivalence principle → final settlement.
- **C. GitHub deliverable check.** Freelancer can attach a GitHub repo/PR; the arbitrator fetches it
  (`gl.nondet.web.render`) and weighs the actual work against the terms — not just written claims.
  GitHub is anonymously fetchable (the reliability lesson from Credence).
- **D. Reputation + Credence tie-in.** Each settlement updates an on-chain fairness record per
  wallet (an Aegis trust score). Opening a deal can require a **Credence-verified identity**,
  linking the two dApps into one ecosystem.

## 8. Tier 3 polish (planned)
Public deal registry · shareable deal page · visual deal-status timeline · **demo mode** (one-click
sample dispute a judge can resolve instantly).

## 9. Out of scope (MVP)
Milestones / staged escrow · multi-round appeals (one appeal only) · auto-release timeout
(*GenVM has no wall-clock; a true deadline needs a keeper/workaround — deferred*) · dispute bonds ·
fiat · file uploads · private/commit-reveal cases.

## 10. Evidence / submission types
Plain-English **terms** + each party's **written statement** + optional **public deliverable URL**
(GitHub recommended). Text-first by design, so we sidestep the auth-walled-fetch reliability problem.

## 11. Ruling / result structure (stored on-chain)
```json
{
  "outcome": "RELEASE | REFUND | SPLIT | UNCLEAR",
  "freelancer_pct": 0,
  "reasons": ["..."],
  "risk_flags": ["..."],
  "confidence": "LOW | MEDIUM | HIGH"
}
```

## 12. Risks & limitations
- **Value-transfer API** — exact `emit_transfer` / `.payable` signatures pinned at contract-build
  time against the SDK (internal-ledger + `withdraw()` fallback ready).
- **Ambiguous disputes** — handled by the confidence gate (NEEDS_REVIEW) rather than a bad payout.
- **Both must submit** — if one party never submits a case, the deal can stall (no clock for a
  timeout). MVP documents this; a keeper/timeout is post-MVP.
- **Credence gate on-chain** — cross-contract reads may be limited; MVP enforces the identity gate
  in the frontend (+ shows the Credence badge); on-chain enforcement is a stretch.
- **LLM variance** — mitigated by validator consensus + a stable JSON equivalence principle.

## 13. Demo & submission
One flow that reaches an AI ruling which **moves escrowed GEN** on Studionet. README (network, RPC,
contract address, explorer), demo video, screenshots, honest limitations, roadmap.

## 14. Success criteria
A reviewer can, in ~90 seconds: create + fund a job, raise a dispute, submit both sides, trigger the
AI ruling, and watch the escrow settle (release / refund / split) on-chain — with the ruling's
reasons + confidence shown transparently.
