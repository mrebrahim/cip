/**
 * Every failure a teacher can see is one of these. The message is the finished
 * Arabic sentence shown in the UI: what happened, and what to do next.
 *
 * `isConfig` marks a failure that is the system's fault, not the teacher's.
 * Those are logged with their real detail server-side and shown as a generic
 * "tell the admin" line, because a teacher can do nothing about them.
 */
export type ErrorCode =
  | "invalid_drive_link"
  | "google_native_file"
  | "sharing_locked"
  | "wrong_audio_type"
  | "wrong_slides_type"
  | "drive_api_disabled"
  | "key_restricted"
  | "invalid_key"
  | "drive_auth_missing"
  | "drive_auth_failed"
  | "transcribe_failed"
  | "slides_failed"
  | "document_failed"
  | "unknown";

const MESSAGES: Record<ErrorCode, string> = {
  invalid_drive_link:
    "الرابط ده مش رابط جوجل درايف — انسخ الرابط من زرار (مشاركة) جوه درايف وجرّب تاني.",
  google_native_file:
    "الرابط ده لملف متعمل على جوجل مش ملف مرفوع — ارفع الملف نفسه على درايف وانسخ رابطه.",
  sharing_locked:
    "مشاركة الملف مقفولة أو الرابط غلط — افتح المشاركة على (أي شخص لديه الرابط) وجرّب تاني.",
  wrong_audio_type:
    "الملف ده مش تسجيل صوتي — اتأكد إنك حطيت رابط التسجيل في الخانة الصح.",
  wrong_slides_type:
    "الملف ده مش ملف PDF — اتأكد إنك حطيت رابط الشرائح في الخانة الصح.",
  drive_api_disabled:
    "فيه إعداد ناقص في النظام — كلّم المسؤول وقوله إن قراءة الملفات مش مفعّلة.",
  key_restricted:
    "فيه إعداد ناقص في النظام — كلّم المسؤول وقوله إن الصلاحية محدودة.",
  invalid_key: "فيه إعداد ناقص في النظام — كلّم المسؤول.",
  drive_auth_missing:
    "فيه إعداد ناقص في النظام — كلّم المسؤول وقوله إن صلاحية قراءة الملفات مش متظبطة.",
  drive_auth_failed:
    "مقدرناش نوصل لملفاتك على درايف دلوقتي — جرّب تاني، ولو فضلت اكلّم المسؤول.",
  transcribe_failed:
    "التسجيل مقدرناش نفرّغه — اتأكد إن الملف صوت سليم وجرّب تاني.",
  slides_failed: "الشرائح مقدرناش نقراها — اتأكد إن ملف الـ PDF سليم وجرّب تاني.",
  document_failed: "حصلت مشكلة وإحنا بنكتب المستند — جرّب تاني.",
  unknown: "حصلت مشكلة مش متوقعة — جرّب تاني، ولو فضلت اكلّم المسؤول.",
};

const CONFIG_CODES = new Set<ErrorCode>([
  "drive_api_disabled",
  "key_restricted",
  "invalid_key",
  "drive_auth_missing",
  "drive_auth_failed",
]);

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly detail?: string;

  constructor(code: ErrorCode, detail?: string) {
    super(MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.detail = detail;
  }

  get isConfig() {
    return CONFIG_CODES.has(this.code);
  }
}

export function messageFor(code: ErrorCode) {
  return MESSAGES[code];
}

/** Narrows anything thrown into an AppError so callers always have Arabic text. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  return new AppError("unknown", err instanceof Error ? err.message : String(err));
}
