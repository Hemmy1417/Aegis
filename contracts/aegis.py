# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# Aegis — AI-arbitrated freelance escrow (Phase 1 MVP).
# Client funds a job in escrow; on a dispute, both parties submit written cases and an
# AI-validator panel rules how the escrowed GEN is split. The contract holds the funds
# and settles them deterministically by the ruling. (Deliverable-fetch, appeal, and the
# richer confidence gate land in Phase 2.)

from genlayer import *
import json

MAX_TERMS = 4000
MAX_CASE = 4000

# Deal lifecycle:
#   CREATED -> DELIVERED -> SETTLED            (happy path: client approves)
#   CREATED/DELIVERED -> DISPUTED -> SETTLED   (AI rules RELEASE/REFUND/SPLIT)
#                                  -> NEEDS_REVIEW (AI ruling UNCLEAR/low-confidence; funds held)
#   CREATED/DELIVERED -> CANCELLED             (both parties cancel -> refund client)


# ------------------------------------------------------------------- helpers (deterministic)
def _is_addr(a: str) -> bool:
    a = a.strip()
    return a.startswith("0x") and len(a) == 42


def _parse_json(raw: str):
    s = raw.strip().replace("```json", "").replace("```", "").strip()
    start, end = s.find("{"), s.rfind("}")
    if start == -1 or end == -1:
        raise gl.vm.UserError("ruling did not return JSON")
    return json.loads(s[start:end + 1])


def _rep_tier(score: int) -> str:
    if score <= 0:
        return "New"
    if score < 50:
        return "Building"
    if score < 100:
        return "Reliable"
    return "Highly Reliable"


