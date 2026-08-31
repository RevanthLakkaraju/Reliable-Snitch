import { existsSync, writeFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
if (existsSync(".env") || existsSync("LOCAL-ACCESS.private.txt"))
  throw new Error(
    "Local security files already exist. They were not changed. Keep the account-security secret.",
  );
const code = "MUNI-" + randomBytes(18).toString("base64url");
const pepper = randomBytes(32).toString("base64url");
writeFileSync(
  ".env",
  `SITE_ORIGIN=http://localhost:3000\nDEMO_SESSION_SECRET=${pepper}\nOFFICIAL_ACCESS_CODE_HASH=${createHash("sha256").update(code).digest("hex")}\n`,
  { flag: "wx", mode: 0o600 },
);
writeFileSync(
  "LOCAL-ACCESS.private.txt",
  `LOCAL DEMO ONLY — KEEP PRIVATE\nMunicipal access code: ${code}\n\nSelect Municipal official, create your unique account, and enter this code. You need your own username/password AND this code on each sign-in. Citizen accounts do not need the code. This code is not valid on the hosted website.\n`,
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Local security configured. Your local municipal code is in LOCAL-ACCESS.private.txt (Git-ignored). Start with pnpm dev.",
);
