import { createAdminClient } from "./supabase/admin";
import { downloadDriveFile, getDriveFile } from "./drive";
import { buildDocument, extractSlides, transcribeAudio, uploadFile } from "./gemini";
import { AppError, toAppError } from "./errors";
import type { Lecture, LectureStatus } from "./types";

/**
 * Runs the pipeline for one lecture, resuming from the last stage that was
 * persisted rather than starting over.
 *
 * Each stage is written the moment it completes. That is the whole point: a
 * failure while building the document must not throw away a two-hour
 * transcription and the API call that produced it.
 */
export async function processLecture(lectureId: string): Promise<void> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("lectures")
    .select("*, subjects(name)")
    .eq("id", lectureId)
    .single();

  if (error || !data) throw new AppError("unknown", `lecture ${lectureId} not found`);

  const lecture = data as Lecture & { subjects: { name: string } | null };
  if (lecture.status === "ready" && lecture.document_md) return;

  const setStage = async (status: LectureStatus) => {
    await db
      .from("lectures")
      .update({ status, error_message: null })
      .eq("id", lectureId);
  };

  try {
    // Claiming the lecture moves stage_updated_at, so a cron pass running at
    // the same moment will not select it as stalled and start a second run.
    await db
      .from("lectures")
      .update({ attempts: lecture.attempts + 1, error_message: null })
      .eq("id", lectureId);

    // Stage 1 — transcribe the recording.
    let transcript = lecture.transcript;
    if (!transcript) {
      await setStage("transcribing");
      try {
        const meta = await getDriveFile(lecture.audio_file_id);
        const bytes = await downloadDriveFile(lecture.audio_file_id);
        const uri = await uploadFile(bytes, meta.mimeType, meta.name);
        transcript = await transcribeAudio(uri, meta.mimeType);
      } catch (err) {
        throw promote(err, "transcribe_failed");
      }
      await db.from("lectures").update({ transcript }).eq("id", lectureId);
    }

    // Stage 2 — read the slide deck.
    let slidesText = lecture.slides_text;
    if (!slidesText) {
      await setStage("reading_slides");
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
    }

    // Stage 3 — merge the two into the document.
    if (!lecture.document_md) {
      await setStage("building");
      let documentMd: string;
      try {
        documentMd = await buildDocument({
          title: lecture.title,
          subject: lecture.subjects?.name ?? "",
          transcript,
          slidesText,
        });
      } catch (err) {
        throw promote(err, "document_failed");
      }
      await db
        .from("lectures")
        .update({ document_md: documentMd, status: "ready", error_message: null })
        .eq("id", lectureId);
      return;
    }

    await setStage("ready");
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
 * Keeps a precise cause (sharing was revoked mid-run, key misconfigured) and
 * falls back to the stage's own message only for causes we cannot name.
 */
function promote(err: unknown, fallback: "transcribe_failed" | "slides_failed" | "document_failed") {
  const appError = toAppError(err);
  if (appError.code === "unknown") return new AppError(fallback, appError.detail);
  return appError;
}
