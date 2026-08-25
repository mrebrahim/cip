"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/components/Buttons";

const FIELD =
  "min-h-12 w-full rounded-xl border border-line bg-card px-4 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; name: string }
  | { state: "bad"; message: string };

/**
 * Each link is checked as soon as it stops changing, so the teacher sees the
 * file name they expect before submitting rather than a failure fifteen
 * minutes into processing.
 */
function useLinkCheck(kind: "audio" | "slides") {
  const [value, setValue] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const requestId = useRef(0);

  useEffect(() => {
    const link = value.trim();
    if (!link) {
      setCheck({ state: "idle" });
      return;
    }

    setCheck({ state: "checking" });
    const id = ++requestId.current;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/validate-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ link, kind }),
        });
        const data = (await res.json()) as { ok?: boolean; name?: string; error?: string };

        // A slower earlier request must not overwrite a newer answer.
        if (id !== requestId.current) return;

        setCheck(
          data.ok
            ? { state: "ok", name: data.name ?? "" }
            : { state: "bad", message: data.error ?? "الرابط ده مش شغال." },
        );
      } catch {
        if (id !== requestId.current) return;
        setCheck({ state: "bad", message: "مقدرناش نتأكد من الرابط — جرّب تاني." });
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [value, kind]);

  return { value, setValue, check };
}

function CheckNote({ check }: { check: Check }) {
  if (check.state === "idle") return null;

  if (check.state === "checking") {
    return <p className="text-sm text-muted">بنتأكد من الرابط…</p>;
  }

  if (check.state === "ok") {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
        <span aria-hidden>✓</span>
        <span className="min-w-0 truncate">{check.name}</span>
      </p>
    );
  }

  return <p className="text-sm font-semibold text-danger">{check.message}</p>;
}

export function NewLectureForm({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const audio = useLinkCheck("audio");
  const slides = useLinkCheck("slides");

  const canSubmit =
    title.trim().length > 0 &&
    audio.check.state === "ok" &&
    slides.check.state === "ok" &&
    !busy;

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!canSubmit) return;

      setBusy(true);
      setError(null);

      try {
        const res = await fetch("/api/lectures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject_id: subjectId,
            title: title.trim(),
            audio_url: audio.value.trim(),
            slides_url: slides.value.trim(),
          }),
        });

        const data = (await res.json()) as { id?: string; error?: string };

        if (!res.ok || !data.id) {
          setError(data.error ?? "مقدرناش نضيف المحاضرة — جرّب تاني.");
          setBusy(false);
          return;
        }

        router.replace(`/lectures/${data.id}`);
      } catch {
        setError("مقدرناش نضيف المحاضرة — جرّب تاني.");
        setBusy(false);
      }
    },
    [canSubmit, subjectId, title, audio.value, slides.value, router],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-semibold">
          عنوان المحاضرة
        </label>
        <input
          id="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={FIELD}
          placeholder="مثلاً: مقدمة عن القلق"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="audio" className="block text-sm font-semibold">
          رابط التسجيل الصوتي
        </label>
        <input
          id="audio"
          required
          dir="ltr"
          inputMode="url"
          value={audio.value}
          onChange={(event) => audio.setValue(event.target.value)}
          className={FIELD}
          placeholder="https://drive.google.com/file/d/..."
        />
        <CheckNote check={audio.check} />
      </div>

      <div className="space-y-2">
        <label htmlFor="slides" className="block text-sm font-semibold">
          رابط الشرائح (PDF)
        </label>
        <input
          id="slides"
          required
          dir="ltr"
          inputMode="url"
          value={slides.value}
          onChange={(event) => slides.setValue(event.target.value)}
          className={FIELD}
          placeholder="https://drive.google.com/file/d/..."
        />
        <CheckNote check={slides.check} />
      </div>

      {error && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={!canSubmit} className={`${buttonStyles.primary} w-full`}>
        {busy ? "بنبدأ…" : "ابدأ التحويل"}
      </button>
    </form>
  );
}
