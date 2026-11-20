import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/client";

// Pure Web Crypto session helpers shared by the Next.js proxy and Server Actions.
export interface SessionPayload {
  sub: string;
  role: Role;
  companyId?: string | null;
  name: string;
}

export const SESSION_COOKIE_NAME = "ayaan_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const VALID_ROLES = new Set<Role>([
  "SUPER_ADMIN",
  "OPERATIONS_ADMIN",
  "ACCOUNTS_ADMIN",
  "CLIENT_USER",
  "CAR_OWNER",
  "DRIVER",
]);

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 random characters.");
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
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string" ||
      !VALID_ROLES.has(payload.role as Role) ||
      typeof payload.name !== "string" ||
      (payload.companyId !== undefined && payload.companyId !== null && typeof payload.companyId !== "string") ||
      typeof payload.iat !== "number" || !Number.isInteger(payload.iat) || payload.iat > now + 60 ||
      typeof payload.exp !== "number" || !Number.isInteger(payload.exp) || payload.exp <= now ||
      payload.exp <= payload.iat || payload.exp - payload.iat > SESSION_TTL_SECONDS
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
    return null;
  }
}
