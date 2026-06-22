// Aegis frontend config. Network is selectable via NEXT_PUBLIC_NETWORK
// ("studionet" | "bradbury"); defaults to studionet, so existing deployments are unchanged.
import { studionet, testnetBradbury } from "genlayer-js/chains";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "studionet").toLowerCase();
export const IS_BRADBURY = NETWORK === "bradbury";
export const CHAIN = IS_BRADBURY ? testnetBradbury : studionet;
export const CHAIN_HEX = ("0x" + CHAIN.id.toString(16)) as `0x${string}`;
export const CHAIN_RPC = CHAIN.rpcUrls.default.http[0];
export const CHAIN_NAME = CHAIN.name;
export const NETWORK_LABEL = IS_BRADBURY ? "Testnet Bradbury" : "Studionet";
// Studionet sponsors gas; Bradbury needs real testnet GEN from a faucet.
export const GAS_SPONSORED = !IS_BRADBURY;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "") as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS);

export const EXPLORER_URL = (
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  (IS_BRADBURY
    ? CHAIN.blockExplorers?.default?.url || "https://explorer-bradbury.genlayer.com"
    : "https://explorer-studio.genlayer.com")
).replace(/\/$/, "");

export function explorerTxUrl(hash: string): string {
  if (!EXPLORER_URL || !hash) return "";
  return `${EXPLORER_URL.replace(/\/$/, "")}/tx/${hash}`;
}

// Deal status → display label + tone (drives badge colors).
export const STATUS_META: Record<string, { label: string; tone: "neutral" | "active" | "warn" | "good" | "bad" }> = {
  OPEN: { label: "Open · awaiting a freelancer", tone: "active" },
  CREATED: { label: "Funded · awaiting work", tone: "active" },
  DELIVERED: { label: "Delivered · awaiting review", tone: "active" },
  DISPUTED: { label: "In dispute", tone: "warn" },
  RULED: { label: "Ruled · awaiting finalize", tone: "active" },
  NEEDS_REVIEW: { label: "Held · needs review", tone: "warn" },
  SETTLED: { label: "Settled", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const OUTCOME_LABEL: Record<string, string> = {
  RELEASE: "Release to freelancer",
  REFUND: "Refund to client",
  SPLIT: "Split",
  UNCLEAR: "Unclear — held",
};
