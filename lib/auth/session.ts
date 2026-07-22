import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/config";
import type { AuthUser } from "@/lib/auth/types";

function getSessionKey() {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  if (!secret) throw new Error("AUTH_SECRET belum dikonfigurasi.");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: AuthUser) {
  return new SignJWT({ email: user.email, name: user.name, picture: user.picture })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionKey());
}

export async function readSessionToken(token?: string): Promise<AuthUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionKey());
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string") return null;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}
