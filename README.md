# Aegis — AI-arbitrated freelance escrow on GenLayer

> Lock payment for a job in escrow. If there's a dispute, an AI-validator panel reads the agreed
> terms and both sides' cases and rules how the money splits — trustlessly, on-chain.

**Status:** 🟢 **Built and validated on Studionet — Phase 4 (judge-feedback) hardened.** The
Intelligent Contract (escrow + marketplace + AI arbitration + **enforced response & appeal windows** +
bonded appeals + reputation) is deployed with 36 direct-mode tests. The Next.js frontend is complete.

## Live demo
**https://aegis-safu.vercel.app** — live on Vercel, reading the contract on Studionet.

## Contract details
| Field | Value |
|---|---|
| Network | **Studionet** |
| RPC | `https://studio.genlayer.com/api` |
| Chain ID | `61999` |
| Contract address | `0xe534039b6BD020e6605371ABF8378dC00f634ad9` |
| Explorer | https://explorer-studio.genlayer.com (`/tx/<hash>`) |

> **GenVM lessons baked in (July 2026).** Wallet payouts go through an empty
> `@gl.evm.contract_interface` proxy (`emit_transfer(on="finalized")` — a GenVM call at a plain
> wallet strands the value). An `Address`-typed field is never re-wrapped.

## Phase 4 — judge-feedback hardening (why this isn't a demo)

The arbitration decides where real money goes, so every input and lever it touches is now
tamper-resistant:

- **Sealed cases.** Each party's statement is immutable once submitted — no reading the opponent's
  brief and rewriting yours. The last-mover advantage is gone.
- **Enforced response window (real wall-clock).** Raising a dispute stamps a hard deadline: the
  contract fetches the current UTC time under validator consensus — from two probe-verified sources,
  Cloudflare's edge clock and Ethereum's own latest block timestamp — and gives the other party a
  10-minute window to file their case. `resolve` will only rule on **one** party's case *after* a
  fresh fetch proves that window has elapsed; a case filed in time is always heard. This closes the
  old freeze: a silent counterparty could previously stall a dispute forever (both cases were
  required), trapping the escrow. Now the arbitrator can rule on the filed case, weighing the
  defaulter's silence against them — but never before the recorded minutes genuinely pass.
- **Enforced appeal window (real wall-clock).** `resolve` only *proposes* a ruling and stamps a
  second hard deadline from the same fetched clock: an **unappealed** ruling cannot be `finalize`d
  until a fresh fetch proves the 10-minute appeal window has passed. The old guard only blocked the
  resolver's *own* wallet, so a second wallet could resolve→finalize back-to-back and snipe the
  window shut; now real minutes cannot be manufactured with extra wallets. Both windows **fail
  closed** — no trusted time means no adverse action, and if the clock was down at ruling time the
  window is armed on the first attempt instead (an outage can only lengthen it).
- **Bonded appeals.** Appealing costs 1% of the escrow (min 0.01 GEN). If the re-arbitration moves
  the ruling (outcome or nearest-10% bucket) the bond returns; if the original ruling stands, the
  bond is paid to the counterparty for the delay. Frivolous appeals cost something.
- **Injection guardrails.** Party statements and the fetched deliverable are labelled as material
  under review, never instructions — the arbitrator ignores any "rule in my favor" text inside them.
- **Solvency book.** `escrowed / paid / refunded` accounting exposed by `get_stats`; a settled or
  cancelled deal closes its book to zero. On-chain ruling history (`initial` + `appeal`) per deal.

Stress-tested end-to-end on-chain across five deals: a clean dispute where the resolver was blocked
from self-finalizing and design complaints outside the terms were rejected; an **injection attempt**
("SYSTEM OVERRIDE … return RELEASE") ignored twice by the arbitrator, with the upheld appeal's bond
paid to the counterparty (client received escrow + bond, balance-checked); an ambiguous split whose
appeal bond followed the revised/upheld flag; an unverifiable deal that ruled UNCLEAR, held the funds,
and returned both escrow and appeal bond on mutual cancel; and the plain approve path. The escrow book
closed to zero after every route.

**The v0.4 windows are live-verified on-chain** (two-wallet MetaMask run against the deployed
contract): raising a dispute stamped a real response window and `resolve` on a single filed case was
**refused with a live countdown** while it was open; after the fetched clock proved the window had
elapsed, the same call ruled **one-sided**, weighing the silent party's default against them — the
freeze a no-show could once cause is gone. On a ruled deal, a **second wallet's** immediate
`finalize` was **refused with the appeal-window countdown** (the exact snipe the old action-based
guard allowed), the appeal path stayed open through the window, and finalization settled the escrow
per the ruling once the window provably passed. Beyond the on-chain run, 8 adversarial direct-mode
probes attack the window seams: exact `now == deadline` boundaries on both windows, a fast clock
source unable to shorten a window (the contract takes the *earliest* corroborated reading), source
divergence failing closed even when time had truly elapsed, a dispute raised during a clock outage
never freeing the escrow one-sided while a genuine two-sided resolve still worked, a late-but-real
response heard as two-sided, and the arm-on-outage finalize sequence (arms → holds → releases).

