import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PrimaryLink } from "@/components/Buttons";
import { StatusBadge } from "@/components/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/format";
import type { LectureStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function SubjectPage({ params }: Params) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  // An unassigned subject returns no row under RLS, so it is a 404 here —
  // the same answer a subject that does not exist would give.
  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, diplomas(name)")
    .eq("id", id)
    .maybeSingle();

  if (!subject) notFound();

  const { data: lectures } = await supabase
    .from("lectures")
    .select("id, title, status, created_at")
    .eq("subject_id", id)
    .order("created_at", { ascending: false });

  const diploma = (subject.diplomas as unknown as { name: string } | null)?.name;
  const rows = (lectures ?? []) as {
    id: string;
    title: string;
    status: LectureStatus;
    created_at: string;
  }[];

  return (
    <AppShell profile={profile}>
      <div className="mb-6">
        <Link href="/" className="text-sm font-semibold text-muted hover:text-ink">
          ← كل موادي
        </Link>
        {diploma !== subject.name && (
          <p className="mt-3 text-sm text-muted">{diploma}</p>
        )}
        <h1 className="mt-3 text-2xl font-bold">{subject.name}</h1>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-8 text-center">
          <p className="text-lg font-semibold">لسه مفيش محاضرات هنا</p>
          <p className="mt-2 text-muted">ابدأ بأول محاضرة، مش هتاخد منك دقيقة.</p>
          <div className="mt-6">
            <PrimaryLink href={`/subjects/${id}/new`}>محاضرة جديدة</PrimaryLink>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5">
            <PrimaryLink href={`/subjects/${id}/new`}>محاضرة جديدة</PrimaryLink>
          </div>

          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {rows.map((lecture) => (
              <li key={lecture.id}>
                <Link
                  href={`/lectures/${lecture.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-sand"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{lecture.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {relativeTime(lecture.created_at)}
                    </span>
                  </span>
                  <StatusBadge status={lecture.status} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
