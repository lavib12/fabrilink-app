import axios from "axios";

import { refreshAccessToken } from "@/api/client";
import { tokenStorage } from "@/api/tokenStorage";
import { singleFlight } from "@/lib/singleFlight";

jest.mock("@/api/tokenStorage", () => {
  let tokens = { access: "old-access", refresh: "refresh-1" };
  return {
    tokenStorage: {
      load: jest.fn(async () => tokens),
      save: jest.fn(async (t: Partial<typeof tokens>) => {
        tokens = { ...tokens, ...t } as typeof tokens;
      }),
      clear: jest.fn(async () => {
        tokens = { access: null as unknown as string, refresh: null as unknown as string };
      }),
    },
  };
});

describe("singleFlight", () => {
  it("shares one call between concurrent callers, then allows a new one", async () => {
    let calls = 0;
    const fn = singleFlight(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    });
    const results = await Promise.all([fn(), fn(), fn(), fn(), fn()]);
    expect(calls).toBe(1);
    expect(results).toEqual([1, 1, 1, 1, 1]);
    await fn();
    expect(calls).toBe(2);
  });

  it("lets the next call retry after a failure", async () => {
    let attempt = 0;
    const fn = singleFlight(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("boom");
      return "ok";
    });
    await expect(fn()).rejects.toThrow("boom");
    await expect(fn()).resolves.toBe("ok");
  });
});

describe("refreshAccessToken", () => {
  it("sends exactly one refresh request for concurrent 401s and stores the rotated token", async () => {
    const post = jest.spyOn(axios, "post").mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { data: { data: { access_token: "new-access", refresh_token: "refresh-2" } } };
    });
    const tokens = await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[1]).toEqual({ refresh: "refresh-1" });
    expect(tokens).toEqual(["new-access", "new-access", "new-access"]);
    expect(tokenStorage.save).toHaveBeenCalledWith({ access: "new-access", refresh: "refresh-2" });
    post.mockRestore();
  });
});
