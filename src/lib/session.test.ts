import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { SESSION_TTL_SECONDS, signSession, verifySession } from "./session";

const secret = "unit-test-session-secret-which-is-at-least-32-bytes";
const key = new TextEncoder().encode(secret);
let previousSecret: string | undefined;

beforeEach(() => {
  previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = secret;
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = previousSecret;
});

describe("session token validation", () => {
  it("accepts a normally issued, bounded session", async () => {
    const token = await signSession({ sub: "user-1", role: "DRIVER", name: "Driver" });
    await expect(verifySession(token)).resolves.toMatchObject({ sub: "user-1", role: "DRIVER" });
  });

  it("rejects a correctly signed token with no expiration", async () => {
    const token = await new SignJWT({ sub: "user-1", role: "DRIVER", name: "Driver" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .sign(key);
    await expect(verifySession(token)).resolves.toBeNull();
  });

  it("rejects a correctly signed token whose lifetime exceeds the configured maximum", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: "user-1", role: "DRIVER", name: "Driver" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + SESSION_TTL_SECONDS + 1)
      .sign(key);
    await expect(verifySession(token)).resolves.toBeNull();
  });
});
