"use client";

// Contract layer for the Aegis frontend.
// READS use an internal read-only client (no wallet needed).
// WRITES take the connected wallet's `client` (from useWallet).
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { keccak256, stringToBytes } from "viem";
import { CONTRACT_ADDRESS, CHAIN } from "./config";

export type Ruling = {
  outcome: string;
  freelancer_pct: number;
  reasons: string[];
  risk_flags: string[];
  confidence: string;
};

export type RulingRound = { round: "initial" | "appeal"; ruling: Ruling };

export type Deal = {
  id: string;
  client: string;
  freelancer: string;
  amount: string; // wei
  terms: string;
  deliverable_uri: string;
  status: string;
  client_case: string;
  freelancer_case: string;
  ruling: Ruling | null;
  history?: RulingRound[];        // every arbitration round, on-chain
  resolver?: string | null;       // who triggered resolve — cannot self-finalize
  appealed: boolean;
  appellant?: string | null;
  appeal_bond?: string;           // wei, held until finalize settles it
  appeal_moved?: boolean;
  cancel_flags?: string[];
  created_seq: number;
  disputant?: string;             // who raised the dispute
  respond_by_epoch?: number;      // enforced response window (unix epoch; 0 = clock was down)
  appeal_open_until_epoch?: number; // enforced appeal window (unix epoch)
  resolved_one_sided?: boolean;   // ruling made after a party defaulted past the window
};

export type Reputation = {
  address: string;
  completed: number;
  dispute_wins: number;
  dispute_losses: number;
  score: number;
  tier: string;
};

export type Stats = {
  total_deals: number;
  total_settled: number;
  total_disputed: number;
  total_appeals?: number;
  escrowed_wei?: string;
  paid_out_wei?: string;
  refunded_wei?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

let _read: Client = null;
function readClient(): Client {
  if (!_read) {
    _read = createClient({ chain: CHAIN, account: createAccount(generatePrivateKey()) });
  }
  return _read;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

// Public testnet RPCs (Bradbury) rate-limit gen_call; retry transient limits with backoff.
async function read(functionName: string, args: unknown[] = []): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      const raw = await readClient().readContract({ address: CONTRACT_ADDRESS, functionName, args });
      return asString(raw);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (i < 3 && /rate limit|429|too many|temporarily/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 700 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

// ---- reads ----
export async function getStats(): Promise<Stats> {
  const raw = await read("get_stats");
  return raw ? JSON.parse(raw) : { total_deals: 0, total_settled: 0, total_disputed: 0 };
}

// The bond (wei) an appeal on this deal currently requires: 1% of escrow, min 0.01 GEN.
export async function getAppealBond(dealId: string): Promise<bigint> {
  const raw = await read("get_appeal_bond", [dealId]);
  return raw ? BigInt(JSON.parse(raw).bond_wei) : 0n;
}

export async function getDeal(dealId: string): Promise<Deal | null> {
  const raw = await read("get_deal", [dealId]);
  return raw ? (JSON.parse(raw) as Deal) : null;
}

export async function getDealsByAddress(address: string): Promise<Deal[]> {
  const raw = await read("get_deals_by_address", [address]);
  return raw ? JSON.parse(raw) : [];
}

export async function getReputation(address: string): Promise<Reputation> {
  const raw = await read("get_reputation", [address]);
  return raw
    ? JSON.parse(raw)
    : { address, completed: 0, dispute_wins: 0, dispute_losses: 0, score: 0, tier: "New" };
}

export async function getLatest(n = 12): Promise<Deal[]> {
  const raw = await read("get_latest", [n]);
  return raw ? JSON.parse(raw) : [];
}

export async function getOpenDeals(n = 24): Promise<Deal[]> {
  const raw = await read("get_open_deals", [n]);
  return raw ? JSON.parse(raw) : [];
}

// ---- writes ----
async function writeAndWait(client: Client, functionName: string, args: unknown[], value?: bigint) {
  const params: Record<string, unknown> = { address: CONTRACT_ADDRESS, functionName, args };
  if (value !== undefined) params.value = value;
  const hash = await client.writeContract(params);
  // Wait for ACCEPTED (state applied), not FINALIZED — on a real testnet (Bradbury) the
  // finalization window can take minutes, while ACCEPTED lands in seconds.
  await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", interval: 4000, retries: 45 });
  return asString(hash);
}

// create_deal is payable — `value` is the escrow, in wei.
export async function createDeal(
  client: Client,
  freelancer: string,
  terms: string,
  valueWei: bigint,
): Promise<string> {
  return writeAndWait(client, "create_deal", [freelancer, terms], valueWei);
}

export async function claimDeal(client: Client, dealId: string): Promise<string> {
  return writeAndWait(client, "claim_deal", [dealId]);
}
export async function submitDeliverable(client: Client, dealId: string, uri: string): Promise<string> {
  return writeAndWait(client, "submit_deliverable", [dealId, uri]);
}
export async function approve(client: Client, dealId: string): Promise<string> {
  return writeAndWait(client, "approve", [dealId]);
}
export async function dispute(client: Client, dealId: string): Promise<string> {
  return writeAndWait(client, "dispute", [dealId]);
}
export async function submitCase(client: Client, dealId: string, statement: string): Promise<string> {
  return writeAndWait(client, "submit_case", [dealId, statement]);
}
export async function resolve(client: Client, dealId: string): Promise<string> {
  return writeAndWait(client, "resolve", [dealId]);
}
// appeal is payable — bondWei must cover getAppealBond's quote.
export async function appeal(client: Client, dealId: string, bondWei: bigint): Promise<string> {
  return writeAndWait(client, "appeal", [dealId], bondWei);
}
export async function finalize(client: Client, dealId: string): Promise<string> {
  return writeAndWait(client, "finalize", [dealId]);
}
export async function cancel(client: Client, dealId: string): Promise<string> {
  return writeAndWait(client, "cancel", [dealId]);
}

// ---- helpers ----
export function genFromWei(wei: string | bigint): string {
  const n = Number(BigInt(wei || "0")) / 1e18;
  return n === 0 ? "0" : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
// Deterministic fingerprint of the locked terms — both parties can verify the same
// spec. The terms are immutable on-chain once the deal exists; this just makes that visible.
export function specHash(terms: string): string {
  try {
    return keccak256(stringToBytes((terms || "").trim()));
  } catch {
    return "";
  }
}
export function shortHash(h: string): string {
  return h ? `${h.slice(0, 10)}…${h.slice(-4)}` : "";
}

export function genToWei(gen: string): bigint {
  const n = Number(gen);
  if (!isFinite(n) || n <= 0) return 0n;
  // avoid float drift: build wei from the decimal string
  const [whole, frac = ""] = gen.trim().split(".");
  const fracPad = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPad || "0");
}
