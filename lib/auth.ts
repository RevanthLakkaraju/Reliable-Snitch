import { env } from "cloudflare:workers";
import { database, HttpError } from "./server";
import {
  ACCOUNT_COOKIE,
  SESSION_SECONDS,
  digest,
  sessionToken,
} from "./credentials";
export type PortalUser = {
  id: string;
  username: string;
  name: string;
  role: "citizen" | "official";
};
export async function currentUser(request: Request): Promise<PortalUser> {
  const token = sessionToken(request.headers.get("cookie"));
  if (!token)
    throw new HttpError(401, "Sign in to your citizen or municipal account.");
  const db = await database();
  const user = await db
    .prepare(
      `SELECT u.id,u.username,u.name,u.role,s.official_code_hash AS codeHash FROM portal_sessions s JOIN portal_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`,
    )
    .bind(await digest(token), Date.now())
    .first<PortalUser & { codeHash: string | null }>();
  if (
    !user ||
    (user.role === "official" &&
      (!env.OFFICIAL_ACCESS_CODE_HASH ||
        user.codeHash !== env.OFFICIAL_ACCESS_CODE_HASH))
  )
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  };
}
export async function requireRole(request: Request, role: PortalUser["role"]) {
  const user = await currentUser(request);
  if (user.role !== role)
    throw new HttpError(
      403,
      role === "official"
        ? "This service is restricted to municipal officials."
        : "Use a citizen account to submit or contribute to a complaint.",
    );
  return user;
}
export function sameOrigin(request: Request) {
  const origin = env.SITE_ORIGIN
    ? new URL(env.SITE_ORIGIN).origin
    : import.meta.env.DEV
      ? new URL(request.url).origin
      : null;
  if (
    !origin ||
    request.headers.get("origin") !== origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "This request must come from the portal.");
}
export function accountCookie(token: string, clear = false) {
  return `${ACCOUNT_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_SECONDS}`;
}
export async function rateLimit(
  key: string,
  maximum: number,
  periodMs: number,
) {
  const db = await database(),
    now = Date.now();
  const result = await db
    .prepare(
      `INSERT INTO portal_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END RETURNING count`,
    )
    .bind(await digest(key), now + periodMs, now, now)
    .first<{ count: number }>();
  if ((result?.count ?? maximum + 1) > maximum)
    throw new HttpError(
      429,
      "Too many attempts. Please wait a few minutes before trying again.",
    );
}
