# Aegis — SDLC Phase Plan

Approval-gated. We do not jump to code; each phase has an exit criterion and a checkpoint commit.

| Phase | Goal | Exit criteria |
|---|---|---|
| **0 — Definition** ✅ | Validate idea + plan | PRD/TRD/SDLC/SCHEMAS complete; GenLayer fit confirmed; escrow feasibility (payable + emit_transfer) verified |
| **1 — Contract MVP** | Core escrow + lifecycle + AI ruling | Contract deploys on Studionet; create/fund → deliver → approve (release) works; dispute → both cases → `resolve` returns a ruling and settles (release/refund/split); views read back |
| **2 — Tier-2 features** | Confidence gate, appeal, GitHub deliverable check, reputation | NEEDS_REVIEW parks low-confidence rulings; appeal re-rules; deliverable URL is fetched + weighed; reputation updates on settle |
| **3 — Frontend MVP** | Drive the full flow from the browser | Create/fund deal, deliver, dispute, submit cases, resolve, see ruling card + settlement; deal registry + shareable deal page; Credence identity gate (frontend) |
| **4 — Testing & hardening** | The §13 matrix | Vitest unit suite green; opt-in contract smoke test; bad-input/edge/failure states handled; demo mode |
| **5 — Deploy** | Live | Contract deployed; frontend on Vercel; README updated with address/RPC/explorer |
| **6 — Demo polish** | Submission | Video, screenshots, honest limitations, roadmap |

## Build order within Phase 1 (de-risk first)
1. Minimal probe: confirm `@gl.public.write.payable` + `emit_transfer` work on Studionet (a 15-line
   escrow→withdraw contract) — pin the exact symbols **before** building the full contract.
2. Deal state + create/fund + happy-path approve (release).
3. Dispute → submit_case → resolve (AI ruling + deterministic settlement).
4. Views.

## Checkpoint habit
Commit after each working step (`git commit -m "phase 1: escrow create+fund+release works"`).

## Reused assets from Credence (don't reinvent)
- GenVM runner header + SDK symbol patterns (see project memory).
- GenLayerJS client/read/write + read-after-write retry; Instant Wallet (gas sponsored on Studionet).
- Lamborghini-style theme, components, Vitest setup, explorer wiring, badge/registry patterns.
