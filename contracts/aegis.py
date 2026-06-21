# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# Aegis — AI-arbitrated freelance escrow (Phase 2).
# Client funds a job in escrow; on a dispute, both parties submit cases and an AI-validator
# panel rules how the escrowed GEN is split. The contract holds the funds and settles them
# deterministically by the ruling.
#
# Phase 2 adds: (1) appeal — resolve() rules WITHOUT paying, the losing side may appeal once
# for a more rigorous re-arbitration, then finalize() pays out; (2) the arbitrator can fetch
# the freelancer's deliverable URL and weigh the actual work; (3) fairness-based reputation
# (dispute wins/losses), plus a confidence gate (UNCLEAR/LOW -> NEEDS_REVIEW, funds held).

from genlayer import *
import json

MAX_TERMS = 4000
MAX_CASE = 4000

# Lifecycle:
#   OPEN -> (claim_deal) -> CREATED                       (job board: client posts, freelancer claims)
#   OPEN -> CANCELLED                                     (client withdraws an unclaimed job -> refund)
#   CREATED -> DELIVERED -> SETTLED                       (client approves)
#   ... -> DISPUTED -> (resolve) -> RULED -> (finalize) -> SETTLED
#                                -> NEEDS_REVIEW          (UNCLEAR/low confidence; held)
#   RULED/NEEDS_REVIEW -> (appeal, once) -> RULED/NEEDS_REVIEW
#   CREATED/DELIVERED/DISPUTED/NEEDS_REVIEW -> CANCELLED  (both parties cancel -> refund client)

_PRINCIPLE = (
    "Outputs are equivalent if they agree on the outcome value and the freelancer_pct agrees "
    "within 10 (same nearest-10 bucket), even if the reasons are worded differently."
)


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
    if score < 40:
        return "Building"
    if score < 80:
        return "Reliable"
    return "Highly Reliable"


def _arb_prompt(terms: str, client_case: str, freelancer_case: str, deliverable: str, appeal: bool) -> str:
    appeal_note = ""
    if appeal:
        appeal_note = (
            "\nThis is an APPEAL of a prior ruling. Re-examine all evidence especially rigorously "
            "and judge independently; do not simply defer to the earlier decision.\n"
        )
    deliverable_section = ""
    if deliverable:
        deliverable_section = (
            "\nFetched deliverable (the freelancer's submitted work, may be truncated):\n"
            "\"\"\"\n" + deliverable + "\n\"\"\"\n"
        )
    return f"""You are an impartial arbitrator resolving a freelance escrow dispute.{appeal_note}
Decide how the escrowed payment should be split between the client and the freelancer, based ONLY
on the agreed terms, each party's statement, and the fetched deliverable if present.

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
{deliverable_section}
Rules:
- Return VALID JSON ONLY, no prose outside the object. Do not invent facts.
- outcome is one of: "RELEASE" (work meets the terms -> pay freelancer in full),
  "REFUND" (work clearly fails the terms -> refund client), "SPLIT" (both have partial merit),
  "UNCLEAR" (the evidence is insufficient to judge fairly).
- freelancer_pct is an integer 0-100 = the freelancer's share. RELEASE => 100, REFUND => 0,
  SPLIT => strictly between, UNCLEAR => 0.
- confidence is one of: "LOW", "MEDIUM", "HIGH".

Respond ONLY with:
{{"outcome":"...","freelancer_pct":0,"reasons":["..."],"risk_flags":[],"confidence":"LOW"}}"""


