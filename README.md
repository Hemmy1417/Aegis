# Aegis — AI-arbitrated freelance escrow on GenLayer

> Lock payment for a job in escrow. If there's a dispute, an AI-validator panel reads the agreed
> terms and both sides' cases and rules how the money splits — trustlessly, on-chain.

**Status:** 🟢 **Phase 1 contract deployed** on Studionet. Core escrow + AI arbitration MVP is live;
testing the dispute→settlement flow next, then the frontend (Phase 3).

## Contract details
| Field | Value |
|---|---|
| Network | **Studionet** |
| RPC | `https://studio.genlayer.com/api` |
| Chain ID | `61999` |
| Contract address | `0xC4D6A20C25ba5d4aD1dCe968f66557A4D28Fb7C1` (Phase 2) |
| Explorer | https://explorer-studio.genlayer.com (`/tx/<hash>`) |

## Project summary
Freelance escrow needs someone to judge *"did they deliver what was agreed?"* — today that's a
centralized platform or a lawyer. Aegis makes the arbiter an **AI-validator panel** on GenLayer: the
contract holds the escrowed GEN, and on a dispute it interprets the plain-English terms, weighs both
parties' cases (and optionally fetches the GitHub deliverable), then **settles the escrow** by its
ruling — release to the freelancer, refund the client, or split.

**GenLayer advantage:** a dispute ruling needs AI judgement of natural-language terms + evidence
*and* a binding on-chain settlement of real funds. A normal contract can't judge; a normal backend
can't settle trustlessly.

## What makes it stand out
- **Money moves on the AI's verdict** (release / refund / split).
- **Confidence gate** — ambiguous cases park in NEEDS_REVIEW instead of a bad payout.
- **Appeal** — the losing side gets one re-ruling by a larger panel.
- **GitHub deliverable check** — the arbitrator can fetch + judge the actual work.
- **Reputation + Credence tie-in** — settled outcomes build an on-chain trust score; deals can be
  gated behind a [Credence](https://github.com/Hemmy1417/Credence)-verified identity.

## How it works
1. Client creates a job (terms + amount + freelancer) and funds the escrow.
2. Freelancer delivers (optionally a GitHub URL).
3. Client approves → escrow released. **Or** a dispute is raised.
4. Both submit their case → `resolve` runs the AI panel → ruling JSON.
5. Contract settles the escrow by the ruling (or holds it if UNCLEAR/low-confidence).

## Tech stack
- **Intelligent Contract:** Python + GenVM (escrow, lifecycle, AI ruling, reputation — source of truth)
- **Frontend:** Next.js (App Router), React, Tailwind, GenLayerJS, Vercel
- **Backend:** none (MVP)

## Repo layout
```
docs/        PRD.md TRD.md SDLC.md SCHEMAS.md
contracts/   aegis.py            (the Intelligent Contract — Phase 1)
web/         Next.js + GenLayerJS frontend (Phase 3)
```

## Network (planned)
Studionet — chainId `61999`, RPC `https://studio.genlayer.com/api`, explorer
`https://explorer-studio.genlayer.com`.

_Sibling project:_ [Credence](https://github.com/Hemmy1417/Credence) — on-chain identity
verification; Aegis can consume Credence-verified identities.
