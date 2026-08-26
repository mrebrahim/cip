import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/format";
import type { LectureStatus } from "@/lib/types";
import { LectureView } from "./LectureView";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function LecturePage({ params }: Params) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: lecture } = await supabase
    .from("lectures")
    .select(
      "id, title, status, error_message, document_md, created_at, stage_updated_at, subject_id, subjects(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!lecture) notFound();

  const subjectName = (lecture.subjects as unknown as { name: string } | null)?.name;

  return (
    <AppShell profile={profile}>
      <div className="mb-6">
        <Link
          href={`/subjects/${lecture.subject_id}`}
          className="text-sm font-semibold text-muted hover:text-ink"
        >
          ← {subjectName}
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{lecture.title}</h1>
          <StatusBadge status={lecture.status as LectureStatus} />
        </div>

        <p className="mt-1 text-sm text-muted">{relativeTime(lecture.created_at)}</p>
      </div>

      <LectureView
        id={lecture.id}
        title={lecture.title}
        initialStatus={lecture.status as LectureStatus}
        initialError={lecture.error_message}
        initialStageSince={lecture.stage_updated_at}
        documentMd={lecture.document_md}
      />
    </AppShell>
  );
}
