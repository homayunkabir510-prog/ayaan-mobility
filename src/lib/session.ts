import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

// Pure, Edge-compatible session token helpers. No `next/headers` import here
// on purpose: `src/middleware.ts` runs on the Edge runtime and can only use
// Web APIs, while Server Actions run on Node and use `next/headers` cookies.
// Both sides import this file to sign/verify the same token shape.

export interface SessionPayload {
  /** User.id */
  sub: string;
  role: Role;
  /** Set only for CLIENT_USER; null/undefined for every other role. */
  companyId?: string | null;
  name: string;
}

const SESSION_COOKIE_NAME = "ayaan_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set a random string of at least 32 characters in .env."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      role: payload.role as Role,
      companyId: (payload.companyId as string | null | undefined) ?? null,
      name: payload.name,
    };
  } catch {
    // Expired, malformed, or signed with a different secret.
    return null;
  }
}

export { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS };
