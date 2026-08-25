"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: boolean; message: string };

/**
 * Subjects and assignments are written through the caller's own client, so the
 * admin-only policies in the database are what actually authorise the write.
 * requireAdmin here is for the redirect, not for the permission.
 */
export async function createSubject(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const diplomaId = String(formData.get("diploma_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!diplomaId || !name) return { ok: false, message: "اختار الدبلومة واكتب اسم المادة." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .insert({ diploma_id: diplomaId, name });

  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "المادة دي موجودة بالفعل." : "مقدرناش نضيف المادة.",
    };
  }

  revalidatePath("/admin");
  return { ok: true, message: "المادة اتضافت." };
}

export async function assignTeacher(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const subjectId = String(formData.get("subject_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");

  if (!subjectId || !teacherId) return { ok: false, message: "اختار المادة والمدرّس." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subject_teachers")
    .upsert({ subject_id: subjectId, teacher_id: teacherId });

  if (error) return { ok: false, message: "مقدرناش نسند المادة." };

  revalidatePath("/admin");
  return { ok: true, message: "المدرّس اتسند على المادة." };
}

export async function unassignTeacher(formData: FormData): Promise<void> {
  await requireAdmin();

  const subjectId = String(formData.get("subject_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");

  const supabase = await createClient();
  // Open question 2: removing a teacher only drops the assignment. The
  // lectures stay with the subject, since the subject is what they belong to.
  await supabase
    .from("subject_teachers")
    .delete()
    .eq("subject_id", subjectId)
    .eq("teacher_id", teacherId);

  revalidatePath("/admin");
}

/**
 * There is no self-signup, so the only way an account comes into being is
 * here. Creating an auth user is the one operation that genuinely needs the
 * service role — RLS has nothing to say about auth.users.
 */
export async function createTeacher(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || password.length < 8) {
    return { ok: false, message: "الإيميل مطلوب وكلمة السر 8 حروف على الأقل." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "teacher" },
  });

  if (error) {
    return {
      ok: false,
      message: error.message.toLowerCase().includes("already")
        ? "فيه حساب بالإيميل ده بالفعل."
        : "مقدرناش نعمل الحساب.",
    };
  }

  revalidatePath("/admin");
  return { ok: true, message: "الحساب اتعمل." };
}
