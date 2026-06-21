// Client-side indexer: turn a wallet's on-chain deals into an actionable feed.
// Pure + deterministic (no network) — the bell fetches the deals, this decides what
// needs the user's attention. The contract stays the source of truth.
import type { Deal } from "./aegis";

export type Notice = {
  dealId: string;
  kind: "action" | "waiting"; // action = you must do something; waiting = on the other party
  title: string;
  detail: string;
};

export function deriveNotices(deals: Deal[], me: string): Notice[] {
  const a = (me || "").toLowerCase();
  const out: Notice[] = [];

  for (const d of deals) {
    const isClient = d.client.toLowerCase() === a;
    const isFreelancer = !!d.freelancer && d.freelancer.toLowerCase() === a;
    if (!isClient && !isFreelancer) continue;
    const s = d.status;
    if (s === "SETTLED" || s === "CANCELLED") continue;

    if (s === "DISPUTED") {
      const myCaseIn = isClient ? !!d.client_case : !!d.freelancer_case;
      const bothIn = !!d.client_case && !!d.freelancer_case;
      if (!myCaseIn) {
        out.push({ dealId: d.id, kind: "action", title: "Submit your dispute case", detail: `${d.id} is in dispute — make your case before it can be resolved.` });
      } else if (bothIn) {
        out.push({ dealId: d.id, kind: "action", title: "Resolve the dispute", detail: `Both cases are in on ${d.id} — run the AI arbitrator.` });
      } else {
        out.push({ dealId: d.id, kind: "waiting", title: "Waiting on the other party's case", detail: `Your case is in on ${d.id}; waiting for the other side.` });
      }
      continue;
    }
    if (s === "RULED") {
      out.push({ dealId: d.id, kind: "action", title: "Finalize the ruling", detail: `The AI ruled on ${d.id} — finalize to release funds, or appeal.` });
      continue;
    }
    if (s === "NEEDS_REVIEW") {
      out.push({ dealId: d.id, kind: "action", title: "Dispute held for review", detail: `${d.id} was unclear — appeal for another ruling, or cancel.` });
      continue;
    }

    if (isClient) {
      if (s === "DELIVERED") {
        out.push({ dealId: d.id, kind: "action", title: "Review delivered work", detail: `The freelancer delivered on ${d.id} — approve to pay, or dispute.` });
      } else if (s === "OPEN") {
        out.push({ dealId: d.id, kind: "waiting", title: "Job open on the board", detail: `${d.id} is waiting for a freelancer to claim it.` });
      } else if (s === "CREATED") {
        out.push({ dealId: d.id, kind: "waiting", title: "Freelancer is working", detail: `Waiting for delivery on ${d.id}.` });
      }
    } else {
      if (s === "CREATED") {
        out.push({ dealId: d.id, kind: "action", title: "Deliver your work", detail: `You're assigned to ${d.id} — submit your deliverable.` });
      } else if (s === "DELIVERED") {
        out.push({ dealId: d.id, kind: "waiting", title: "Awaiting client review", detail: `You delivered ${d.id}; waiting on the client.` });
      }
    }
  }

  // Action items first, then waiting.
  return out.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "action" ? -1 : 1));
}

export function actionCount(notices: Notice[]): number {
  return notices.filter((n) => n.kind === "action").length;
}
