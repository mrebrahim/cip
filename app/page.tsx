import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PrimaryLink } from "@/components/Buttons";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "موادي — محاضراتي" };

type SubjectRow = {
  id: string;
  name: string;
  diplomas: { name: string } | null;
  lectures: { count: number }[];
};

export default async function SubjectsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // No filter by teacher here on purpose: row level security already returns
  // only the subjects this account holds. Adding a client-side filter would
  // imply the isolation lives in this query, and it does not.
  const { data } = await supabase
    .from("subjects")
    .select("id, name, diplomas(name), lectures(count)")
    .order("name");

  const subjects = (data ?? []) as unknown as SubjectRow[];

  // Nobody should be made to choose from a list of one.
  if (subjects.length === 1 && profile.role !== "admin") {
    redirect(`/subjects/${subjects[0].id}`);
  }

  return (
    <AppShell profile={profile}>
      <h1 className="mb-6 text-2xl font-bold">موادي</h1>

      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-8 text-center">
          <p className="text-lg font-semibold">لسه مفيش مواد مسندة ليك</p>
          <p className="mt-2 text-muted">
            كلّم المسؤول عشان يضيفك على موادك وتبدأ شغل.
          </p>
          {profile.role === "admin" && (
            <div className="mt-6">
              <PrimaryLink href="/admin">افتح الإدارة</PrimaryLink>
            </div>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {subjects.map((subject) => {
            const count = subject.lectures[0]?.count ?? 0;
            return (
              <li key={subject.id}>
                <Link
                  href={`/subjects/${subject.id}`}
                  className="block h-full rounded-2xl border border-line bg-card p-5 transition hover:border-brand hover:shadow-sm"
                >
                  {subject.diplomas?.name !== subject.name && (
                    <p className="text-sm text-muted">{subject.diplomas?.name}</p>
                  )}
                  <p className="mt-1 text-lg font-bold">{subject.name}</p>
                  <p className="mt-3 text-sm text-muted">
                    {count === 0
                      ? "لسه مفيش محاضرات"
                      : count === 1
                        ? "محاضرة واحدة"
                        : count === 2
                          ? "محاضرتين"
                          : `${count} محاضرة`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
