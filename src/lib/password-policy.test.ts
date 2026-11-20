import { describe, expect, it } from "vitest";
import { isBcryptPasswordLengthValid } from "./password-policy";

describe("bcrypt password byte policy", () => {
  it("accepts exactly 72 UTF-8 bytes and rejects a longer ASCII password", () => {
    expect(isBcryptPasswordLengthValid("a".repeat(72))).toBe(true);
    expect(isBcryptPasswordLengthValid("a".repeat(73))).toBe(false);
  });

  it("counts UTF-8 bytes rather than JavaScript characters", () => {
    expect(isBcryptPasswordLengthValid("অ".repeat(24))).toBe(true);
    expect(isBcryptPasswordLengthValid("অ".repeat(25))).toBe(false);
  });
});
