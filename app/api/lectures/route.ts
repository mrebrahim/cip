import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateDriveLink } from "@/lib/drive";
import { AppError, messageFor, toAppError } from "@/lib/errors";

export const runtime = "nodejs";

type Body = {
  subject_id?: string;
  title?: string;
  audio_url?: string;
  slides_url?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجّل دخول." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const title = body.title?.trim();

  if (!body.subject_id || !title || !body.audio_url || !body.slides_url) {
    return NextResponse.json({ error: "املأ كل الخانات الأول." }, { status: 400 });
  }

  // Access is decided by the database, not here: this select returns nothing
  // for a subject the caller is not assigned to, whatever id they send.
  const { data: subject } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", body.subject_id)
    .maybeSingle();

  if (!subject) {
    return NextResponse.json({ error: "المادة دي مش من موادك." }, { status: 403 });
  }

  // Both links are checked before anything is written, so a bad link never
  // leaves a broken lecture behind for the teacher to wonder about.
  let audio, slides;
  try {
    audio = await validateDriveLink(body.audio_url, "audio");
    slides = await validateDriveLink(body.slides_url, "slides");
  } catch (err) {
    const appError = toAppError(err);
    if (appError.isConfig) console.error("[lectures] setup problem", appError.detail);
    return NextResponse.json({ error: appError.message }, { status: 400 });
  }

  const { data: lecture, error } = await supabase
    .from("lectures")
    .insert({
      subject_id: body.subject_id,
      created_by: user.id,
      title,
      audio_url: body.audio_url.trim(),
      audio_file_id: audio.id,
      audio_file_name: audio.name,
      slides_url: body.slides_url.trim(),
      slides_file_id: slides.id,
      slides_file_name: slides.name,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !lecture) {
    console.error("[lectures] insert failed", error);
    return NextResponse.json(
      { error: messageFor("unknown") },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: lecture.id }, { status: 201 });
}
