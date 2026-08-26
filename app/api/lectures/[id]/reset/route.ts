import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const STUCK_AFTER_MS = 3 * 60_000;

/**
 * Frees a lecture whose run died without recording anything.
 *
 * A teacher cannot do this themselves: column grants deliberately stop the
 * browser from writing `status`, so the escape hatch has to run server-side.
 * Completed stages are left alone, so this releases the lecture rather than
 * discarding the work already paid for.
 */
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

  // RLS decides visibility: a lecture in someone else's subject is simply absent.
  const { data: lecture } = await supabase
    .from("lectures")
    .select("id, status, stage_updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!lecture) {
    return NextResponse.json({ error: "المحاضرة دي مش موجودة." }, { status: 404 });
  }
  if (lecture.status === "ready") {
    return NextResponse.json({ error: "المحاضرة خلصت بالفعل." }, { status: 409 });
  }

  // Only step in once a stage has genuinely stalled, so a run that is still
  // working is never yanked out from under itself.
  const stalledFor = Date.now() - new Date(lecture.stage_updated_at).getTime();
  if (lecture.status !== "failed" && stalledFor < STUCK_AFTER_MS) {
    return NextResponse.json(
      { error: "التحويل لسه شغال — استنى شوية." },
      { status: 409 },
    );
  }

  await createAdminClient()
    .from("lectures")
    .update({ status: "pending", error_message: null })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
