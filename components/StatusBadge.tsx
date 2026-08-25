import { STATUS_LABEL, isRunning } from "@/lib/format";
import type { LectureStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: LectureStatus }) {
  const tone =
    status === "ready"
      ? "bg-brand-soft text-brand-dark"
      : status === "failed"
        ? "bg-danger-soft text-danger"
        : "bg-warn-soft text-warn";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${tone}`}
    >
      {isRunning(status) && (
        <span className="size-2 animate-pulse rounded-full bg-current" aria-hidden />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}
