import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DriveHint } from "@/components/DriveHint";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewLectureForm } from "./NewLectureForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "محاضرة جديدة — محاضراتي" };

type Params = { params: Promise<{ id: string }> };

export default async function NewLecturePage({ params }: Params) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!subject) notFound();

  return (
    <AppShell profile={profile}>
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <Link
            href={`/subjects/${id}`}
            className="text-sm font-semibold text-muted hover:text-ink"
          >
            ← {subject.name}
          </Link>
          <h1 className="mt-3 text-2xl font-bold">محاضرة جديدة</h1>
        </div>

        <div className="mb-5">
          <DriveHint />
        </div>

        <NewLectureForm subjectId={id} />
      </div>
    </AppShell>
  );
}
