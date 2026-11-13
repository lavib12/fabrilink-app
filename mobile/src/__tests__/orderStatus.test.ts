import {
  allowedNextStatuses,
  canBuyerCancel,
  isValidTransition,
  nextPipelineStatus,
  pipelineProgress,
} from "@/lib/orderStatus";

describe("isValidTransition (mirrors is_valid_transition)", () => {
  it("allows moving forward, including skipping steps", () => {
    expect(isValidTransition("PAID_CREDIT_APPROVED", "PICKUP_SCHEDULED")).toBe(true);
    expect(isValidTransition("PAID_CREDIT_APPROVED", "CUTTING")).toBe(true); // backend test case
    expect(isValidTransition("CUTTING", "PACKED")).toBe(true); // web hub skips CUT_DONE
  });

  it("never moves backwards or stays put", () => {
    expect(isValidTransition("PACKED", "AT_HUB")).toBe(false);
    expect(isValidTransition("CUTTING", "CUTTING")).toBe(false);
  });

  it("only cancels before cutting starts", () => {
    expect(isValidTransition("AT_HUB", "CANCELLED")).toBe(true);
    expect(isValidTransition("CUTTING", "CANCELLED")).toBe(false);
    expect(canBuyerCancel("PICKED_UP")).toBe(true);
    expect(canBuyerCancel("OUT_FOR_DELIVERY")).toBe(false);
  });

  it("supports the dispute / refund branch", () => {
    expect(isValidTransition("DELIVERED", "DISPUTED")).toBe(true);
    expect(isValidTransition("DISPUTED", "REFUNDED")).toBe(true);
    expect(isValidTransition("DISPUTED", "COMPLETED")).toBe(true);
    expect(isValidTransition("CANCELLED", "REFUNDED")).toBe(true);
    expect(isValidTransition("COMPLETED", "REFUNDED")).toBe(false);
  });
});

describe("helpers", () => {
  it("gives the happy-path next step", () => {
    expect(nextPipelineStatus("AT_HUB")).toBe("CUTTING");
    expect(nextPipelineStatus("COMPLETED")).toBeNull();
    expect(nextPipelineStatus("CANCELLED")).toBeNull();
  });

  it("lists every allowed next status", () => {
    expect(allowedNextStatuses("OUT_FOR_DELIVERY")).toEqual(["DELIVERED", "COMPLETED"]);
    expect(allowedNextStatuses("DELIVERED")).toEqual(["COMPLETED", "DISPUTED"]);
    expect(allowedNextStatuses("REFUNDED")).toEqual([]);
  });

  it("computes progress along the pipeline", () => {
    expect(pipelineProgress("COMPLETED")).toBe(1);
    expect(pipelineProgress("CANCELLED")).toBe(0);
  });
});
