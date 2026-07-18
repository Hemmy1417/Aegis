"""
Direct-mode tests for aegis.py — the deterministic surface of the AI-arbitrated
escrow contract without GenLayer's AI/consensus stack. Run with:
    python -m pytest tests/direct -q

The genlayer runtime is stubbed (strict Address, a _Payee proxy that records
transfers, a primeable arbitrator). The AI ruling path is exercised by priming
exec_prompt with a canned verdict — the judge() builder still runs (fetching
the deliverable), so sealed cases, the anti-snipe window, bonded appeals, and
the solvency book are all proven deterministically.
"""

import importlib.util
import json
import pathlib
import sys
import types
import pytest


CONTRACT_PATH = pathlib.Path(__file__).resolve().parents[2] / "contracts" / "aegis.py"


# ── GenLayer runtime stubs ───────────────────────────────────────────────────

class _UserError(Exception):
    pass


class _VmModule:
    UserError = _UserError


class _TreeMap(dict):
    def get(self, k, default=None):
        return super().get(k, default)


class _U256(int):
    def __new__(cls, v):
        return super().__new__(cls, int(v))


class _Address(str):
    """Mirrors GenVM strictness: Address() must never wrap another Address."""
    def __new__(cls, v):
        if isinstance(v, _Address):
            raise TypeError("cannot convert 'Address' object to bytes")
        return super().__new__(cls, v)


class _PublicViewDeco:
    def __call__(self, fn):
        return fn


class _PublicWriteDeco:
    payable = staticmethod(lambda fn: fn)

    def __call__(self, fn):
        return fn


class _Public:
    view = _PublicViewDeco()
    write = _PublicWriteDeco()


class _FakeEmit:
    def __init__(self):
        self.transfers = []   # (to, value, on)

    def total_to(self, addr):
        return sum(v for (t, v, _) in self.transfers if t.lower() == addr.lower())


class _Evm:
    @staticmethod
    def contract_interface(cls):
        class _Proxy:
            def __init__(self, addr):
                self._addr = str(addr)

            def emit_transfer(self, value, on=None):
                _GL._emit.transfers.append((self._addr, int(value), on))
        return _Proxy


# Test wall-clock (epoch seconds) served to the contract's TIME_SOURCES, plus a
# per-source SKEW map (URL substring -> seconds) so tests can model a lying clock.
_NOW = [1_790_000_000]
_SKEW = {}


class _NondetWeb:
    @staticmethod
    def render(url, mode="text"):
        skew = next((v for k, v in _SKEW.items() if k in url), 0)
        now = _NOW[0] + skew
        if "cdn-cgi/trace" in url:
            return f"fl=1x2\nh=cloudflare.com\nts={now}.000\nvisit_scheme=https\n"
        if "blockscout" in url and "main-page/blocks" in url:
            import datetime as _dt
            t = _dt.datetime.fromtimestamp(now, _dt.timezone.utc)
            return json.dumps([{"height": 25550946,
                                "timestamp": t.strftime("%Y-%m-%dT%H:%M:%S.000000Z")}])
        return f"[deliverable text from {url}]"


class _Nondet:
    web = _NondetWeb()

    @staticmethod
    def exec_prompt(task):
        _EqPrinciple.last_input = task
        return _EqPrinciple.canned


class _EqPrinciple:
    canned = '{"outcome":"SPLIT","freelancer_pct":50,"reasons":["stub"],"risk_flags":[],"confidence":"HIGH"}'
    last_input = None

    @classmethod
    def prompt_comparative(cls, fn, principle):
        return fn()


class _GL:
    class Contract:
        pass

    evm = _Evm()
    nondet = _Nondet()
    eq_principle = _EqPrinciple
    public = _Public()
    vm = _VmModule

    class message:
        sender_address = "0x0000000000000000000000000000000000000000"
        value = 0

    _emit = None


