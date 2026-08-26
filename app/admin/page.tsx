import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AssignForm, NewSubjectForm, NewTeacherForm } from "./AdminForms";
import { unassignTeacher } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "الإدارة — محاضراتي" };

type SubjectRow = {
  id: string;
  name: string;
  diploma_id: string;
  diplomas: { name: string } | null;
  subject_teachers: {
    teacher_id: string;
    profiles: { full_name: string; email: string | null } | null;
  }[];
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-6">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const [{ data: diplomas }, { data: subjectData }, { data: teacherData }] =
    await Promise.all([
      supabase.from("diplomas").select("id, name").order("name"),
      supabase
        .from("subjects")
        .select("id, name, diploma_id, diplomas(name), subject_teachers(teacher_id, profiles(full_name, email))")
        .order("name"),
      supabase.from("profiles").select("id, full_name, email").eq("role", "teacher").order("full_name"),
    ]);

  const subjects = (subjectData ?? []) as unknown as SubjectRow[];

  // A diploma maps to exactly one subject, so once it has one there is nothing
  // left to add for it.
  const usedDiplomaIds = new Set(
    subjects.map((subject) => subject.diploma_id).filter(Boolean),
  );
  const availableDiplomas = (diplomas ?? []).filter(
    (diploma) => !usedDiplomaIds.has(diploma.id),
  );
  const teachers = (teacherData ?? []).map((teacher) => ({
    id: teacher.id,
    label: teacher.full_name || teacher.email || teacher.id,
  }));

  return (
    <AppShell profile={profile}>
      <h1 className="mb-6 text-2xl font-bold">الإدارة</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="مادة جديدة">
          <NewSubjectForm diplomas={availableDiplomas} />
        </Card>

        <Card title="حساب مدرّس جديد">
          <NewTeacherForm />
        </Card>

        <Card title="اسند مدرّس على مادة">
          <AssignForm
            subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
            teachers={teachers}
          />
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-bold">المواد ومدرّسيها</h2>

        {subjects.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-6 text-muted">
            لسه مفيش مواد — ابدأ بواحدة من فوق.
          </p>
        ) : (
          <ul className="space-y-3">
            {subjects.map((subject) => (
              <li key={subject.id} className="rounded-2xl border border-line bg-card p-5">
                {subject.diplomas?.name !== subject.name && (
                  <p className="text-sm text-muted">{subject.diplomas?.name}</p>
                )}
                <p className="font-bold">{subject.name}</p>

                {subject.subject_teachers.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">مفيش مدرّس مسند على المادة دي.</p>
                ) : (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {subject.subject_teachers.map((assignment) => (
                      <li key={assignment.teacher_id}>
                        <form action={unassignTeacher} className="flex items-center gap-2 rounded-full bg-sand px-3 py-1.5">
                          <input type="hidden" name="subject_id" value={subject.id} />
                          <input type="hidden" name="teacher_id" value={assignment.teacher_id} />
                          <span className="text-sm">
                            {assignment.profiles?.full_name || assignment.profiles?.email}
                          </span>
                          <button
                            type="submit"
                            aria-label="شيل المدرّس من المادة"
                            className="text-muted transition hover:text-danger"
                          >
                            ✕
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
