"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buttonStyles } from "@/components/Buttons";

const FIELD =
  "min-h-12 w-full rounded-xl border border-line bg-card px-4 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setBusy(false);
      setError(
        signInError.message.toLowerCase().includes("invalid")
          ? "الإيميل أو كلمة السر غلط."
          : "مقدرناش ندخّلك دلوقتي — جرّب تاني بعد شوية.",
      );
      return;
    }

    const next = params.get("next");
    router.replace(next && next.startsWith("/") ? next : "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-semibold">
          الإيميل
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={FIELD}
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-semibold">
          كلمة السر
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={FIELD}
          dir="ltr"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={`${buttonStyles.primary} w-full`}>
        {busy ? "بندخّلك…" : "تسجيل الدخول"}
      </button>
    </form>
  );
}
