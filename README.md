# Aegis — AI-arbitrated freelance escrow on GenLayer

> Lock payment for a job in escrow. If there's a dispute, an AI-validator panel reads the agreed
> terms and both sides' cases and rules how the money splits — trustlessly, on-chain.

**Status:** 🟢 **Built and validated end-to-end on Studionet.** The Intelligent Contract (escrow +
marketplace + AI arbitration + appeal + reputation) is deployed, and every flow has been exercised
on-chain — including a real dispute that the AI split 50/50 and settled. The Next.js frontend is
complete. Next: GitHub + Vercel deploy.

## Live demo
_TODO: Vercel link._

## Contract details
| Field | Value |
|---|---|
| Network | **Studionet** |
| RPC | `https://studio.genlayer.com/api` |
| Chain ID | `61999` |
| Contract address | `0xB4eb9957eb141D85bd9Bed45c1E75aaEB039B617` |
| Explorer | https://explorer-studio.genlayer.com (`/tx/<hash>`) |

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
5. **Or dispute** — either party disputes → both submit a written case → `resolve` runs the AI panel
   to consensus → a ruling (`RELEASE` / `REFUND` / `SPLIT` / `UNCLEAR`).
6. **Finalize** — the losing side may appeal once; then anyone finalizes and the contract splits the
   escrow per the ruling. Ambiguous rulings hold the funds in `NEEDS_REVIEW`.

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

## Known limitations
- **Both parties must submit a case** before `resolve` runs; a no-show currently stalls a dispute
  (mutual `cancel` is the escape hatch). A submission deadline is future work.
- **Time-of-check.** The ruling reflects the evidence at resolution; there's no on-chain timestamp
  (GenVM has no wall-clock), so "verified X ago" isn't shown.
- **AI/web variance.** Judgement depends on the LLM and, for GitHub checks, on the page being
  fetchable; unclear cases return `UNCLEAR` and hold the escrow rather than passing.

## Roadmap
- **Phase 5:** a notifications/indexer layer (watch contract events → email/push so parties know when
  to act) — a cache that notifies, never decides. Plus a demo video + screenshots.
- Job categories + board filtering; submission deadlines; multi-milestone deals.
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
