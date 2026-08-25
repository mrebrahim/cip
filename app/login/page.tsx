import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "تسجيل الدخول — محاضراتي" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-dark">محاضراتي</h1>
          <p className="mt-2 text-muted">
            حوّل تسجيل المحاضرة وشرائحها لمستند مكتوب.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