# ----------------------------------------------------------------------------------- contract
class Aegis(gl.Contract):
    total_deals: u256
    total_settled: u256
    total_disputed: u256
    total_open: u256
    deals: TreeMap[str, str]          # "d-<seq>" -> Deal JSON
    deals_by_addr: TreeMap[str, str]  # address   -> JSON list of deal_ids
    reputation: TreeMap[str, str]     # address   -> Reputation JSON
    settled_index: TreeMap[str, str]  # str(seq)  -> deal_id
    open_index: TreeMap[str, str]     # str(seq)  -> deal_id (job-board feed)

    def __init__(self) -> None:
        self.total_deals = u256(0)
        self.total_settled = u256(0)
        self.total_disputed = u256(0)
        self.total_open = u256(0)
        self.deals = TreeMap()
        self.deals_by_addr = TreeMap()
        self.reputation = TreeMap()
        self.settled_index = TreeMap()
        self.open_index = TreeMap()

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

    def _rep_get(self, address: str):
        raw = self.reputation.get(address, "")
        if raw:
            return json.loads(raw)
        return {"address": address, "completed": 0, "dispute_wins": 0, "dispute_losses": 0,
                "score": 0, "tier": "New"}

    def _rep_save(self, rep: dict) -> None:
        score = rep["completed"] * 20 + rep["dispute_wins"] * 15 - rep["dispute_losses"] * 10
        score = max(0, min(100, score))
        rep["score"] = score
        rep["tier"] = _rep_tier(score)
        self.reputation[rep["address"]] = json.dumps(rep)

    def _settle(self, deal: dict, ruling: dict, disputed: bool) -> None:
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

        client = self._rep_get(deal["client"])
        freelancer = self._rep_get(deal["freelancer"])
        client["completed"] += 1
        freelancer["completed"] += 1
        if disputed:
            if pct >= 50:
                freelancer["dispute_wins"] += 1
                client["dispute_losses"] += 1
            else:
                client["dispute_wins"] += 1
                freelancer["dispute_losses"] += 1
        self._rep_save(client)
        self._rep_save(freelancer)

    def _apply_ruling(self, deal: dict, ruling: dict) -> None:
        # Store a fresh ruling and set RULED vs NEEDS_REVIEW (confidence gate). No payout here.
        for key, default in (("reasons", []), ("risk_flags", []), ("freelancer_pct", 0), ("confidence", "LOW")):
            if key not in ruling:
                ruling[key] = default
        outcome = ruling.get("outcome", "UNCLEAR")
        if outcome == "RELEASE":
            ruling["freelancer_pct"] = 100
        elif outcome == "REFUND":
            ruling["freelancer_pct"] = 0
        deal["ruling"] = ruling
        if outcome == "UNCLEAR" or ruling.get("confidence") == "LOW":
            deal["status"] = "NEEDS_REVIEW"
        else:
            deal["status"] = "RULED"
        self._save(deal)

    # ----------------------------------------------------------------------------- writes
    @gl.public.write.payable
    def create_deal(self, freelancer: str, terms: str) -> str:
        # freelancer may be "" to post an OPEN job any wallet can claim, or a specific
        # address to assign the deal directly. Either way the escrow is funded now.
        client = str(gl.message.sender_address)
        fr = freelancer.strip()
        t = terms.strip()
        amount = int(gl.message.value)
        is_open = fr == ""
        if not is_open:
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
            "id": deal_id, "client": client, "freelancer": fr, "amount": str(amount),
            "terms": t, "deliverable_uri": "", "status": "OPEN" if is_open else "CREATED",
            "client_case": "", "freelancer_case": "", "ruling": None,
            "appealed": False, "cancel_flags": [], "created_seq": seq,
        }
        self._save(deal)
        self._index(client, deal_id)
        if is_open:
            self.open_index[str(int(self.total_open))] = deal_id
            self.total_open = u256(int(self.total_open) + 1)
        else:
            self._index(fr, deal_id)
        self.total_deals = u256(seq + 1)
        return json.dumps(deal)

    @gl.public.write
    def claim_deal(self, deal_id: str) -> str:
        # A freelancer claims an OPEN job, becoming the assigned freelancer.
        deal = self._get(deal_id)
        sender = str(gl.message.sender_address)
        if deal["status"] != "OPEN":
            raise gl.vm.UserError("this job is not open to claim")
        if sender.lower() == deal["client"].lower():
            raise gl.vm.UserError("the client cannot claim their own job")
        deal["freelancer"] = sender
        deal["status"] = "CREATED"
        self._save(deal)
        self._index(sender, deal_id)
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
        ruling = {"outcome": "RELEASE", "freelancer_pct": 100,
                  "reasons": ["Client approved the work."], "risk_flags": [], "confidence": "HIGH"}
        self._settle(deal, ruling, False)
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
        cc = deal["client_case"]
        fc = deal["freelancer_case"]
        uri = deal["deliverable_uri"]

        def judge() -> str:
            deliverable = ""
            if uri.startswith("http"):
                deliverable = gl.nondet.web.render(uri, mode="text")[:6000]
            return gl.nondet.exec_prompt(_arb_prompt(terms, cc, fc, deliverable, False))

        ruling = _parse_json(gl.eq_principle.prompt_comparative(judge, _PRINCIPLE))
        self._apply_ruling(deal, ruling)
        return json.dumps(deal)

    @gl.public.write
    def appeal(self, deal_id: str) -> str:
        deal = self._get(deal_id)
        sender = str(gl.message.sender_address)
        if sender.lower() not in (deal["client"].lower(), deal["freelancer"].lower()):
            raise gl.vm.UserError("only a party to the deal may appeal")
        if deal["status"] not in ("RULED", "NEEDS_REVIEW"):
            raise gl.vm.UserError("only a ruled (not yet finalized) deal can be appealed")
        if deal["appealed"]:
            raise gl.vm.UserError("this deal has already been appealed once")
        terms = deal["terms"]
        cc = deal["client_case"]
        fc = deal["freelancer_case"]
        uri = deal["deliverable_uri"]

        def judge() -> str:
            deliverable = ""
            if uri.startswith("http"):
                deliverable = gl.nondet.web.render(uri, mode="text")[:6000]
            return gl.nondet.exec_prompt(_arb_prompt(terms, cc, fc, deliverable, True))

        ruling = _parse_json(gl.eq_principle.prompt_comparative(judge, _PRINCIPLE))
        deal["appealed"] = True
        self._apply_ruling(deal, ruling)
        return json.dumps(deal)

    @gl.public.write
    def finalize(self, deal_id: str) -> str:
        # Pay out a ruled deal. Anyone can call (so the winner can claim once the appeal window
        # has passed — i.e. after an appeal, or if the losing side declines to appeal).
        deal = self._get(deal_id)
        if deal["status"] != "RULED":
            raise gl.vm.UserError("deal is not in a finalizable (RULED) state")
        if not deal.get("ruling"):
            raise gl.vm.UserError("no ruling to finalize")
        self._settle(deal, deal["ruling"], True)
        return json.dumps(deal)

    @gl.public.write
    def cancel(self, deal_id: str) -> str:
        deal = self._get(deal_id)
        sender = str(gl.message.sender_address)
        # An OPEN job has no freelancer yet — the client can withdraw it solo and is refunded.
        if deal["status"] == "OPEN":
            if sender.lower() != deal["client"].lower():
                raise gl.vm.UserError("only the client can withdraw an open job")
            self._pay(deal["client"], int(deal["amount"]))
            deal["status"] = "CANCELLED"
            self._save(deal)
            return json.dumps(deal)
        # Otherwise: mutual cancellation — both parties call cancel -> refund the client.
        if sender.lower() not in (deal["client"].lower(), deal["freelancer"].lower()):
            raise gl.vm.UserError("only a party to the deal may cancel")
        if deal["status"] not in ("CREATED", "DELIVERED", "DISPUTED", "NEEDS_REVIEW"):
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
        return json.dumps(self._rep_get(address))

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_deals": int(self.total_deals),
            "total_settled": int(self.total_settled),
            "total_disputed": int(self.total_disputed),
        })

    @gl.public.view
    def get_open_deals(self, n: int) -> str:
        # The job board: up to n still-OPEN jobs, most recent first.
        out = []
        i = int(self.total_open) - 1
        while i >= 0 and len(out) < n:
            did = self.open_index.get(str(i), "")
            if did:
                raw = self.deals.get(did, "")
                if raw:
                    d = json.loads(raw)
                    if d.get("status") == "OPEN":
                        out.append(d)
            i -= 1
        return json.dumps(out)

    @gl.public.view
    def get_latest(self, n: int) -> str:
        out = []
        total = int(self.total_settled)
        i = total - 1
        stop = max(-1, total - 1 - n)
        while i > stop:
            did = self.settled_index.get(str(i), "")
            if did:
                raw = self.deals.get(did, "")
                if raw:
                    out.append(json.loads(raw))
            i -= 1
        return json.dumps(out)
