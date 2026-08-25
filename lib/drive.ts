import { AppError } from "./errors";

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
 * Drive and Gemini share one API key, so a 403 here has two very different
 * causes that are easy to confuse: the key cannot reach the Drive API at all
 * (a setup problem, the admin's to fix), or the file simply is not shared (the
 * teacher's to fix). Diagnosing the wrong one wastes real time, so the reason
 * string decides rather than the status code.
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

  if (haystack.includes("api key not valid") || haystack.includes("api_key_invalid")) {
    return new AppError("invalid_key", message);
  }
  if (
    haystack.includes("accessnotconfigured") ||
    haystack.includes("has not been used in project") ||
    haystack.includes("is disabled")
  ) {
    return new AppError("drive_api_disabled", message);
  }
  if (
    haystack.includes("api_key_service_blocked") ||
    haystack.includes("blocked") ||
    haystack.includes("api_key_http_referrer_blocked")
  ) {
    return new AppError("key_restricted", message);
  }

  // Everything left over is the ordinary case: an API key can only read files
  // shared to "Anyone with the link", so a private file reads as missing.
  if (status === 404) return new AppError("file_not_found", message);
  return new AppError("sharing_locked", message);
}

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AppError("invalid_key", "GEMINI_API_KEY is not set");
  return key;
}

/** Reads a file's metadata — the cheap check that runs before a lecture row exists. */
export async function getDriveFile(fileId: string): Promise<DriveFile> {
  const url = `${DRIVE_API}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size&supportsAllDrives=true&key=${apiKey()}`;
  const res = await fetch(url);

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
  const url = `${DRIVE_API}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true&key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw translateDriveError(res.status, await res.text());
  return res.arrayBuffer();
}
