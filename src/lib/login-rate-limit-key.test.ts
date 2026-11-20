import { describe, expect, it } from "vitest";
import { loginRateLimitKey, normalizePhoneForRateLimit } from "./login-rate-limit-key";

describe("login rate-limit key", () => {
  const secret = "unit-test-secret-with-32-bytes-minimum";

  it("normalizes phone punctuation so a user cannot evade the account bucket", () => {
    expect(normalizePhoneForRateLimit("+880 1712-345-678")).toBe("8801712345678");
    expect(loginRateLimitKey("+880 1712-345-678", secret)).toBe(loginRateLimitKey("8801712345678", secret));
  });

  it("stores a fixed-size opaque digest, not the supplied phone value", () => {
    const key = loginRateLimitKey("+8801712345678", secret);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("8801712345678");
    expect(loginRateLimitKey("+8801712345678", "a-different-secret-with-32-bytes")).not.toBe(key);
  });
});
