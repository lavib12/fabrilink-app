import { estimateFees, roundHalfEven2 } from "@/lib/pricing";

describe("estimateFees (mirrors calculate_order_fees)", () => {
  it("matches the backend for 20 yd at ৳200", () => {
    expect(estimateFees([{ yards: 20, pricePerYard: 200 }])).toEqual({
      fabric: 4000,
      commission: 240,
      cutting: 250, // 150 + 20 × 5
      delivery: 120,
      vat: 73.5, // (240 + 250) × 0.15
      total: 4683.5,
    });
  });

  it("sums several lines and charges one delivery", () => {
    const fees = estimateFees([
      { yards: 10, pricePerYard: 250 },
      { yards: 15.5, pricePerYard: 320 },
    ]);
    expect(fees.fabric).toBe(7460);
    expect(fees.cutting).toBe(277.5);
    expect(fees.delivery).toBe(120);
    expect(fees.total).toBe(
      roundHalfEven2(fees.fabric + fees.commission + fees.cutting + fees.delivery + fees.vat)
    );
  });

  it("is all zeros for an empty selection", () => {
    expect(estimateFees([]).total).toBe(0);
    expect(estimateFees([{ yards: 0, pricePerYard: 200 }]).total).toBe(0);
  });
});

describe("roundHalfEven2 (Python Decimal default rounding)", () => {
  it.each([
    [0.125, 0.12],
    [0.135, 0.14],
    [2.675, 2.68],
    [1.005, 1.0],
    [73.5, 73.5],
    [10.004, 10.0],
    [10.006, 10.01],
  ])("%p -> %p", (input, expected) => {
    expect(roundHalfEven2(input)).toBeCloseTo(expected, 10);
  });
});
