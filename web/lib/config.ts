// Aegis frontend config. Contract address from env; network (Studionet, chain 61999)
// is provided by genlayer-js's `studionet` chain.
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "") as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS);

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-studio.genlayer.com";

export function explorerTxUrl(hash: string): string {
  if (!EXPLORER_URL || !hash) return "";
  return `${EXPLORER_URL.replace(/\/$/, "")}/tx/${hash}`;
}

// Deal status → display label + tone (drives badge colors).
export const STATUS_META: Record<string, { label: string; tone: "neutral" | "active" | "warn" | "good" | "bad" }> = {
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
