import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateDriveLink, type FileKind } from "@/lib/drive";
import { toAppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Backs the green check beside each field. The teacher learns the link is good
 * while they are still on the form, not fifteen minutes into processing.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجّل دخول." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    link?: string;
    kind?: FileKind;
  };

  if (!body.link || (body.kind !== "audio" && body.kind !== "slides")) {
    return NextResponse.json({ error: "الرابط ناقص." }, { status: 400 });
  }

  try {
    const file = await validateDriveLink(body.link, body.kind);
    return NextResponse.json({ ok: true, name: file.name });
  } catch (err) {
    const appError = toAppError(err);
    if (appError.isConfig) console.error("[validate-link] setup problem", appError.detail);
    return NextResponse.json({ ok: false, error: appError.message });
  }
}
