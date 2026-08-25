import { createSign } from "node:crypto";
import { AppError } from "./errors";

/**
 * Drive access token, minted from a service account.
 *
 * The original plan was one API key serving both Gemini and Drive. That is not
 * possible: the Drive API rejects API keys outright — "API keys are not
 * supported by this API. Expected OAuth2 access token or other authentication
 * credentials that assert a principal" — and it does so even for a file shared
 * with "Anyone with the link". Drive needs a principal; a key is not one.
 *
 * A service account is a principal, and it can read anyone-with-the-link files
 * just like any signed-in user, so the teacher's side of the flow is unchanged:
 * they still just open sharing and paste the link.
 */

type ServiceAccount = { client_email: string; private_key: string };

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cached: { token: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new AppError(
      "drive_auth_missing",
      "GOOGLE_SERVICE_ACCOUNT_JSON is not set",
    );
  }

  let parsed: ServiceAccount;
  try {
    // Accept both raw JSON and base64, since one-line env vars are easier to
    // paste into a dashboard than a multi-line private key.
    const text = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    parsed = JSON.parse(text) as ServiceAccount;
  } catch {
    throw new AppError("drive_auth_missing", "service account JSON is not parseable");
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new AppError(
      "drive_auth_missing",
      "service account JSON is missing client_email or private_key",
    );
  }

  // Escaped newlines survive most dashboards; a real PEM needs them restored.
  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signedAssertion(account: ServiceAccount) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: expiresAt,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(account.private_key));

  return `${header}.${claims}.${signature}`;
}

/** Cached for its lifetime, so a run does not mint a token per file. */
export async function driveAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const account = serviceAccount();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedAssertion(account),
    }),
  });

  if (!res.ok) {
    throw new AppError("drive_auth_failed", `token endpoint ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new AppError("drive_auth_failed", "token endpoint returned no access_token");
  }

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return cached.token;
}
