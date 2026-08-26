import type { LectureStatus } from "./types";

/**
 * Arabic plurals do not map onto "1 vs many": there is a dual, a small plural
 * for 3–10, and a singular again above that. Getting this wrong is the kind of
 * detail that makes an interface feel machine-written.
 */
function arabicCount(n: number, forms: [string, string, string, string]) {
  const [one, two, few, many] = forms;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** Relative time for recency, Gregorian date once that stops being useful. */
export function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);

  if (seconds < 60) return "دلوقتي";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `من ${arabicCount(minutes, ["دقيقة", "دقيقتين", "دقايق", "دقيقة"])}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `من ${arabicCount(hours, ["ساعة", "ساعتين", "ساعات", "ساعة"])}`;
  }

  const days = Math.floor(hours / 24);
  if (days <= 30) {
    return `من ${arabicCount(days, ["يوم", "يومين", "أيام", "يوم"])}`;
  }

  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    numberingSystem: "latn",
  });
}

/** The one word a teacher sees for each stage. No system vocabulary. */
export const STATUS_LABEL: Record<LectureStatus, string> = {
  pending: "في الانتظار",
  transcribing: "بنسمع التسجيل",
  reading_slides: "بنقرا الشرائح",
  building: "بنكتب المستند",
  ready: "جاهز",
  failed: "وقف",
  stopped: "متوقف",
};

export const STAGE_ORDER: LectureStatus[] = [
  "pending",
  "transcribing",
  "reading_slides",
  "building",
  "ready",
];

export function isRunning(status: LectureStatus) {
  return status !== "ready" && status !== "failed" && status !== "stopped";
}
