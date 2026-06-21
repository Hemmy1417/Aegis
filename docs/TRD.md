# Aegis — Technical Requirements Document (v1.0)

## 1. Architecture (four layers, kept separate)
- **Frontend** — Next.js (App Router) + React + Tailwind + GenLayerJS, on Vercel. Create/fund deals,
  run the dispute flow, show rulings, browse the registry.
- **Intelligent Contract** — Python on GenVM: holds escrow, enforces the deal lifecycle, runs AI
  arbitration, stores rulings + reputation. **The source of truth.**
- **Backend** — none (MVP). Frontend reads/writes the contract directly. Optional Supabase cache later.
- **Agent/docs** — PRD/TRD/SDLC/SCHEMAS + README + this build.

## 2. Contract architecture
See `SCHEMAS.md` for state, records, methods. Key design points:
- **Escrow value** — `create_deal` is `@gl.public.write.payable`; the escrowed amount = `gl.message.value`.
  Settlement sends GEN out with `emit_transfer(to, amount)`. **Both exact symbols are pinned at
  build time against the SDK / a working Studio example** (the Credence approach). *Fallback:* an
  internal balance ledger + `withdraw()` if `emit_transfer` proves unavailable.
- **Lifecycle guard** — every write validates the caller (client vs freelancer) and the current
  status; illegal transitions `raise gl.vm.UserError(...)`.
- **Deterministic settlement** — the AI returns only the *ruling*; the contract does the math and the
  transfers deterministically (validators don't each move funds — they agree on the ruling, then the
  contract settles once).

## 3. AI judgement & consensus
- Web + LLM run **inside** an `gl.eq_principle.prompt_comparative(fn, principle)` block.
- `fn` optionally fetches the deliverable: `gl.nondet.web.render(deliverable_uri, mode="text")`
  (GitHub only — reliable), then `gl.nondet.exec_prompt(prompt)` for the ruling.
- **Equivalence principle:** outputs are equivalent if they agree on `outcome` and a bucketed
  `freelancer_pct` (nearest 10%). This lets validators converge without identical prose.
- **Confidence gate:** if the parsed ruling is `UNCLEAR` or `confidence == "LOW"`, the contract sets
  `NEEDS_REVIEW` and does **not** transfer.
- **Appeal:** `appeal` re-runs the same judgement with a larger validator set / stricter principle;
  result is final.

## 4. Prompt design (structured JSON only)
Inputs: `terms`, `client_case`, `freelancer_case`, optional `deliverable` text. Output strictly:
```json
{"outcome":"RELEASE|REFUND|SPLIT|UNCLEAR","freelancer_pct":0,"reasons":["..."],"risk_flags":[],"confidence":"LOW|MEDIUM|HIGH"}
```
Rules baked into the prompt: judge only from supplied material; don't invent facts; `UNCLEAR` when
evidence is insufficient; `freelancer_pct` integer 0–100; one of the four outcomes exactly.

## 5. Reputation
On every settlement, update `reputation[client]` and `reputation[freelancer]` (deal counts +
released/refunded/split tallies) and recompute a 0–100 Aegis trust score + tier. Pure, deterministic,
derived from on-chain outcomes.

## 6. Credence tie-in
MVP: the frontend checks a party's Credence verification (via Credence's public API / contract read)
and (optionally) **gates deal creation** behind a verified identity, showing the Credence badge on
the deal page. On-chain cross-contract enforcement is a documented stretch goal.

## 7. Environment variables
- `NEXT_PUBLIC_CONTRACT_ADDRESS` — deployed Aegis address (Studionet).
- `NEXT_PUBLIC_EXPLORER_URL` — defaults in code to `https://explorer-studio.genlayer.com` (`/tx/<hash>`).
- `NEXT_PUBLIC_CREDENCE_ADDRESS` / `NEXT_PUBLIC_CREDENCE_API` — for the optional identity gate.

## 8. Deployment
GenLayer Studio → Studionet (chainId 61999, RPC `https://studio.genlayer.com/api`). Frontend on
Vercel (Root Directory = `web`). Explorer: GenLayer Studio Explorer.

## 9. Testing (the §13 matrix)
- **Unit (Vitest):** settlement math (release/refund/split percentages), ruling JSON parsing,
  reputation scoring, lifecycle-guard logic, config invariants.
- **Contract smoke (opt-in):** read-only checks against the deployed contract (`get_stats`,
  `get_deal`, `get_reputation`).
- **Manual matrix:** happy path, dispute→release, dispute→refund, dispute→split, UNCLEAR→NEEDS_REVIEW,
  appeal, mutual cancel, bad inputs (empty terms, non-party caller, double-submit), network errors.

## 10. Security & abuse notes
- Caller/role checks on every write; status-machine guards prevent skipping steps.
- Escrow can only be released by the contract's deterministic settlement (no arbitrary withdrawals).
- Frivolous disputes: noted; a dispute-bond is a post-MVP deterrent.
- No private keys in the repo; `.env*` gitignored; `.env.example` committed.
- Stall risk (one party never submits a case): documented limitation (no on-chain clock for a timeout).
