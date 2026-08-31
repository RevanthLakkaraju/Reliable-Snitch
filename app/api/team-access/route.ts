import { env } from "cloudflare:workers";
import { json, apiError, database, parseBody, HttpError } from "@/lib/server";
import {
  currentUser,
  sameOrigin,
  accountCookie,
  rateLimit,
  type PortalUser,
} from "@/lib/auth";
import {
  randomToken,
  digest,
  passwordHash,
  equalHash,
  sessionToken,
  SESSION_SECONDS,
} from "@/lib/credentials";
export async function GET(request: Request) {
  try {
    return json({ authenticated: true, user: await currentUser(request) });
  } catch (error) {
    if (error instanceof HttpError && error.status === 401)
      return json({ authenticated: false });
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await parseBody(request);
    if (body.action !== "register" && body.action !== "login")
      throw new HttpError(400, "Choose sign in or create account.");
    const username =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role;
    if (
      !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username) ||
      password.length < 12 ||
      password.length > 128 ||
      !["citizen", "official"].includes(String(role))
    )
      throw new HttpError(
        400,
        "Use a 3–40 character username and a password of 12–128 characters.",
      );
    if (!env.DEMO_SESSION_SECRET)
      throw new HttpError(503, "Account security is not configured.");
    const ip = request.headers.get("cf-connecting-ip") ?? "local";
    await rateLimit("auth-ip:" + ip, 60, 15 * 60000);
    await rateLimit("auth-user:" + username, 12, 15 * 60000);
    // Municipal code is required on EVERY official sign-in and registration.
    if (
      role === "official" &&
      (!env.OFFICIAL_ACCESS_CODE_HASH ||
        typeof body.accessCode !== "string" ||
        body.accessCode.length > 128 ||
        !equalHash(
          await digest(body.accessCode),
          env.OFFICIAL_ACCESS_CODE_HASH,
        ))
    )
      throw new HttpError(
        401,
        "Official credentials or municipal access code are invalid.",
      );
    const db = await database();
    let row = await db
      .prepare(
        "SELECT id,username,name,role,password_hash AS passwordHash,salt FROM portal_users WHERE username=?",
      )
      .bind(username)
      .first<PortalUser & { passwordHash: string; salt: string }>();
    if (body.action === "register") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 80)
        throw new HttpError(400, "Enter a display name of 2–80 characters.");
      await rateLimit("register:" + ip, 15, 3600000);
      if (row)
        throw new HttpError(
          409,
          "That username is unavailable. Choose another or sign in.",
        );
      const salt = randomToken();
      row = {
        id: crypto.randomUUID(),
        username,
        name,
        role: role as PortalUser["role"],
        salt,
        passwordHash: await passwordHash(
          password,
          salt,
          env.DEMO_SESSION_SECRET,
        ),
      };
      const inserted = await db
        .prepare(
          "INSERT OR IGNORE INTO portal_users (id,username,name,role,password_hash,salt,created_at) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(row.id, username, name, role, row.passwordHash, salt, Date.now())
        .run();
      if (!inserted.meta.changes)
        throw new HttpError(
          409,
          "That username is unavailable. Choose another or sign in.",
        );
    } else {
      const candidate = await passwordHash(
        password,
        row?.salt ?? "00000000000000000000000000000000",
        env.DEMO_SESSION_SECRET,
      );
      if (!row || row.role !== role || !equalHash(candidate, row.passwordHash))
        throw new HttpError(
          401,
          "Username, password or municipal access code is invalid.",
        );
    }
    const token = randomToken();
    await db.batch([
      db
        .prepare("DELETE FROM portal_sessions WHERE expires_at<?")
        .bind(Date.now()),
      db
        .prepare(
          "INSERT INTO portal_sessions (token_hash,user_id,expires_at,official_code_hash) VALUES (?,?,?,?)",
        )
        .bind(
          await digest(token),
          row.id,
          Date.now() + SESSION_SECONDS * 1000,
          role === "official" ? env.OFFICIAL_ACCESS_CODE_HASH! : null,
        ),
    ]);
    const response = json({
      authenticated: true,
      user: {
        id: row.id,
        username: row.username,
        name: row.name,
        role: row.role,
      },
    });
    response.headers.set("Set-Cookie", accountCookie(token));
    return response;
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const token = sessionToken(request.headers.get("cookie"));
    if (token)
      await (
        await database()
      )
        .prepare("DELETE FROM portal_sessions WHERE token_hash=?")
        .bind(await digest(token))
        .run();
    const response = json({ ok: true });
    response.headers.set("Set-Cookie", accountCookie("", true));
    return response;
  } catch (error) {
    return apiError(error);
  }
}
