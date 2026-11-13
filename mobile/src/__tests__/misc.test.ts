import { toRollQueryParams } from "@/api/endpoints/catalog";
import type { FabricRollListItem, Order, User } from "@/api/types";
import { computeFactoryKpis } from "@/lib/factoryStats";
import { homeRouteFor, needsKyc } from "@/lib/routing";

import bn from "../i18n/bn.json";
import en from "../i18n/en.json";

function flatKeys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatKeys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

describe("translations", () => {
  it("bn and en define exactly the same keys", () => {
    expect(flatKeys(bn).sort()).toEqual(flatKeys(en).sort());
  });
});

describe("toRollQueryParams", () => {
  it("drops empty values and serialises booleans for the backend", () => {
    expect(
      toRollQueryParams({ search: "", mine: true, custom_only: false, max_gsm: 200, category: undefined })
    ).toEqual({ mine: "true", max_gsm: "200" });
  });
});

const user = (role: User["role"], status?: "APPROVED" | "PENDING"): User => ({
  id: "u",
  email: "e",
  phone: "p",
  role,
  is_verified: false,
  is_active: true,
  date_joined: "",
  profile: null,
  company: status
    ? { id: "c", name: "Co", company_type: role === "FACTORY" ? "FACTORY" : "BUYER", verification_status: status, credit_limit: "0" }
    : null,
});

describe("routing", () => {
  it("routes each role to its home", () => {
    expect(homeRouteFor(null)).toBe("/buyer");
    expect(homeRouteFor(user("FACTORY", "APPROVED"))).toBe("/factory");
    expect(homeRouteFor(user("FACTORY", "PENDING"))).toBe("/pending-approval");
    expect(homeRouteFor(user("BUYER", "PENDING"))).toBe("/buyer"); // may browse before KYC
    expect(homeRouteFor(user("HUB_STAFF"))).toBe("/hub");
    expect(homeRouteFor(user("ADMIN"))).toBe("/admin");
  });

  it("only requires KYC for factories and buyers", () => {
    expect(needsKyc(user("BUYER", "PENDING"))).toBe(true);
    expect(needsKyc(user("BUYER", "APPROVED"))).toBe(false);
    expect(needsKyc(user("HUB_STAFF"))).toBe(false);
  });
});

describe("computeFactoryKpis", () => {
  const roll = (status: FabricRollListItem["status"], yards: string) =>
    ({ status, available_yards: yards }) as FabricRollListItem;
  const order = (status: Order["status"], subtotals: string[]) =>
    ({ status, items: subtotals.map((s) => ({ subtotal: s })) }) as unknown as Order;

  it("counts only listed stock and the factory's own non-cancelled line items", () => {
    const k = computeFactoryKpis(
      [roll("ACTIVE", "100"), roll("RESERVED_PARTIAL", "40.5"), roll("SOLD_OUT", "0"), roll("DRAFT", "30")],
      [order("PAID_CREDIT_APPROVED", ["1000", "500"]), order("CANCELLED", ["9999"]), order("DELIVERED", ["250"])]
    );
    expect(k.yardsListed).toBe(140.5);
    expect(k.activeRolls).toBe(2);
    expect(k.grossRevenue).toBe(1750);
    expect(k.netPayout).toBeCloseTo(1645);
    expect(k.awaitingPickup).toBe(1);
    expect(k.completedOrders).toBe(1);
  });
});
