import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processLecture } from "@/lib/pipeline";
import { toAppError } from "@/lib/errors";

export const runtime = "nodejs";
// Fluid Compute must be enabled on Vercel for this to hold: a long lecture
// runs well past the default 60s and would otherwise be cut mid-transcription.
export const maxDuration = 800;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجّل دخول." }, { status: 401 });
  }

  // RLS decides: a lecture in someone else's subject simply is not here.
  const { data: lecture } = await supabase
    .from("lectures")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!lecture) {
    return NextResponse.json({ error: "المحاضرة دي مش موجودة." }, { status: 404 });
  }

  try {
    await processLecture(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // The pipeline has already written the failure onto the lecture row, so the
    // page will show it whether or not the browser is still waiting here.
    return NextResponse.json({ ok: false, error: toAppError(err).message }, { status: 500 });
  }
}
