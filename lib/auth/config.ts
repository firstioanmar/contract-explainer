export const GOOGLE_CLIENT_ID =
  (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  ?? "387808803237-gk557d0gedb718am1p2vdd71ejofitmd.apps.googleusercontent.com").trim();

export const SESSION_COOKIE_NAME = "kontrakjelas_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