# ----------------------------------------------------------------------------------- contract
class Aegis(gl.Contract):
    total_deals: u256
    total_settled: u256
    total_disputed: u256
    deals: TreeMap[str, str]          # "d-<seq>" -> Deal JSON
    deals_by_addr: TreeMap[str, str]  # address   -> JSON list of deal_ids
    reputation: TreeMap[str, str]     # address   -> Reputation JSON
    settled_index: TreeMap[str, str]  # str(seq)  -> deal_id

    def __init__(self) -> None:
        self.total_deals = u256(0)
        self.total_settled = u256(0)
        self.total_disputed = u256(0)
        self.deals = TreeMap()
        self.deals_by_addr = TreeMap()
        self.reputation = TreeMap()
        self.settled_index = TreeMap()

    # -------------------------------------------------------- internal (undecorated) helpers
    def _get(self, deal_id: str):
        raw = self.deals.get(deal_id, "")
        if not raw:
            raise gl.vm.UserError("deal not found")
        return json.loads(raw)

    def _save(self, deal: dict) -> None:
        self.deals[deal["id"]] = json.dumps(deal)

    def _index(self, address: str, deal_id: str) -> None:
        keys = json.loads(self.deals_by_addr.get(address, "[]"))
        if deal_id not in keys:
            keys.append(deal_id)
        self.deals_by_addr[address] = json.dumps(keys)

    def _pay(self, address: str, amount: int) -> None:
        if amount > 0:
            gl.get_contract_at(Address(address)).emit_transfer(value=u256(amount), on="finalized")

    def _bump_rep(self, address: str) -> None:
        rep = json.loads(self.reputation.get(address, "")) if self.reputation.get(address, "") else {
            "address": address, "deals": 0, "completed": 0, "score": 0, "tier": "New"
        }
        rep["completed"] = int(rep.get("completed", 0)) + 1
        rep["deals"] = int(rep.get("deals", 0)) + 1
        rep["score"] = min(100, rep["completed"] * 25)
        rep["tier"] = _rep_tier(rep["score"])
        self.reputation[address] = json.dumps(rep)

    def _settle(self, deal: dict, ruling: dict) -> None:
        amount = int(deal["amount"])
        pct = int(ruling.get("freelancer_pct", 0))
        if pct < 0:
            pct = 0
        if pct > 100:
            pct = 100
        freelancer_share = amount * pct // 100
        client_share = amount - freelancer_share
        self._pay(deal["freelancer"], freelancer_share)
        self._pay(deal["client"], client_share)
        deal["ruling"] = ruling
        deal["status"] = "SETTLED"
        self._save(deal)
        self.settled_index[str(int(self.total_settled))] = deal["id"]
        self.total_settled = u256(int(self.total_settled) + 1)
        self._bump_rep(deal["client"])
        self._bump_rep(deal["freelancer"])

    # ----------------------------------------------------------------------------- writes
    @gl.public.write.payable
    def create_deal(self, freelancer: str, terms: str) -> str:
        client = str(gl.message.sender_address)
        fr = freelancer.strip()
        t = terms.strip()
        amount = int(gl.message.value)
        if not _is_addr(fr):
            raise gl.vm.UserError("invalid freelancer address")
        if fr.lower() == client.lower():
            raise gl.vm.UserError("client and freelancer must differ")
        if not t or len(t) > MAX_TERMS:
            raise gl.vm.UserError("invalid terms")
        if amount <= 0:
            raise gl.vm.UserError("escrow amount must be > 0 (send value with this call)")
        seq = int(self.total_deals)
        deal_id = f"d-{seq}"
        deal = {
            "id": deal_id,
            "client": client,
            "freelancer": fr,
            "amount": str(amount),
            "terms": t,
            "deliverable_uri": "",
            "status": "CREATED",
            "client_case": "",
            "freelancer_case": "",
            "ruling": None,
            "appealed": False,
            "created_seq": seq,
        }
        self._save(deal)
        self._index(client, deal_id)
        self._index(fr, deal_id)
        self.total_deals = u256(seq + 1)
        return json.dumps(deal)

    @gl.public.write
    def submit_deliverable(self, deal_id: str, deliverable_uri: str) -> str:
        deal = self._get(deal_id)
        sender = str(gl.message.sender_address)
        if sender.lower() != deal["freelancer"].lower():
            raise gl.vm.UserError("only the freelancer may submit the deliverable")
        if deal["status"] not in ("CREATED", "DELIVERED"):
            raise gl.vm.UserError("deal is not open for delivery")
        deal["deliverable_uri"] = deliverable_uri.strip()
        deal["status"] = "DELIVERED"
        self._save(deal)
        return json.dumps(deal)

    @gl.public.write
    def approve(self, deal_id: str) -> str:
        deal = self._get(deal_id)
        sender = str(gl.message.sender_address)
        if sender.lower() != deal["client"].lower():
            raise gl.vm.UserError("only the client may approve")
        if deal["status"] not in ("CREATED", "DELIVERED"):
            raise gl.vm.UserError("deal cannot be approved in its current state")
        ruling = {
            "outcome": "RELEASE",
            "freelancer_pct": 100,
            "reasons": ["Client approved the work."],
            "risk_flags": [],
            "confidence": "HIGH",
        }
        self._settle(deal, ruling)
        return json.dumps(deal)

    @gl.public.write
    def dispute(self, deal_id: str) -> str:
        deal = self._get(deal_id)
        sender = str(gl.message.sender_address)
        if sender.lower() not in (deal["client"].lower(), deal["freelancer"].lower()):
            raise gl.vm.UserError("only a party to the deal may dispute")
        if deal["status"] not in ("CREATED", "DELIVERED"):
            raise gl.vm.UserError("deal cannot be disputed in its current state")
        deal["status"] = "DISPUTED"
        self._save(deal)
        self.total_disputed = u256(int(self.total_disputed) + 1)
        return json.dumps(deal)

    @gl.public.write
    def submit_case(self, deal_id: str, statement: str) -> str:
        deal = self._get(deal_id)
        sender = str(gl.message.sender_address)
        s = statement.strip()
        if not s or len(s) > MAX_CASE:
            raise gl.vm.UserError("invalid statement")
        if deal["status"] != "DISPUTED":
            raise gl.vm.UserError("deal is not in dispute")
        if sender.lower() == deal["client"].lower():
            deal["client_case"] = s
        elif sender.lower() == deal["freelancer"].lower():
            deal["freelancer_case"] = s
        else:
            raise gl.vm.UserError("only a party to the deal may submit a case")
        self._save(deal)
        return json.dumps(deal)

    @gl.public.write
    def resolve(self, deal_id: str) -> str:
        deal = self._get(deal_id)
        if deal["status"] != "DISPUTED":
            raise gl.vm.UserError("deal is not in dispute")
        if not deal["client_case"] or not deal["freelancer_case"]:
            raise gl.vm.UserError("both parties must submit their case before resolving")

        terms = deal["terms"]
        client_case = deal["client_case"]
        freelancer_case = deal["freelancer_case"]

        def judge() -> str:
            prompt = f"""You are an impartial arbitrator resolving a freelance escrow dispute.
Decide how the escrowed payment should be split between the client and the freelancer,
based ONLY on the agreed terms and each party's statement below.

Agreed terms:
\"\"\"
{terms}
\"\"\"

Client's statement:
\"\"\"
{client_case}
\"\"\"

Freelancer's statement:
\"\"\"
{freelancer_case}
\"\"\"

Rules:
- Return VALID JSON ONLY, no prose outside the object. Do not invent facts.
- outcome is one of: "RELEASE" (work meets the terms -> pay freelancer in full),
  "REFUND" (work clearly fails the terms -> refund client), "SPLIT" (both have partial merit),
  "UNCLEAR" (the statements are insufficient to judge fairly).
- freelancer_pct is an integer 0-100 = the share of the escrow the freelancer should receive.
  RELEASE => 100, REFUND => 0, SPLIT => a value strictly between, UNCLEAR => 0.
- confidence is one of: "LOW", "MEDIUM", "HIGH".

Respond ONLY with:
{{"outcome":"...","freelancer_pct":0,"reasons":["..."],"risk_flags":[],"confidence":"LOW"}}"""
            return gl.nondet.exec_prompt(prompt)

        principle = (
            "Outputs are equivalent if they agree on the outcome value and the freelancer_pct "
            "agrees within 10 (same nearest-10 bucket), even if reasons are worded differently."
        )
        ruling_raw = gl.eq_principle.prompt_comparative(judge, principle)
        ruling = _parse_json(ruling_raw)
        for key, default in (("reasons", []), ("risk_flags", []), ("freelancer_pct", 0), ("confidence", "LOW")):
            if key not in ruling:
                ruling[key] = default

        outcome = ruling.get("outcome", "UNCLEAR")
        # Confidence gate (basic): hold the escrow instead of a bad payout.
        if outcome == "UNCLEAR" or ruling.get("confidence") == "LOW":
            deal["ruling"] = ruling
            deal["status"] = "NEEDS_REVIEW"
            self._save(deal)
            return json.dumps(deal)

        if outcome == "RELEASE":
            ruling["freelancer_pct"] = 100
        elif outcome == "REFUND":
            ruling["freelancer_pct"] = 0
        self._settle(deal, ruling)
        return json.dumps(deal)

    @gl.public.write
    def cancel(self, deal_id: str) -> str:
        # Mutual cancellation: both parties call cancel -> refund the client.
        deal = self._get(deal_id)
        sender = str(gl.message.sender_address)
        if sender.lower() not in (deal["client"].lower(), deal["freelancer"].lower()):
            raise gl.vm.UserError("only a party to the deal may cancel")
        if deal["status"] not in ("CREATED", "DELIVERED", "DISPUTED"):
            raise gl.vm.UserError("deal cannot be cancelled in its current state")
        flags = deal.get("cancel_flags", [])
        if sender.lower() not in flags:
            flags.append(sender.lower())
        deal["cancel_flags"] = flags
        if deal["client"].lower() in flags and deal["freelancer"].lower() in flags:
            self._pay(deal["client"], int(deal["amount"]))
            deal["status"] = "CANCELLED"
        self._save(deal)
        return json.dumps(deal)

    # ------------------------------------------------------------------------------ views
    @gl.public.view
    def get_deal(self, deal_id: str) -> str:
        return self.deals.get(deal_id, "")

    @gl.public.view
    def get_ruling(self, deal_id: str) -> str:
        raw = self.deals.get(deal_id, "")
        if not raw:
            return ""
        ruling = json.loads(raw).get("ruling")
        return json.dumps(ruling) if ruling else ""

    @gl.public.view
    def get_deals_by_address(self, address: str) -> str:
        out = []
        for did in json.loads(self.deals_by_addr.get(address, "[]")):
            raw = self.deals.get(did, "")
            if raw:
                out.append(json.loads(raw))
        return json.dumps(out)

    @gl.public.view
    def get_reputation(self, address: str) -> str:
        raw = self.reputation.get(address, "")
        if raw:
            return raw
        return json.dumps({"address": address, "deals": 0, "completed": 0, "score": 0, "tier": "New"})

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_deals": int(self.total_deals),
            "total_settled": int(self.total_settled),
            "total_disputed": int(self.total_disputed),
        })

    @gl.public.view
    def get_latest(self, n: int) -> str:
        out = []
        total = int(self.total_settled)
        start = total - 1
        stop = max(-1, total - 1 - n)
        i = start
        while i > stop:
            did = self.settled_index.get(str(i), "")
            if did:
                raw = self.deals.get(did, "")
                if raw:
                    out.append(json.loads(raw))
            i -= 1
        return json.dumps(out)
