import Link from "next/link";
import { SignOutButton } from "./SignOutButton";
import type { Profile } from "@/lib/types";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4">
          <Link href="/" className="text-lg font-bold text-brand-dark">
            محاضراتي
          </Link>

          <div className="flex items-center gap-1">
            {profile.role === "admin" && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-line/60"
              >
                الإدارة
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
