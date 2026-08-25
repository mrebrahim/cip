"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { buttonStyles } from "@/components/Buttons";
import {
  assignTeacher,
  createSubject,
  createTeacher,
  type ActionResult,
} from "./actions";

const FIELD =
  "min-h-12 w-full rounded-xl border border-line bg-card px-4 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonStyles.primary}>
      {pending ? "لحظة…" : label}
    </button>
  );
}

function Note({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      className={`rounded-xl px-4 py-3 text-sm font-semibold ${
        result.ok ? "bg-brand-soft text-brand-dark" : "bg-danger-soft text-danger"
      }`}
    >
      {result.message}
    </p>
  );
}

export function NewSubjectForm({ diplomas }: { diplomas: { id: string; name: string }[] }) {
  const [result, action] = useActionState(createSubject, null);

  return (
    <form action={action} className="space-y-3">
      <select name="diploma_id" required className={FIELD} defaultValue="">
        <option value="" disabled>
          اختار الدبلومة
        </option>
        {diplomas.map((diploma) => (
          <option key={diploma.id} value={diploma.id}>
            {diploma.name}
          </option>
        ))}
      </select>

      <input name="name" required placeholder="اسم المادة" className={FIELD} />
      <Note result={result} />
      <Submit label="ضيف المادة" />
    </form>
  );
}

export function NewTeacherForm() {
  const [result, action] = useActionState(createTeacher, null);

  return (
    <form action={action} className="space-y-3">
      <input name="full_name" placeholder="الاسم" className={FIELD} />
      <input
        name="email"
        type="email"
        required
        dir="ltr"
        placeholder="الإيميل"
        className={FIELD}
      />
      <input
        name="password"
        type="text"
        required
        minLength={8}
        dir="ltr"
        placeholder="كلمة السر (8 حروف على الأقل)"
        className={FIELD}
      />
      <Note result={result} />
      <Submit label="اعمل الحساب" />
    </form>
  );
}

export function AssignForm({
  subjects,
  teachers,
}: {
  subjects: { id: string; name: string }[];
  teachers: { id: string; label: string }[];
}) {
  const [result, action] = useActionState(assignTeacher, null);

  return (
    <form action={action} className="space-y-3">
      <select name="subject_id" required className={FIELD} defaultValue="">
        <option value="" disabled>
          اختار المادة
        </option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </select>

      <select name="teacher_id" required className={FIELD} defaultValue="">
        <option value="" disabled>
          اختار المدرّس
        </option>
        {teachers.map((teacher) => (
          <option key={teacher.id} value={teacher.id}>
            {teacher.label}
          </option>
        ))}
      </select>

      <Note result={result} />
      <Submit label="اسند المادة" />
    </form>
  );
}