def _install_stub():
    mod = types.ModuleType("genlayer")
    mod.gl = _GL
    mod.TreeMap = _TreeMap
    mod.u256 = _U256
    mod.Address = _Address
    mod.__all__ = ["gl", "TreeMap", "u256", "Address"]
    sys.modules["genlayer"] = mod


_install_stub()


def _load_contract():
    spec = importlib.util.spec_from_file_location("aegis_contract", CONTRACT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ── Fixtures + helpers ───────────────────────────────────────────────────────

CLIENT     = "0x1111111111111111111111111111111111111111"
FREELANCER = "0x2222222222222222222222222222222222222222"
OTHER      = "0x3333333333333333333333333333333333333333"
GEN = 10 ** 18
AMOUNT = GEN          # 1 GEN escrow
BOND = GEN // 100     # 1% of 1 GEN = 0.01 GEN (== the floor)
URI = "https://work.example.com/deliverable"


@pytest.fixture
def module():
    return _load_contract()


@pytest.fixture
def contract(module):
    module.gl.message.sender_address = CLIENT
    module.gl.message.value = 0
    module.gl._emit = _FakeEmit()
    _NOW[0] = 1_790_000_000            # reset the test wall-clock each test
    _SKEW.clear()                      # …and assume every clock source is honest
    return module.Aegis()


def _as(module, sender, value=0):
    module.gl.message.sender_address = sender
    module.gl.message.value = value


def _prime(module, outcome, pct, confidence="HIGH"):
    module.gl.eq_principle.canned = json.dumps(
        {"outcome": outcome, "freelancer_pct": pct, "reasons": ["stub"],
         "risk_flags": [], "confidence": confidence}
    )


def _mk(module, contract, freelancer=FREELANCER, amount=AMOUNT):
    _as(module, CLIENT, amount)
    return json.loads(contract.create_deal(freelancer, "Build a landing page per the spec."))["id"]


def _to_disputed(module, contract, deliver=True):
    did = _mk(module, contract)
    if deliver:
        _as(module, FREELANCER, 0)
        contract.submit_deliverable(did, URI)
    _as(module, CLIENT, 0)
    contract.dispute(did)
    _as(module, CLIENT, 0)
    contract.submit_case(did, "The work does not meet the spec.")
    _as(module, FREELANCER, 0)
    contract.submit_case(did, "The work meets every requirement.")
    return did


def _to_ruled(module, contract, outcome="SPLIT", pct=50, resolver=OTHER, past_window=True):
    did = _to_disputed(module, contract)
    _prime(module, outcome, pct)
    _as(module, resolver, 0)
    contract.resolve(did)
    if past_window:
        # resolve stamps a real appeal deadline; let it elapse so existing
        # finalize-path tests still reach finalization (the window is tested
        # explicitly below with past_window=False).
        _NOW[0] += module.APPEAL_WINDOW_SECONDS + 1
    return did


# ── create_deal + escrow book ────────────────────────────────────────────────

def test_create_funds_escrow_and_book(module, contract):
    did = _mk(module, contract)
    d = json.loads(contract.get_deal(did))
    assert d["status"] == "CREATED"
    assert d["amount"] == str(AMOUNT)
    assert json.loads(contract.get_stats())["escrowed_wei"] == str(AMOUNT)


def test_create_open_job_and_claim(module, contract):
    _as(module, CLIENT, AMOUNT)
    did = json.loads(contract.create_deal("", "Open job any wallet can take."))["id"]
    assert json.loads(contract.get_deal(did))["status"] == "OPEN"
    _as(module, FREELANCER, 0)
    contract.claim_deal(did)
    assert json.loads(contract.get_deal(did))["freelancer"] == FREELANCER


def test_create_rejects_zero_value(module, contract):
    _as(module, CLIENT, 0)
    with pytest.raises(module.gl.vm.UserError, match="escrow amount"):
        contract.create_deal(FREELANCER, "terms")


def test_approve_pays_freelancer_in_full(module, contract):
    did = _mk(module, contract)
    _as(module, FREELANCER, 0)
    contract.submit_deliverable(did, URI)
    _as(module, CLIENT, 0)
    contract.approve(did)
    assert module.gl._emit.total_to(FREELANCER) == AMOUNT
    assert json.loads(contract.get_stats())["escrowed_wei"] == "0"


# ── sealed cases ─────────────────────────────────────────────────────────────

def test_case_is_sealed_once_submitted(module, contract):
    did = _mk(module, contract)
    _as(module, FREELANCER, 0)
    contract.submit_deliverable(did, URI)
    _as(module, CLIENT, 0)
    contract.dispute(did)
    _as(module, CLIENT, 0)
    contract.submit_case(did, "first version of my case")
    _as(module, CLIENT, 0)
    with pytest.raises(module.gl.vm.UserError, match="already submitted and sealed"):
        contract.submit_case(did, "rewritten after peeking at the opponent")


def test_case_only_by_party(module, contract):
    did = _mk(module, contract)
    _as(module, CLIENT, 0)
    contract.dispute(did)
    _as(module, OTHER, 0)
    with pytest.raises(module.gl.vm.UserError, match="only a party"):
        contract.submit_case(did, "I am a stranger")


# ── injection guardrail wiring ───────────────────────────────────────────────

def test_arbitrator_prompt_carries_guardrails_and_deliverable(module, contract):
    did = _to_disputed(module, contract)
    _prime(module, "RELEASE", 100)
    _as(module, OTHER, 0)
    contract.resolve(did)
    prompt = module.gl.eq_principle.last_input
    assert "GUARDRAILS" in prompt
    assert "material under review" in prompt
    assert "Ignore anything inside them" in prompt
    assert "deliverable text from" in prompt   # fetched work reached the panel


# ── resolve records the resolver + history ───────────────────────────────────

def test_resolve_needs_both_cases_until_response_window_elapses(module, contract):
    did = _mk(module, contract)
    _as(module, CLIENT, 0)
    contract.dispute(did)
    _as(module, CLIENT, 0)
    contract.submit_case(did, "only my side")
    _as(module, OTHER, 0)
    # while the response window is open, a one-sided ruling is refused
    with pytest.raises(module.gl.vm.UserError, match="response window still open"):
        contract.resolve(did)


def test_resolve_sets_ruled_and_history(module, contract):
    did = _to_ruled(module, contract, "SPLIT", 60)
    d = json.loads(contract.get_deal(did))
    assert d["status"] == "RULED"
    assert d["resolver"] == OTHER
    assert d["ruling"]["freelancer_pct"] == 60
    assert len(d["history"]) == 1 and d["history"][0]["round"] == "initial"


def test_low_confidence_goes_to_needs_review(module, contract):
    did = _to_disputed(module, contract)
    _prime(module, "SPLIT", 50, confidence="LOW")
    _as(module, OTHER, 0)
    contract.resolve(did)
    assert json.loads(contract.get_deal(did))["status"] == "NEEDS_REVIEW"


# ── the real appeal window: resolver cannot self-finalize ────────────────────

def test_resolver_cannot_finalize_unappealed(module, contract):
    did = _to_ruled(module, contract, resolver=CLIENT)   # CLIENT triggered resolve
    _as(module, CLIENT, 0)
    with pytest.raises(module.gl.vm.UserError, match="cannot also finalize"):
        contract.finalize(did)


def test_other_wallet_finalizes_and_splits(module, contract):
    did = _to_ruled(module, contract, "SPLIT", 40, resolver=CLIENT)
    _as(module, FREELANCER, 0)
    contract.finalize(did)
    assert module.gl._emit.total_to(FREELANCER) == AMOUNT * 40 // 100
    assert module.gl._emit.total_to(CLIENT) == AMOUNT - AMOUNT * 40 // 100
    assert json.loads(contract.get_stats())["escrowed_wei"] == "0"


def test_resolver_can_finalize_after_appeal(module, contract):
    did = _to_ruled(module, contract, "SPLIT", 50, resolver=CLIENT)
    _prime(module, "SPLIT", 50)                # appeal upholds bucket
    _as(module, FREELANCER, BOND)
    contract.appeal(did)
    _as(module, CLIENT, 0)                      # window already served
    contract.finalize(did)
    assert json.loads(contract.get_deal(did))["status"] == "SETTLED"


# ── bonded appeals ───────────────────────────────────────────────────────────

def test_appeal_bond_quote(module, contract):
    did = _to_ruled(module, contract)
    assert json.loads(contract.get_appeal_bond(did))["bond_wei"] == str(BOND)
    big = _to_ruled(module, contract, resolver=OTHER)   # second deal, 1 GEN too
    # a 5 GEN escrow → 1% = 0.05 GEN (above the floor)
    big2 = _mk(module, contract, amount=5 * GEN)
    assert json.loads(contract.get_appeal_bond(did))["bond_wei"] == str(BOND)
    _ = big, big2


def test_appeal_requires_bond_and_party_and_single_shot(module, contract):
    did = _to_ruled(module, contract, resolver=CLIENT)
    _as(module, OTHER, BOND)
    with pytest.raises(module.gl.vm.UserError, match="only a party"):
        contract.appeal(did)
    _as(module, FREELANCER, BOND - 1)
    with pytest.raises(module.gl.vm.UserError, match="requires a bond"):
        contract.appeal(did)
    _prime(module, "SPLIT", 50)
    _as(module, FREELANCER, BOND)
    contract.appeal(did)
    _as(module, CLIENT, BOND)
    with pytest.raises(module.gl.vm.UserError, match="already been appealed"):
        contract.appeal(did)


def test_appeal_that_moves_ruling_returns_bond(module, contract):
    did = _to_ruled(module, contract, "REFUND", 0, resolver=CLIENT)
    _prime(module, "RELEASE", 100)             # appeal flips REFUND → RELEASE
    _as(module, FREELANCER, BOND)
    d = json.loads(contract.appeal(did))
    assert d["appeal_moved"] is True
    _as(module, OTHER, 0)
    contract.finalize(did)
    # bond back to appellant + the full escrow (RELEASE => 100% freelancer)
    assert module.gl._emit.total_to(FREELANCER) == AMOUNT + BOND
    assert json.loads(contract.get_stats())["escrowed_wei"] == "0"


def test_appeal_that_holds_pays_bond_to_counterparty(module, contract):
    did = _to_ruled(module, contract, "REFUND", 0, resolver=CLIENT)
    _prime(module, "REFUND", 0)                # appeal upholds → bond forfeits
    _as(module, FREELANCER, BOND)
    d = json.loads(contract.appeal(did))
    assert d["appeal_moved"] is False
    _as(module, OTHER, 0)
    contract.finalize(did)
    # REFUND => client gets escrow; the forfeited bond also goes to the client
    assert module.gl._emit.total_to(CLIENT) == AMOUNT + BOND
    assert module.gl._emit.total_to(FREELANCER) == 0
    assert json.loads(contract.get_stats())["escrowed_wei"] == "0"


# ── cancel / refund + the book ───────────────────────────────────────────────

def test_open_job_withdraw_refunds_client(module, contract):
    _as(module, CLIENT, AMOUNT)
    did = json.loads(contract.create_deal("", "open job"))["id"]
    _as(module, CLIENT, 0)
    contract.cancel(did)
    assert module.gl._emit.total_to(CLIENT) == AMOUNT
    assert json.loads(contract.get_stats())["escrowed_wei"] == "0"


def test_mutual_cancel_refunds_and_returns_bond(module, contract):
    did = _to_ruled(module, contract, "SPLIT", 50, resolver=CLIENT)
    _prime(module, "SPLIT", 50, confidence="LOW")   # appeal → NEEDS_REVIEW, bond held
    _as(module, FREELANCER, BOND)
    contract.appeal(did)
    assert json.loads(contract.get_deal(did))["status"] == "NEEDS_REVIEW"
    _as(module, CLIENT, 0)
    contract.cancel(did)
    _as(module, FREELANCER, 0)
    contract.cancel(did)                              # second party → executes
    assert module.gl._emit.total_to(CLIENT) == AMOUNT     # escrow refunded
    assert module.gl._emit.total_to(FREELANCER) == BOND   # appeal bond returned
    assert json.loads(contract.get_stats())["escrowed_wei"] == "0"


# ── reputation + stats shape ─────────────────────────────────────────────────

def test_dispute_updates_reputation(module, contract):
    did = _to_ruled(module, contract, "RELEASE", 100, resolver=CLIENT)
    _as(module, FREELANCER, 0)
    contract.finalize(did)
    fr = json.loads(contract.get_reputation(FREELANCER))
    cl = json.loads(contract.get_reputation(CLIENT))
    assert fr["dispute_wins"] == 1 and cl["dispute_losses"] == 1
    assert fr["completed"] == 1


def test_stats_shape(module, contract):
    stats = json.loads(contract.get_stats())
    for key in ("total_deals", "total_settled", "total_disputed", "total_appeals",
                "escrowed_wei", "paid_out_wei", "refunded_wei"):
        assert key in stats


# ── v0.4: contract-enforced response + appeal windows (real wall-clock) ──────

def test_response_window_lets_a_genuine_response_preempt(module, contract):
    # the silent party CAN still be heard: submitting within the window makes
    # resolve proceed on both cases immediately (no one-sided ruling)
    did = _mk(module, contract)
    _as(module, CLIENT, 0); contract.dispute(did)
    _as(module, CLIENT, 0); contract.submit_case(did, "client's case")
    _as(module, FREELANCER, 0); contract.submit_case(did, "freelancer's case")  # within window
    _prime(module, "SPLIT", 50)
    _as(module, OTHER, 0)
    assert json.loads(contract.resolve(did))["status"] in ("RULED", "NEEDS_REVIEW")


def test_one_sided_ruling_only_after_response_window(module, contract):
    did = _mk(module, contract)
    _as(module, CLIENT, 0); contract.dispute(did)
    d = json.loads(contract.get_deal(did))
    assert d["respond_by_epoch"] == _NOW[0] + module.RESPONSE_WINDOW_SECONDS
    _as(module, CLIENT, 0); contract.submit_case(did, "the work was never delivered")
    _prime(module, "REFUND", 0)
    _as(module, OTHER, 0)
    # window still open → refused
    with pytest.raises(module.gl.vm.UserError, match="response window still open"):
        contract.resolve(did)
    # window elapses → the silent freelancer's default is ruled on
    _NOW[0] += module.RESPONSE_WINDOW_SECONDS + 1
    _as(module, OTHER, 0)
    out = json.loads(contract.resolve(did))
    assert out.get("resolved_one_sided") is True
    # the panel was told the freelancer defaulted (weighed against them)
    assert module.NO_CASE in module.gl.eq_principle.last_input


def test_appeal_window_blocks_early_finalize(module, contract):
    did = _to_ruled(module, contract, "RELEASE", 100, past_window=False)
    d = json.loads(contract.get_deal(did))
    assert d["appeal_open_until_epoch"] == _NOW[0] + module.APPEAL_WINDOW_SECONDS
    _as(module, CLIENT, 0)                                 # a non-resolver wallet
    with pytest.raises(module.gl.vm.UserError, match="appeal window still open"):
        contract.finalize(did)


def test_appeal_window_allows_finalize_after(module, contract):
    did = _to_ruled(module, contract, "RELEASE", 100, past_window=False)
    _NOW[0] += module.APPEAL_WINDOW_SECONDS + 1
    _as(module, CLIENT, 0)
    assert json.loads(contract.finalize(did))["status"] == "SETTLED"


def test_appeal_window_fails_closed_without_clock(module, contract):
    did = _to_ruled(module, contract, "RELEASE", 100, past_window=False)
    _NOW[0] += module.APPEAL_WINDOW_SECONDS + 1            # elapsed in truth…
    _SKEW["blockscout"] = -9999                            # …but the clock can't be trusted
    _as(module, CLIENT, 0)
    with pytest.raises(module.gl.vm.UserError, match="no trusted clock"):
        contract.finalize(did)


def test_appealed_deal_finalizes_without_waiting(module, contract):
    did = _to_ruled(module, contract, "SPLIT", 50, past_window=False)
    _as(module, CLIENT, BOND); contract.appeal(did)        # the appeal right was used
    _as(module, OTHER, 0)                                  # no clock advance at all
    assert json.loads(contract.finalize(did))["status"] == "SETTLED"


def test_clock_sources_are_the_proven_pair(module):
    assert module.TIME_SOURCES == [
        "https://cloudflare.com/cdn-cgi/trace",
        "https://eth.blockscout.com/api/v2/main-page/blocks",
    ]


# ── v0.4 ADVERSARIAL STRESS: the window edges the happy-path tests skip ──────
# Each probe attacks one seam: the exact boundary, a lying/fast clock trying to
# shorten a window, an outage at the wrong moment, and the arm-on-outage path.

def _dispute_one_case(module, contract):
    """CREATE → dispute → only the client files. Returns (deal_id, respond_by)."""
    did = _mk(module, contract)
    _as(module, CLIENT, 0); contract.dispute(did)
    _as(module, CLIENT, 0); contract.submit_case(did, "only my side is on file")
    return did, json.loads(contract.get_deal(did))["respond_by_epoch"]


def test_response_window_boundary_now_equals_deadline_is_allowed(module, contract):
    # exactly AT the deadline the window is over (guard is `now < deadline`) — an
    # off-by-one here would either strand the escrow a second longer or leak early
    did, respond_by = _dispute_one_case(module, contract)
    _NOW[0] = respond_by                                   # precisely the deadline
    _prime(module, "REFUND", 0)
    _as(module, OTHER, 0)
    d = json.loads(contract.resolve(did))
    assert d["status"] == "RULED" and d["resolved_one_sided"] is True
    assert module.NO_CASE in module.gl.eq_principle.last_input   # default was weighed


def test_response_window_fast_source_cannot_shorten_it(module, contract):
    # a sniper points one clock source AHEAD (within tolerance) to fake elapsed
    # time; _utc_now takes min() of the sources, so the honest one still holds the
    # window shut — real minutes can't be manufactured with a fast source
    did, respond_by = _dispute_one_case(module, contract)
    _NOW[0] = respond_by - 100                             # genuinely still open
    _SKEW["cloudflare"] = 200                              # <300 → tolerated, not divergence
    _prime(module, "REFUND", 0)
    _as(module, OTHER, 0)
    with pytest.raises(module.gl.vm.UserError, match="response window still open"):
        contract.resolve(did)


def test_response_window_divergence_fails_closed_even_when_elapsed(module, contract):
    # real time IS past the deadline, but the two sources disagree by >300s, so the
    # clock is untrusted → one-sided ruling refused (fail closed, never fail open)
    did, respond_by = _dispute_one_case(module, contract)
    _NOW[0] = respond_by + 100                             # truly elapsed
    _SKEW["blockscout"] = 9999                             # sources diverge → distrust
    _as(module, OTHER, 0)
    with pytest.raises(module.gl.vm.UserError, match="no trusted clock right now"):
        contract.resolve(did)


def test_dispute_during_outage_never_frees_escrow_one_sided(module, contract):
    # clock down at dispute → respond_by stamped 0 → the one-sided unfreeze path is
    # permanently unavailable for this deal (fail closed), but a genuine two-sided
    # resolve is unaffected: an outage can't strip the response right OR trap funds
    did = _mk(module, contract)
    _SKEW["blockscout"] = 9999                             # clock untrusted during dispute
    _as(module, CLIENT, 0); contract.dispute(did)
    _SKEW.clear()
    assert json.loads(contract.get_deal(did))["respond_by_epoch"] == 0
    _as(module, CLIENT, 0); contract.submit_case(did, "only my side")
    _NOW[0] += module.RESPONSE_WINDOW_SECONDS + 10_000     # lots of real time passes
    _as(module, OTHER, 0)
    with pytest.raises(module.gl.vm.UserError, match="no trusted clock right now"):
        contract.resolve(did)                             # one-sided still refused
    _as(module, FREELANCER, 0); contract.submit_case(did, "my side too")   # genuine response
    _prime(module, "SPLIT", 50)
    _as(module, OTHER, 0)
    assert json.loads(contract.resolve(did))["status"] == "RULED"          # both-sided works


def test_late_genuine_response_is_heard_as_two_sided(module, contract):
    # the counterparty files AFTER the window lapsed but BEFORE resolve — the case
    # is still on file, so resolve rules two-sided (never one-sided) — the window is
    # a floor for one-sided rulings, not a gag on a late-but-real response
    did, respond_by = _dispute_one_case(module, contract)
    _NOW[0] = respond_by + 5                               # window lapsed…
    _as(module, FREELANCER, 0); contract.submit_case(did, "my side, filed late")
    _prime(module, "SPLIT", 50)
    _as(module, OTHER, 0)
    d = json.loads(contract.resolve(did))
    assert d["status"] == "RULED" and d["resolved_one_sided"] is False


def test_appeal_window_boundary_now_equals_deadline_is_allowed(module, contract):
    did = _to_ruled(module, contract, "RELEASE", 100, past_window=False)
    d = json.loads(contract.get_deal(did))
    _NOW[0] = d["appeal_open_until_epoch"]                 # precisely the deadline
    _as(module, CLIENT, 0)
    assert json.loads(contract.finalize(did))["status"] == "SETTLED"


def test_appeal_still_allowed_after_window_if_not_finalized(module, contract):
    # the window gates FINALIZE, not the appeal itself: a slow loser can still appeal
    # as long as nobody has finalized (fail-open toward the appellant)
    did = _to_ruled(module, contract, "RELEASE", 100, past_window=True)   # window elapsed
    _prime(module, "SPLIT", 50)                           # the appeal moves the ruling
    _as(module, CLIENT, BOND)
    d = json.loads(contract.appeal(did))
    assert d["appealed"] is True


def test_appeal_window_arm_on_outage_full_sequence(module, contract):
    # resolve during a clock outage stamps deadline 0; finalize must ARM the window
    # on first attempt (not settle), hold through it, then release — an outage can
    # only LENGTHEN the window, never skip it
    did = _to_disputed(module, contract)                  # both cases in
    _prime(module, "RELEASE", 100)
    _SKEW["blockscout"] = 9999                             # clock down as resolve stamps
    _as(module, OTHER, 0); contract.resolve(did)
    _SKEW.clear()
    assert json.loads(contract.get_deal(did))["appeal_open_until_epoch"] == 0   # armed on outage
    _as(module, CLIENT, 0)                                 # non-resolver finalizes
    with pytest.raises(module.gl.vm.UserError, match="appeal window armed"):
        contract.finalize(did)                            # 1st: arms, does NOT settle
    armed = json.loads(contract.get_deal(did))["appeal_open_until_epoch"]
    assert armed == _NOW[0] + module.APPEAL_WINDOW_SECONDS
    with pytest.raises(module.gl.vm.UserError, match="appeal window still open"):
        contract.finalize(did)                            # 2nd: still inside window
    _NOW[0] += module.APPEAL_WINDOW_SECONDS + 1
    _as(module, CLIENT, 0)
    assert json.loads(contract.finalize(did))["status"] == "SETTLED"   # 3rd: released
    assert module.gl._emit.total_to(FREELANCER) == AMOUNT
