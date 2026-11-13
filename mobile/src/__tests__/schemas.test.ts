import { loginSchema, registerSchema, rollSchema } from "@/lib/schemas";

const validRoll = {
  mode: "PUBLIC" as const,
  title: "Combed cotton jersey",
  fabric_type: "ft-1",
  composition: "100% Cotton",
  gsm: "180",
  width_inches: "60",
  color_name: "Navy",
  color_hex: "#000080",
  quality_grade: "GRADE_A" as const,
  total_yards: "100",
  min_cut_length_yards: "10",
  price_per_yard: "250",
};

describe("registerSchema", () => {
  const base = {
    role: "BUYER" as const,
    company_name: "Dhaka Trendz",
    email: "a@b.com",
    password: "longenough",
  };

  it.each(["01711223344", "8801711223344", "+8801711223344", "017-1122 3344"])("accepts BD phone %p", (phone) => {
    expect(registerSchema.safeParse({ ...base, phone }).success).toBe(true);
  });

  it.each(["01211223344", "1711223344", "+1 555 0100"])("rejects %p", (phone) => {
    expect(registerSchema.safeParse({ ...base, phone }).success).toBe(false);
  });

  it("strips spaces and dashes from the phone", () => {
    const parsed = registerSchema.parse({ ...base, phone: "017-1122 3344" });
    expect(parsed.phone).toBe("01711223344");
  });

  it("requires 8+ character passwords", () => {
    expect(registerSchema.safeParse({ ...base, phone: "01711223344", password: "short" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires a valid email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
});

describe("rollSchema", () => {
  it("accepts a valid public listing", () => {
    expect(rollSchema.safeParse(validRoll).success).toBe(true);
  });

  it("requires a target buyer for custom profiles", () => {
    const r = rollSchema.safeParse({ ...validRoll, mode: "CUSTOM" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["target_buyer_id"]);
  });

  it("rejects non-positive numbers and bad hex", () => {
    expect(rollSchema.safeParse({ ...validRoll, price_per_yard: "0" }).success).toBe(false);
    expect(rollSchema.safeParse({ ...validRoll, gsm: "abc" }).success).toBe(false);
    expect(rollSchema.safeParse({ ...validRoll, color_hex: "#12345" }).success).toBe(false);
  });

  it("rejects a minimum cut larger than the roll", () => {
    expect(rollSchema.safeParse({ ...validRoll, min_cut_length_yards: "150" }).success).toBe(false);
  });

  it("only allows http(s) image URLs", () => {
    expect(rollSchema.safeParse({ ...validRoll, image_url: "javascript:alert(1)" }).success).toBe(false);
    expect(rollSchema.safeParse({ ...validRoll, image_url: "https://example.com/a.jpg" }).success).toBe(true);
  });
});
