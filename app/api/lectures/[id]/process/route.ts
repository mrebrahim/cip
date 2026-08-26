import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runNextStage } from "@/lib/pipeline";
import { toAppError } from "@/lib/errors";

export const runtime = "nodejs";
// Fluid Compute must be enabled on Vercel. 300s is the Hobby ceiling; the Pro
// plan allows 800, which is what a two-hour lecture really wants. Raise this
// (and the cron schedule in vercel.json) after upgrading — nothing else needs
// to change, because a cut-off run resumes from its last completed stage.
export const maxDuration = 300;

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
    // One stage per request. The page calls back for the next one, which keeps
    // every request short enough to finish inside the platform's limit.
    const status = await runNextStage(id);
    return NextResponse.json({ ok: true, status, done: status === "ready" });
  } catch (err) {
    // The pipeline has already written the failure onto the lecture row, so the
    // page will show it whether or not the browser is still waiting here.
    return NextResponse.json({ ok: false, error: toAppError(err).message }, { status: 500 });
  }
}
