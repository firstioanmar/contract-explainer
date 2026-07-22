import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { readSessionToken } from "@/lib/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const user = await readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  return Response.json({ user });
}

export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin tidak diizinkan." }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return Response.json({ ok: true });
}
