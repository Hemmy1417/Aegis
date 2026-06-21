# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# Aegis Phase 1 PROBE — its only job is to confirm the contract can RECEIVE native
# GEN (payable) and SEND it back out, and to pin the exact send-API symbol on
# Studionet BEFORE we build the full escrow contract. Throwaway; not the real contract.

from genlayer import *
import json


class EscrowProbe(gl.Contract):
    last_depositor: str
    last_amount: u256

    def __init__(self) -> None:
        self.last_depositor = ""
        self.last_amount = u256(0)

    # 1) Can a contract RECEIVE value? Send some GEN with this call (Studio shows a
    #    "value"/"amount" field for payable methods).
    @gl.public.write.payable
    def deposit(self) -> str:
        self.last_depositor = str(gl.message.sender_address)
        self.last_amount = u256(gl.message.value)
        return json.dumps({"depositor": self.last_depositor, "amount": str(self.last_amount)})

    # 2) Can a contract SEND value back out? This is the line we're verifying.
    @gl.public.write
    def refund(self) -> str:
        if self.last_amount == u256(0):
            raise gl.vm.UserError("nothing to refund")
        to = self.last_depositor
        amount = self.last_amount
        self.last_amount = u256(0)
        # ⚠️ VERIFY-IN-STUDIO — exact send symbol. Best guess first; if Studio errors with
        # "has no attribute 'emit_transfer'" or similar, the message names the right API and
        # we fix this one line. Candidates to try in order:
        #   gl.message.emit_transfer(to, amount)
        #   emit_transfer(to, amount)
        #   gl.emit_transfer(to, amount)
        gl.message.emit_transfer(to, amount)
        return json.dumps({"refunded_to": to, "amount": str(amount)})

    @gl.public.view
    def get_last(self) -> str:
        return json.dumps({"depositor": self.last_depositor, "amount": str(self.last_amount)})
