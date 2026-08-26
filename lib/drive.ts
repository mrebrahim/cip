import { AppError } from "./errors";
import { fetchWithTimeout } from "./http";
import { driveAccessToken } from "./google-auth";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
};

export type FileKind = "audio" | "slides";

/**
 * Pulls the file id out of the shapes Drive actually hands people when they
 * click Share or copy from the address bar.
 *
 * A docs.google.com link is deliberately *not* parsed here: those are Docs /
 * Sheets / Slides documents, not uploaded files, and Drive cannot hand their
 * bytes over. Rejecting them by host gives a precise message instead of a
 * confusing download failure later.
 */
export function parseDriveLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new AppError("invalid_drive_link");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new AppError("invalid_drive_link");
  }

  const host = url.hostname.toLowerCase();

  if (host === "docs.google.com") {
    throw new AppError("google_native_file");
  }
  if (host !== "drive.google.com" && host !== "drive.usercontent.google.com") {
    throw new AppError("invalid_drive_link");
  }

  // /file/d/<id>/view  and  /drive/folders style paths
  const pathMatch = url.pathname.match(/\/(?:file|d)\/(?:d\/)?([a-zA-Z0-9_-]{10,})/);
  if (pathMatch) return pathMatch[1];

  // ?id=<id>  (open?id=, uc?id=, download?id=)
  const idParam = url.searchParams.get("id");
  if (idParam && /^[a-zA-Z0-9_-]{10,}$/.test(idParam)) return idParam;

  throw new AppError("invalid_drive_link");
}

/**
 * Under a service account a locked file reads as missing: Drive will not
 * confirm that a file exists to a principal that cannot see it. So a 404 is
 * far more often "sharing is closed" than "this file is gone", and the message
 * has to cover both without guessing wrong.
 *
 * A setup failure (no credentials, bad key, Drive API switched off) is kept
 * distinct, because it is the admin's problem and a teacher can do nothing
 * about it.
 */
function translateDriveError(status: number, body: string): AppError {
  let reason = "";
  let message = "";
  try {
    const parsed = JSON.parse(body);
    reason = parsed?.error?.errors?.[0]?.reason ?? parsed?.error?.status ?? "";
    message = parsed?.error?.message ?? "";
  } catch {
    message = body;
  }

  const haystack = `${reason} ${message}`.toLowerCase();

  if (
    haystack.includes("accessnotconfigured") ||
    haystack.includes("has not been used in project") ||
    haystack.includes("is disabled")
  ) {
    return new AppError("drive_api_disabled", message);
  }
  if (
    haystack.includes("api keys are not supported") ||
    haystack.includes("credentials_missing") ||
    haystack.includes("invalid_grant") ||
    status === 401
  ) {
    return new AppError("drive_auth_failed", message);
  }
  if (haystack.includes("api_key_service_blocked")) {
    return new AppError("key_restricted", message);
  }

  return new AppError("sharing_locked", message);
}

async function authHeaders() {
  return { Authorization: `Bearer ${await driveAccessToken()}` };
}

/** Reads a file's metadata — the cheap check that runs before a lecture row exists. */
export async function getDriveFile(fileId: string): Promise<DriveFile> {
  const url = `${DRIVE_API}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size&supportsAllDrives=true`;
  const res = await fetchWithTimeout(url, {
    headers: await authHeaders(),
    timeoutMs: 30_000,
  });

  if (!res.ok) throw translateDriveError(res.status, await res.text());

  const data = (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
  };

  if (data.mimeType?.startsWith("application/vnd.google-apps.")) {
    throw new AppError("google_native_file", data.mimeType);
  }

  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    size: data.size ? Number(data.size) : null,
  };
}

function assertKind(file: DriveFile, kind: FileKind) {
  if (kind === "audio") {
    // Drive labels m4a/mp4 recordings inconsistently, so a video container
    // counts as audio here — Gemini transcribes both.
    const ok =
      file.mimeType.startsWith("audio/") || file.mimeType.startsWith("video/");
    if (!ok) throw new AppError("wrong_audio_type", file.mimeType);
  } else {
    if (file.mimeType !== "application/pdf") {
      throw new AppError("wrong_slides_type", file.mimeType);
    }
  }
}

/** Parse + fetch metadata + confirm the file is the kind the field expects. */
export async function validateDriveLink(
  link: string,
  kind: FileKind,
): Promise<DriveFile> {
  const fileId = parseDriveLink(link);
  const file = await getDriveFile(fileId);
  assertKind(file, kind);
  return file;
}

/**
 * Downloads the bytes. The file is held in memory only for as long as it takes
 * to hand it to Gemini — nothing about it is ever written to Supabase.
 */
export async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
  const url = `${DRIVE_API}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const res = await fetchWithTimeout(url, {
    headers: await authHeaders(),
    timeoutMs: 120_000,
  });
  if (!res.ok) throw translateDriveError(res.status, await res.text());
  return res.arrayBuffer();
}
