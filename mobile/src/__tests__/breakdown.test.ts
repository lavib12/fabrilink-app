import { rulerStep } from "@/components/YardRuler";
import { checkBreakdown, maxPartialCut, snapYards } from "@/lib/breakdown";

describe("rulerStep", () => {
  it("keeps the tape to at most ~8 labelled marks", () => {
    expect(rulerStep(5)).toBe(1);
    expect(rulerStep(40)).toBe(5);
    expect(rulerStep(100)).toBe(20);
    expect(rulerStep(150)).toBe(20);
    expect(rulerStep(2000)).toBe(250);
    for (const len of [3, 17, 63, 120, 999, 4000]) {
      expect(len / rulerStep(len)).toBeLessThanOrEqual(8);
    }
  });
});

// Same cases as backend/apps/orders/tests/test_services.py (100 yd roll, 10 yd min cut).
describe("checkBreakdown", () => {
  it("accepts a partial cut that leaves a sellable remnant", () => {
    expect(checkBreakdown(20, 100, 10)).toEqual({ valid: true, issue: null, leftover: 80 });
  });

  it("accepts taking the whole roll", () => {
    expect(checkBreakdown(100, 100, 10)).toMatchObject({ valid: true, leftover: 0 });
  });

  it("rejects cuts below the minimum", () => {
    expect(checkBreakdown(5, 100, 10).issue).toBe("below_min_cut");
  });

  it("rejects cuts larger than the available stock", () => {
    expect(checkBreakdown(120, 100, 10).issue).toBe("exceeds_available");
  });

  it("rejects cuts that leave an unsellable scrap", () => {
    const r = checkBreakdown(95, 100, 10);
    expect(r.issue).toBe("bad_remnant");
    expect(r.leftover).toBe(5);
  });

  it("rejects zero or negative yards", () => {
    expect(checkBreakdown(0, 100, 10).issue).toBe("non_positive");
    expect(checkBreakdown(-3, 100, 10).issue).toBe("non_positive");
  });

  it("treats leftover exactly equal to min cut as valid", () => {
    expect(checkBreakdown(90, 100, 10).valid).toBe(true);
  });

  it("handles decimal stock without float drift", () => {
    expect(checkBreakdown(10.1, 20.2, 10.1).valid).toBe(true);
  });
});

describe("maxPartialCut", () => {
  it("leaves exactly the minimum cut behind", () => {
    expect(maxPartialCut(100, 10)).toBe(90);
  });
  it("returns null when only the whole roll can be taken", () => {
    expect(maxPartialCut(15, 10)).toBeNull();
  });
});

describe("snapYards", () => {
  it("clamps to the available range and snaps to the step", () => {
    expect(snapYards(12.3, 100)).toBe(12.5);
    expect(snapYards(150, 100)).toBe(100);
    expect(snapYards(-4, 100)).toBe(0);
    expect(snapYards(Number.NaN, 100)).toBe(0);
  });
});
