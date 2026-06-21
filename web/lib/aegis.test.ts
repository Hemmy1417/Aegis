import { describe, it, expect } from "vitest";
import { genToWei, genFromWei, specHash, shortHash } from "./aegis";

// The escrow amount is real money — these conversions must be exact and safe.
describe("genToWei", () => {
  it("converts whole GEN to wei", () => {
    expect(genToWei("1")).toBe(10n ** 18n);
    expect(genToWei("2")).toBe(2n * 10n ** 18n);
  });

  it("converts fractional GEN without float drift", () => {
    expect(genToWei("1.5")).toBe(1500000000000000000n);
    expect(genToWei("0.0001")).toBe(100000000000000n);
    expect(genToWei("0.000000000000000001")).toBe(1n); // 1 wei
  });

  it("truncates beyond 18 decimals (never over-charges)", () => {
    expect(genToWei("1.0000000000000000009")).toBe(10n ** 18n);
  });

  it("returns 0 for empty, zero, negative, or non-numeric input", () => {
    for (const v of ["", "0", "-1", "abc", "  "]) expect(genToWei(v)).toBe(0n);
  });
});

describe("genFromWei", () => {
  it("formats wei back to GEN", () => {
    expect(genFromWei(10n ** 18n)).toBe("1");
    expect(genFromWei(1500000000000000000n)).toBe("1.5");
    expect(genFromWei("2000000000000000000")).toBe("2");
    expect(genFromWei(0n)).toBe("0");
  });

  it("round-trips with genToWei for typical amounts", () => {
    for (const g of ["1", "2", "0.5", "1.5", "10", "0.25"]) {
      expect(genFromWei(genToWei(g))).toBe(g);
    }
  });

  it("handles empty/invalid wei as 0", () => {
    expect(genFromWei("")).toBe("0");
  });
});

describe("specHash", () => {
  it("is deterministic for the same terms", () => {
    expect(specHash("Deliver a logo.")).toBe(specHash("Deliver a logo."));
  });

  it("ignores surrounding whitespace (both parties verify the same spec)", () => {
    expect(specHash("  Deliver a logo.  ")).toBe(specHash("Deliver a logo."));
  });

  it("differs when the terms differ", () => {
    expect(specHash("Deliver a logo.")).not.toBe(specHash("Deliver two logos."));
  });

  it("returns a 0x keccak digest", () => {
    expect(specHash("x")).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("shortHash", () => {
  it("shortens a hash and is empty-safe", () => {
    expect(shortHash("0x1234567890abcdef")).toBe("0x12345678…cdef");
    expect(shortHash("")).toBe("");
  });
});
