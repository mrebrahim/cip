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

export function LectureView({
  id,
  title,
  initialStatus,
  initialError,
  documentMd,
}: {
  id: string;
  title: string;
  initialStatus: LectureStatus;
  initialError: string | null;
  documentMd: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<LectureStatus>(initialStatus);
  const [error, setError] = useState<string | null>(initialError);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const kickedOff = useRef(false);

  // A brand new lecture is started by whoever lands on it. A lecture already
  // mid-stage is left alone: the original request is probably still running,
  // and if it died the cron sweep resumes it.
  useEffect(() => {
    if (kickedOff.current || initialStatus !== "pending") return;
    kickedOff.current = true;
    void fetch(`/api/lectures/${id}/process`, { method: "POST" }).catch(() => {});
  }, [id, initialStatus]);

  useEffect(() => {
    if (!isRunning(status)) return;

    const supabase = createClient();
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("lectures")
        .select("status, error_message")
        .eq("id", id)
        .maybeSingle();

      if (!data) return;

      const next = data.status as LectureStatus;
      setError(data.error_message);
      setStatus(next);

      // The document itself is fetched by a server render rather than pulled
      // through the poll, so the poll stays small however long the text is.
      if (next === "ready") router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [id, status, router]);

  async function retry() {
    setRetrying(true);
    setError(null);
    setStatus("pending");
    try {
      await fetch(`/api/lectures/${id}/process`, { method: "POST" });
    } catch {
      // The lecture row carries the outcome either way; the poll will show it.
    }
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
        {/* Honest under either Vercel plan. On Pro the cron sweep resumes a
            dropped run within minutes; on Hobby it may not, so the promise is
            "it will not start over", which is true regardless. */}
        <p className="mt-6 rounded-xl bg-sand px-4 py-3 text-sm text-muted">
          تقدر تقفل الصفحة وترجع بعدين. ولو لقيت التحويل وقف، دوس «جرّب تاني»
          وهيكمّل من مكانه — مش هيبدأ من الأول.
        </p>
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
