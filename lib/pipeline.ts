import { createAdminClient } from "./supabase/admin";
import { downloadDriveFile, getDriveFile } from "./drive";
import { buildDocument, extractSlides, transcribeAudio, uploadFile } from "./gemini";
import { AppError, toAppError } from "./errors";
import type { Lecture, LectureStatus } from "./types";

/**
 * The pipeline advances one stage per call.
 *
 * Doing all three in a single request is what pushed a long lecture past the
 * platform's request limit: the server sits waiting on Gemini the whole time,
 * and waiting counts. One stage per request keeps every request short, and
 * costs nothing, because each stage is persisted as it finishes anyway — the
 * next call simply picks up where this one stopped.
 *
 * This does not make the limit disappear. If transcribing a single lecture
 * exceeds it on its own, the work has to become genuinely asynchronous
 * (Gemini's batch mode) rather than merely subdivided.
 */
export async function runNextStage(lectureId: string): Promise<LectureStatus> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("lectures")
    .select("*, subjects(name)")
    .eq("id", lectureId)
    .single();

  if (error || !data) throw new AppError("unknown", `lecture ${lectureId} not found`);

  const lecture = data as Lecture & { subjects: { name: string } | null };
  if (lecture.status === "ready" && lecture.document_md) return "ready";

  // The teacher stopped it. A request already in flight when they pressed stop
  // must not quietly start the next stage.
  if (lecture.status === "stopped") return "stopped";

  const setStage = (status: LectureStatus) =>
    db.from("lectures").update({ status, error_message: null }).eq("id", lectureId);

  try {
    // Claiming the lecture moves stage_updated_at, so a cron pass running at
    // the same moment will not select it as stalled and start a second run.
    await db
      .from("lectures")
      .update({ attempts: lecture.attempts + 1, error_message: null })
      .eq("id", lectureId);

    // Stage 1 — transcribe the recording.
    if (!lecture.transcript) {
      await setStage("transcribing");
      let transcript: string;
      try {
        const meta = await getDriveFile(lecture.audio_file_id);
        const bytes = await downloadDriveFile(lecture.audio_file_id);
        const uri = await uploadFile(bytes, meta.mimeType, meta.name);
        transcript = await transcribeAudio(uri, meta.mimeType);
      } catch (err) {
        throw promote(err, "transcribe_failed");
      }
      await db.from("lectures").update({ transcript }).eq("id", lectureId);
      return "transcribing";
    }

    // Stage 2 — read the slide deck.
    if (!lecture.slides_text) {
      await setStage("reading_slides");
      let slidesText: string;
      try {
        const bytes = await downloadDriveFile(lecture.slides_file_id);
        const uri = await uploadFile(
          bytes,
          "application/pdf",
          lecture.slides_file_name ?? "slides.pdf",
        );
        slidesText = await extractSlides(uri);
      } catch (err) {
        throw promote(err, "slides_failed");
      }
      await db.from("lectures").update({ slides_text: slidesText }).eq("id", lectureId);
      return "reading_slides";
    }

    // Stage 3 — merge the two into the document.
    if (!lecture.document_md) {
      await setStage("building");
      let documentMd: string;
      try {
        documentMd = await buildDocument({
          title: lecture.title,
          subject: lecture.subjects?.name ?? "",
          transcript: lecture.transcript,
          slidesText: lecture.slides_text,
        });
      } catch (err) {
        throw promote(err, "document_failed");
      }
      await db
        .from("lectures")
        .update({ document_md: documentMd, status: "ready", error_message: null })
        .eq("id", lectureId);
      return "ready";
    }

    await setStage("ready");
    return "ready";
  } catch (err) {
    const appError = toAppError(err);
    // A setup problem is logged with its real cause and shown as a generic
    // line, because it is not something the teacher can act on.
    console.error(`[pipeline] lecture ${lectureId} failed`, {
      code: appError.code,
      detail: appError.detail,
    });
    await db
      .from("lectures")
      .update({ status: "failed", error_message: appError.message })
      .eq("id", lectureId);
    throw appError;
  }
}

/**
 * Advances a lecture as far as the remaining time allows.
 *
 * The browser drives one stage per request while the teacher waits. The cron
 * sweep has no browser to drive it, so it runs stages back to back until the
 * lecture is done or its own request budget runs low.
 */
export async function processLecture(
  lectureId: string,
  budgetMs = 200_000,
): Promise<LectureStatus> {
  const deadline = Date.now() + budgetMs;
  let status: LectureStatus = "pending";

  // Four passes covers three stages plus the terminal one; the loop exits on
  // "ready" long before that in practice.
  for (let pass = 0; pass < 4; pass++) {
    status = await runNextStage(lectureId);
    if (status === "ready") break;
    if (Date.now() > deadline) break;
  }

  return status;
}

/**
 * Keeps a precise cause (sharing was revoked mid-run, key misconfigured) and
 * falls back to the stage's own message only for causes we cannot name.
 */
function promote(err: unknown, fallback: "transcribe_failed" | "slides_failed" | "document_failed") {
  const appError = toAppError(err);
  if (appError.code === "unknown") return new AppError(fallback, appError.detail);
  // "too long" and "sharing revoked" are precise and actionable; a generic
  // stage failure would throw that away.
  return appError;
}
