import type { TrackingEvent } from "../api/types";
import { describeEvent } from "../components/orders";

const t = (k: string) => k;
const ev = (over: Partial<TrackingEvent>): TrackingEvent =>
  ({ id: "1", from_status: "AT_HUB", to_status: "CUTTING", title: "x", description: "", location: "", created_at: "", ...over }) as TrackingEvent;

describe("tracking wording", () => {
  it("replaces old technical text with a plain step", () => {
    const d = describeEvent(ev({ title: "Precision Machine Cutting in Progress", description: "Order transitioned from AT_HUB to CUTTING." }), t);
    expect(d).toEqual({ title: "track.CUTTING.title", body: "track.CUTTING.body", note: "" });
  });

  it("keeps a real note from staff or the buyer", () => {
    const d = describeEvent(ev({ to_status: "CANCELLED", from_status: "PAID_CREDIT_APPROVED", description: "Wrong colour ordered" }), t);
    expect(d.title).toBe("track.CANCELLED.title");
    expect(d.note).toBe("Wrong colour ordered");
  });

  it("names placing, payment checks and payment confirmation", () => {
    expect(describeEvent(ev({ from_status: "DRAFT", to_status: "REQUESTED" }), t).title).toBe("track.placedAwaiting.title");
    expect(describeEvent(ev({ from_status: "DRAFT", to_status: "PAID_CREDIT_APPROVED" }), t).title).toBe("track.placedPaid.title");
    expect(describeEvent(ev({ from_status: "REQUESTED", to_status: "REQUESTED", title: "Payment details submitted" }), t).title).toBe("track.paymentSent.title");
    const confirmed = describeEvent(ev({ from_status: "REQUESTED", to_status: "PAID_CREDIT_APPROVED", description: "bKash payment X verified." }), t);
    expect(confirmed).toEqual({ title: "track.paymentConfirmed.title", body: "track.paymentConfirmed.body", note: "" });
    const rejected = describeEvent(ev({ from_status: "REQUESTED", to_status: "REQUESTED", title: "Payment not confirmed", description: "No such TrxID" }), t);
    expect(rejected.note).toBe("No such TrxID");
  });
});
