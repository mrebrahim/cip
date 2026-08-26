import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Stops a lecture the teacher no longer wants running.
 *
 * This cannot claw back a call already in flight with Google — that request
 * will finish on its own. What it does is stop anything *further* from being
 * started: the page stops driving the next stage, and the pipeline refuses to
 * begin one. Whatever the in-flight stage produces is still saved, since it has
 * already been paid for and discarding it would only mean redoing it later.
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

  const { data: lecture } = await supabase
    .from("lectures")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!lecture) {
    return NextResponse.json({ error: "المحاضرة دي مش موجودة." }, { status: 404 });
  }
  if (lecture.status === "ready") {
    return NextResponse.json({ error: "المحاضرة خلصت بالفعل." }, { status: 409 });
  }

  await createAdminClient()
    .from("lectures")
    .update({ status: "stopped", error_message: null })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
