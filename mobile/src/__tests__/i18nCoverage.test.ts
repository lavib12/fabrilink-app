import fs from "fs";
import path from "path";

import en from "../i18n/en.json";

const ROOT = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });
}

function has(obj: unknown, key: string): boolean {
  let node: unknown = obj;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object" || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}

describe("translation coverage", () => {
  it("every static t('…') key used in the app exists in en.json", () => {
    const files = [...sourceFiles(path.join(ROOT, "app")), ...sourceFiles(path.join(ROOT, "src"))];
    const missing: string[] = [];
    for (const file of files) {
      const code = fs.readFileSync(file, "utf8");
      // Only literal keys; template keys like `orderStatus.${s}` are checked by enumerations below.
      for (const m of code.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) {
        const key = m[1] as string;
        // i18next plurals resolve `key` to `key_one` / `key_other`.
        if (!has(en, key) && !has(en, `${key}_other`)) {
          missing.push(`${path.relative(ROOT, file)}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("covers every enum value rendered through a template key", () => {
    const groups: Record<string, string[]> = {
      orderStatus: [
        "DRAFT", "REQUESTED", "QUOTED_CONFIRMED", "PAID_CREDIT_APPROVED", "PICKUP_SCHEDULED", "PICKED_UP",
        "AT_HUB", "CUTTING", "CUT_DONE", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED",
        "CANCELLED", "DISPUTED", "REFUNDED",
      ],
      verification: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
      rollStatus: ["DRAFT", "ACTIVE", "RESERVED_PARTIAL", "SOLD_OUT", "ARCHIVED"],
      grade: ["GRADE_A", "GRADE_B", "SURPLUS_FRESH", "REMNANT"],
      roles: ["BUYER", "FACTORY", "HUB_STAFF", "ADMIN"],
      payment: ["BKASH", "NAGAD", "SSLCOMMERZ", "COD", "B2B_CREDIT"],
      "requests.status": ["OPEN", "FULFILLED", "CLOSED"],
      "breakdown": ["non_positive", "below_min_cut", "exceeds_available", "bad_remnant"],
      "kyc.explain": ["PENDING", "REJECTED", "SUSPENDED", "APPROVED"],
    };
    const missing = Object.entries(groups).flatMap(([prefix, values]) =>
      values.filter((v) => !has(en, `${prefix}.${v}`)).map((v) => `${prefix}.${v}`)
    );
    expect(missing).toEqual([]);
  });
});
