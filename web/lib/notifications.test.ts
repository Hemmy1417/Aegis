import { describe, it, expect } from "vitest";
import { deriveNotices, actionCount, type Notice } from "./notifications";
import type { Deal } from "./aegis";

const CLIENT = "0x1111111111111111111111111111111111111111";
const FREELANCER = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";

function deal(over: Partial<Deal>): Deal {
  return {
    id: "d-0", client: CLIENT, freelancer: FREELANCER, amount: "1000000000000000000",
    terms: "x", deliverable_uri: "", status: "CREATED", client_case: "", freelancer_case: "",
    ruling: null, appealed: false, cancel_flags: [], created_seq: 0, ...over,
  };
}

const kinds = (n: Notice[]) => n.map((x) => x.kind);

describe("deriveNotices", () => {
  it("ignores deals where you're not a party", () => {
    expect(deriveNotices([deal({})], OTHER)).toEqual([]);
  });

  it("ignores settled and cancelled deals", () => {
    expect(deriveNotices([deal({ status: "SETTLED" }), deal({ status: "CANCELLED" })], CLIENT)).toEqual([]);
  });

  it("tells the freelancer to deliver on a CREATED deal", () => {
    const n = deriveNotices([deal({ status: "CREATED" })], FREELANCER);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ kind: "action", title: "Deliver your work" });
  });

  it("tells the client to review on a DELIVERED deal", () => {
    const n = deriveNotices([deal({ status: "DELIVERED" })], CLIENT);
    expect(n[0]).toMatchObject({ kind: "action", title: "Review delivered work" });
  });

  it("the freelancer is only waiting on a DELIVERED deal", () => {
    const n = deriveNotices([deal({ status: "DELIVERED" })], FREELANCER);
    expect(n[0].kind).toBe("waiting");
  });

  it("asks for your case in a dispute, then to resolve once both are in", () => {
    const noCase = deriveNotices([deal({ status: "DISPUTED" })], CLIENT);
    expect(noCase[0]).toMatchObject({ kind: "action", title: "Submit your dispute case" });

    const mineOnly = deriveNotices([deal({ status: "DISPUTED", client_case: "c" })], CLIENT);
    expect(mineOnly[0].kind).toBe("waiting");

    const bothIn = deriveNotices([deal({ status: "DISPUTED", client_case: "c", freelancer_case: "f" })], CLIENT);
    expect(bothIn[0]).toMatchObject({ kind: "action", title: "Resolve the dispute" });
  });

  it("flags RULED and NEEDS_REVIEW as actions", () => {
    expect(deriveNotices([deal({ status: "RULED" })], FREELANCER)[0].title).toBe("Finalize the ruling");
    expect(deriveNotices([deal({ status: "NEEDS_REVIEW" })], CLIENT)[0].kind).toBe("action");
  });

  it("sorts action items before waiting items", () => {
    const n = deriveNotices(
      [deal({ id: "d-0", status: "CREATED" }), deal({ id: "d-1", status: "DELIVERED" })],
      CLIENT, // d-0 CREATED -> waiting, d-1 DELIVERED -> action
    );
    expect(kinds(n)).toEqual(["action", "waiting"]);
  });
});

describe("actionCount", () => {
  it("counts only action items", () => {
    const n = deriveNotices(
      [deal({ id: "d-0", status: "DELIVERED" }), deal({ id: "d-1", status: "CREATED" })],
      CLIENT, // one action (review), one waiting (working)
    );
    expect(actionCount(n)).toBe(1);
  });
});
