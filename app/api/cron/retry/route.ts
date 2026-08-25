import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processLecture } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 800;

const STALLED_AFTER_MINUTES = 15;
const MAX_PER_RUN = 3;
const MAX_ATTEMPTS = 5;

/**
 * The safety net. If the teacher closes the browser or the request drops, the
 * lecture would otherwise sit in one stage forever. This picks up anything
 * stuck past the threshold and resumes it from its last completed stage.
 *
 * Without this the waiting screen could not honestly tell teachers they may
 * close the page, which is the single biggest source of anxiety in the flow.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized =
    secret && request.headers.get("authorization") === `Bearer ${secret}`;

  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const cutoff = new Date(Date.now() - STALLED_AFTER_MINUTES * 60_000).toISOString();

  const { data: stalled, error } = await db
    .from("lectures")
    .select("id")
    .in("status", ["pending", "transcribing", "reading_slides", "building"])
    .lt("stage_updated_at", cutoff)
    .lt("attempts", MAX_ATTEMPTS)
    .order("stage_updated_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error("[cron] could not list stalled lectures", error);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  const resumed: string[] = [];
  for (const lecture of stalled ?? []) {
    try {
      await processLecture(lecture.id);
      resumed.push(lecture.id);
    } catch {
      // processLecture already recorded the failure on the row; keep sweeping.
    }
  }

  return NextResponse.json({ picked: stalled?.length ?? 0, resumed: resumed.length });
}
