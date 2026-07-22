import { OAuth2Client } from "google-auth-library";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  GOOGLE_CLIENT_ID,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/config";
import { createSessionToken } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/types";

export const runtime = "nodejs";

const requestSchema = z.object({ credential: z.string().min(100).max(10_000) });
const googleClient = new OAuth2Client();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin tidak diizinkan." }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Credential Google tidak valid." }, { status: 400 });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return Response.json({ error: "Akun Google belum terverifikasi." }, { status: 401 });
    }

    const user: AuthUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email.split("@")[0],
      picture: payload.picture,
    };
    const token = await createSessionToken(user);
    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return Response.json({ user });
  } catch {
    return Response.json({ error: "Login Google gagal diverifikasi." }, { status: 401 });
  }
}
