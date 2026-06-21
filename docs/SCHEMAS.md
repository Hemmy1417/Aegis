# Aegis — Contract Schemas (v1.0)

The Intelligent Contract is the source of truth: escrow balances, deal state, AI rulings, and
reputation all live on-chain. Views return JSON **strings** (frontend `JSON.parse`s them), matching
the pattern proven in Credence.

## State
```python
class Aegis(gl.Contract):
    total_deals: u256
    total_settled: u256
    deals: TreeMap[str, str]          # deal_id ("d-<seq>")        -> Deal JSON
    deals_by_addr: TreeMap[str, str]  # address                    -> JSON list[deal_id]
    reputation: TreeMap[str, str]     # address                    -> Reputation JSON
    settled_index: TreeMap[str, str]  # str(seq)                   -> deal_id (ordering for get_latest)
```
> Stick to `TreeMap` / `u256` / `str` only (the GenVM build that ran Credence could not schema-gen
> `DynArray`; lists are stored as JSON strings inside `str` values).

## Deal record (JSON)
```json
{
  "id": "d-0",
  "client": "0x…",
  "freelancer": "0x…",
  "amount": "1000000000000000000",        // escrowed wei, as a string (u256-safe)
  "terms": "Deliver a working REST API with tests by Friday.",
  "deliverable_uri": "https://github.com/…",  // optional
  "status": "CREATED | DELIVERED | APPROVED | DISPUTED | RULED | NEEDS_REVIEW | APPEALED | SETTLED | CANCELLED",
  "client_case": "",                      // filled on dispute
  "freelancer_case": "",
  "ruling": null,                         // Ruling JSON once resolved
  "appealed": false,
  "created_seq": 0
}
```

## Ruling (JSON) — the GenLayer verdict
```json
{
  "outcome": "RELEASE | REFUND | SPLIT | UNCLEAR",
  "freelancer_pct": 0,                    // 0–100; how much of escrow goes to the freelancer
  "reasons": ["..."],
  "risk_flags": ["..."],
  "confidence": "LOW | MEDIUM | HIGH"
}
```
Settlement math: RELEASE → freelancer gets `amount`; REFUND → client gets `amount`; SPLIT →
freelancer gets `amount * freelancer_pct / 100`, client gets the remainder; UNCLEAR or
`confidence == LOW` → status `NEEDS_REVIEW`, no transfer.

## Reputation record (JSON)
```json
{ "address": "0x…", "deals": 0, "released": 0, "refunded": 0, "split": 0, "score": 0, "tier": "New" }
```
Aegis trust score is derived from settled outcomes (completed deals, dispute fairness). Tiers:
New / Building / Reliable / Highly Reliable.

## Write methods
| Method | Caller | Notes |
|---|---|---|
| `create_deal(freelancer, terms)` **payable** | client | escrows `gl.message.value`; returns `deal_id` |
| `submit_deliverable(deal_id, deliverable_uri)` | freelancer | optional GitHub URL; status → DELIVERED |
| `approve(deal_id)` | client | happy path → transfer escrow to freelancer; status SETTLED |
| `dispute(deal_id)` | client or freelancer | status → DISPUTED |
| `submit_case(deal_id, statement)` | each party | stores client_case / freelancer_case |
| `resolve(deal_id)` | anyone (needs both cases) | runs AI arbitration → settles or NEEDS_REVIEW |
| `appeal(deal_id)` | losing party (once) | re-runs judgement with a bigger panel → final settle |
| `cancel(deal_id)` | mutual (both call) | refund client; status CANCELLED |

## View methods (return JSON strings)
| Method | Returns |
|---|---|
| `get_deal(deal_id)` | Deal JSON or `""` |
| `get_ruling(deal_id)` | Ruling JSON or `""` |
| `get_deals_by_address(address)` | JSON list of Deal JSON |
| `get_reputation(address)` | Reputation JSON |
| `get_stats()` | `{ total_deals, total_settled, total_disputed }` |
| `get_latest(n)` | JSON list of the n most recent settled deals |

## AI arbitration prompt (shape)
Inputs: `terms`, `client_case`, `freelancer_case`, optional fetched `deliverable` text. Rules:
return VALID JSON only; base the ruling **only** on the supplied terms + cases + deliverable; if the
evidence is genuinely insufficient, return `outcome = "UNCLEAR"`; `freelancer_pct` is an integer
0–100. Equivalence principle: outputs are equivalent if they agree on `outcome` and a bucketed
`freelancer_pct` (e.g. nearest 10%), even if reasons are worded differently.
