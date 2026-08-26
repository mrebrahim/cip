"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { buttonStyles } from "@/components/Buttons";
import { createClient } from "@/lib/supabase/client";
import { isRunning } from "@/lib/format";
import type { LectureStatus } from "@/lib/types";
import { StageIndicator } from "./StageIndicator";

const POLL_MS = 4000;

const STUCK_AFTER_MS = 3 * 60_000;

export function LectureView({
  id,
  title,
  initialStatus,
  initialError,
  initialStageSince,
  documentMd,
}: {
  id: string;
  title: string;
  initialStatus: LectureStatus;
  initialError: string | null;
  initialStageSince: string;
  documentMd: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<LectureStatus>(initialStatus);
  const [error, setError] = useState<string | null>(initialError);
  const [retrying, setRetrying] = useState(false);
  const [stageSince, setStageSince] = useState(initialStageSince);
  const [stuck, setStuck] = useState(false);
  const [copied, setCopied] = useState(false);
  const kickedOff = useRef(false);

  // The pipeline advances one stage per request, so the page drives it: call,
  // wait for that stage to land, call again. Each request stays short, which
  // is what keeps a long lecture inside the platform's request limit.
  //
  // A lecture already mid-stage is left alone on load — another request is
  // probably still running it, and driving it again would duplicate the work.
  useEffect(() => {
    if (kickedOff.current || initialStatus !== "pending") return;
    kickedOff.current = true;

    let cancelled = false;

    (async () => {
      // Three stages, plus a little headroom for a stage that reports back
      // without having advanced.
      for (let pass = 0; pass < 5 && !cancelled; pass++) {
        try {
          const res = await fetch(`/api/lectures/${id}/process`, { method: "POST" });
          const data = (await res.json()) as { done?: boolean };
          if (!res.ok || data.done) return;
        } catch {
          // The lecture row carries the outcome; the poll below will show it.
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, initialStatus]);

  useEffect(() => {
    if (!isRunning(status)) return;

    const supabase = createClient();
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("lectures")
        .select("status, error_message, stage_updated_at")
        .eq("id", id)
        .maybeSingle();

      if (!data) return;

      const next = data.status as LectureStatus;
      setError(data.error_message);
      setStatus(next);
      if (data.stage_updated_at) setStageSince(data.stage_updated_at);

      // A run that died without writing anything leaves the stage frozen. The
      // spinner alone would keep implying progress that is not happening.
      setStuck(
        Date.now() - new Date(data.stage_updated_at ?? stageSince).getTime() >
          STUCK_AFTER_MS,
      );

      // The document itself is fetched by a server render rather than pulled
      // through the poll, so the poll stays small however long the text is.
      if (next === "ready") router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [id, status, router]);

  async function drive() {
    for (let pass = 0; pass < 5; pass++) {
      try {
        const res = await fetch(`/api/lectures/${id}/process`, { method: "POST" });
        const data = (await res.json()) as { done?: boolean };
        if (!res.ok || data.done) return;
      } catch {
        return;
      }
    }
  }

  /** The escape hatch: release a frozen lecture, then drive it again. */
  async function restart() {
    setRetrying(true);
    setError(null);
    setStuck(false);
    setStatus("pending");

    try {
      const res = await fetch(`/api/lectures/${id}/reset`, { method: "POST" });
      if (res.ok) await drive();
    } catch {
      // The row carries the outcome; the poll will surface it.
    }

    setRetrying(false);
    router.refresh();
  }

  async function retry() {
    setRetrying(true);
    setError(null);
    setStatus("pending");

    // Resumes from whichever stage last succeeded, not from the beginning.
    await drive();

    setRetrying(false);
    router.refresh();
  }

  async function copyDocument() {
    if (!documentMd) return;
    await navigator.clipboard.writeText(documentMd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (status === "failed") {
    return (
      <div className="rounded-2xl border border-line bg-card p-6">
        <p className="rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger">
          {error ?? "حصلت مشكلة — جرّب تاني."}
        </p>
        <p className="mt-4 text-sm text-muted">
          لو كملنا شغل قبل كده، هنكمل من عند آخر خطوة خلصت مش من الأول.
        </p>
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className={`${buttonStyles.primary} mt-5`}
        >
          {retrying ? "بنجرّب…" : "جرّب تاني"}
        </button>
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div className="rounded-2xl border border-line bg-card p-6">
        <StageIndicator status={status} />
        {stuck ? (
          /* The run died without recording anything, so the stage is frozen.
             Saying so plainly beats a spinner that implies work in progress. */
          <div className="mt-6 rounded-xl bg-warn-soft px-4 py-4">
            <p className="text-sm font-semibold text-warn">
              الخطوة دي واقفة من فترة — على الأغلب التحويل اتقطع.
            </p>
            <button
              type="button"
              onClick={restart}
              disabled={retrying}
              className={`${buttonStyles.primary} mt-4`}
            >
              {retrying ? "بنعيد…" : "أعد التشغيل"}
            </button>
            <p className="mt-3 text-sm text-muted">
              هيكمّل من آخر خطوة خلصت، مش من الأول.
            </p>
          </div>
        ) : (
          <p className="mt-6 rounded-xl bg-sand px-4 py-3 text-sm text-muted">
            تقدر تقفل الصفحة وترجع بعدين. ولو لقيت التحويل وقف، هيظهرلك زرار
            تعيد بيه التشغيل — ومش هيبدأ من الأول.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <a href={`/api/lectures/${id}/export`} className={buttonStyles.primary}>
          نزّل ملف Word
        </a>
        <button type="button" onClick={copyDocument} className={buttonStyles.secondary}>
          {copied ? "اتنسخ ✓" : "انسخ النص"}
        </button>
      </div>

      <article className="rounded-2xl border border-line bg-card p-6 sm:p-8">
        <h2 className="sr-only">{title}</h2>
        {documentMd ? (
          <Markdown source={documentMd} />
        ) : (
          <p className="text-muted">المستند مش موجود.</p>
        )}
      </article>
    </div>
  );
}
