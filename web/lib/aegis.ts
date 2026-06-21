"use client";

// Contract layer for the Aegis frontend.
// READS use an internal read-only client (no wallet needed).
// WRITES take the connected wallet's `client` (from useWallet).
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { CONTRACT_ADDRESS } from "./config";

export type Ruling = {
  outcome: string;
  freelancer_pct: number;
  reasons: string[];
  risk_flags: string[];
  confidence: string;
};

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
  appealed: boolean;
  cancel_flags?: string[];
  created_seq: number;
};

export type Reputation = {
  address: string;
  completed: number;
  dispute_wins: number;
  dispute_losses: number;
  score: number;
  tier: string;
};

export type Stats = { total_deals: number; total_settled: number; total_disputed: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

let _read: Client = null;
function readClient(): Client {
  if (!_read) {
    _read = createClient({ chain: studionet, account: createAccount(generatePrivateKey()) });
  }
  return _read;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

async function read(functionName: string, args: unknown[] = []): Promise<string> {
  const raw = await readClient().readContract({ address: CONTRACT_ADDRESS, functionName, args });
  return asString(raw);
}

// ---- reads ----
export async function getStats(): Promise<Stats> {
  const raw = await read("get_stats");
  return raw ? JSON.parse(raw) : { total_deals: 0, total_settled: 0, total_disputed: 0 };
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

// ---- writes ----
async function writeAndWait(client: Client, functionName: string, args: unknown[], value?: bigint) {
  const params: Record<string, unknown> = { address: CONTRACT_ADDRESS, functionName, args };
  if (value !== undefined) params.value = value;
  const hash = await client.writeContract(params);
  await client.waitForTransactionReceipt({ hash, status: "FINALIZED", interval: 5000, retries: 60 });
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
export async function appeal(client: Client, dealId: string): Promise<string> {
  return writeAndWait(client, "appeal", [dealId]);
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
export function genToWei(gen: string): bigint {
  const n = Number(gen);
  if (!isFinite(n) || n <= 0) return 0n;
  // avoid float drift: build wei from the decimal string
  const [whole, frac = ""] = gen.trim().split(".");
  const fracPad = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPad || "0");
}