## Project summary
Freelance escrow needs someone to judge *"did they deliver what was agreed?"* — today that's a
centralized platform or a lawyer taking a cut. Aegis makes the arbiter an **AI-validator panel** on
GenLayer: the contract holds the escrowed GEN, and on a dispute it interprets the plain-English
terms, weighs both parties' written cases (and can fetch the GitHub deliverable), then **settles the
escrow by its ruling** — release to the freelancer, refund the client, or a percentage split.

**GenLayer advantage:** a dispute ruling needs AI judgement of natural-language terms + evidence
*and* a binding on-chain settlement of real funds. A normal contract can't judge; a normal backend
can't settle trustlessly. Aegis does both in one place.

## What makes it stand out
- **Money moves on the AI's verdict** — release / refund / split, paid out by the contract.
- **Confidence gate** — genuinely ambiguous cases park in `NEEDS_REVIEW` instead of a bad payout.
- **Appeal** — the losing side gets one independent re-arbitration before funds move
  (`resolve` rules → `finalize` pays, with an appeal window in between).
- **GitHub deliverable check** — the arbitrator can fetch + judge the actual submitted work.
- **Fairness reputation** — on-chain score that tracks dispute *wins/losses*, not just activity.
- **A real marketplace** — clients post open jobs, freelancers browse and **claim** them.
- **Locked spec** — terms are immutable on-chain; each deal shows a verifiable keccak fingerprint so
  both parties confirm they're judged against the same spec.

## How it works
1. **Post** — a client funds a job into escrow, either open to the board or assigned to an address.
2. **Claim** — a freelancer claims an open job (the escrow is already locked).
3. **Deliver** — the freelancer submits the work (optionally a GitHub URL).
4. **Settle the easy way** — the client approves → escrow released to the freelancer.
5. **Or dispute** — either party disputes (starting a **fetched-clock response window**) → both submit
   a written case (**sealed once submitted**) → `resolve` runs the AI panel to consensus → a ruling
   (`RELEASE` / `REFUND` / `SPLIT` / `UNCLEAR`). If one side stays silent past the response window,
   the panel rules on the filed case and weighs the default against the no-show.
6. **Finalize** — `resolve` stamps a **fetched-clock appeal window**; the losing side may appeal once
   (**bonded**) before it elapses, and an unappealed ruling can't be finalized (by anyone) until the
   window provably passes. Then the contract splits the escrow per the ruling. Ambiguous rulings hold
   the funds in `NEEDS_REVIEW`.

## Tech stack
- **Intelligent Contract:** Python + GenVM — escrow (payable + `emit_transfer`), lifecycle, AI ruling
  via `gl.eq_principle.prompt_comparative`, reputation. The single source of truth.
- **Frontend:** Next.js (App Router) · React · Tailwind v4 · GenLayerJS · viem. EIP-6963 wallet
  discovery (MetaMask / Rabby / any injected wallet).
- **Backend:** none — the contract holds the truth; nothing off-chain decides anything.

## How to run locally
```bash
cd web
npm install
cp .env.example .env.local      # contract address is prefilled for Studionet
npm run dev                     # http://localhost:3000
```
The contract source is `contracts/aegis.py` (deploy / interact via GenLayer Studio).

## Testing
```bash
cd web
npm test
```
Unit tests cover the escrow money-math (exact GEN↔wei, 18-decimal truncation, edge cases), the spec
fingerprint, and full deal-status / ruling-outcome coverage.

## Demo evidence (validated on-chain)
A real dispute run through the deployed contract: a "10 product photos, only 5 delivered" job →
both parties submitted cases → the AI ruled **`SPLIT`, freelancer 50%, HIGH confidence** → an appeal
re-affirmed it → `finalize` split the 2 GEN escrow 1:1. Reputation updated with the dispute
win/loss. An earlier ambiguous case correctly returned `UNCLEAR` and **held the funds** rather than
guessing.

## Honest boundaries
- **The windows are real time, fetched.** GenVM has no native clock, so the contract fetches UTC
  under consensus (Cloudflare + Ethereum block time) to enforce both the response and appeal windows.
  This is as trustless as those two independent, probe-verified sources — both would have to be wrong
  in the same direction at the same moment to shift a deadline, and the clock never *shortens* a
  window: an outage degrades to "no adverse action" (fail-closed), it never lets a party act early.
- **A no-show no longer freezes the escrow.** Both cases are still preferred, but a silent
  counterparty can no longer trap the funds — after the enforced response window the arbitrator rules
  on the filed case (mutual `cancel` remains available too).
- **AI/web variance.** Judgement depends on the LLM and, for GitHub checks, on the page being
  fetchable; unclear cases return `UNCLEAR` and hold the escrow rather than passing.

## Roadmap
- **Phase 5:** a notifications/indexer layer (watch contract events → email/push so parties know when
  to act) — a cache that notifies, never decides. Plus a demo video + screenshots.
- Job categories + board filtering; multi-milestone deals.
- **Credence tie-in** — gate jobs behind a
  [Credence](https://github.com/Hemmy1417/Credence)-verified identity (sibling project).

## Repo layout
```
docs/        PRD.md TRD.md SDLC.md SCHEMAS.md
contracts/   aegis.py            (the deployed Intelligent Contract)
web/         Next.js + GenLayerJS frontend (marketplace, deal lifecycle, profiles, resolved ledger)
```

_Sibling project:_ [Credence](https://github.com/Hemmy1417/Credence) — on-chain identity
verification; Aegis can consume Credence-verified identities.
