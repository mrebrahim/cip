import { STATUS_LABEL, STAGE_ORDER } from "@/lib/format";
import type { LectureStatus } from "@/lib/types";

// "Pending" is not a stage a teacher should see as its own step — processing
// starts the moment the lecture is created — so the list begins at the first
// real piece of work and a pending lecture sits on it.
const RUNNING_STAGES: LectureStatus[] = STAGE_ORDER.filter(
  (stage) => stage !== "pending",
);

export function StageIndicator({ status }: { status: LectureStatus }) {
  const currentIndex =
    status === "pending" ? 0 : RUNNING_STAGES.indexOf(status);

  return (
    <ol className="space-y-3">
      {RUNNING_STAGES.map((stage, index) => {
        const done = status === "ready" || currentIndex > index;
        const current = !done && currentIndex === index;

        return (
          <li key={stage} className="flex items-center gap-3">
            <span
              aria-hidden
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                done
                  ? "bg-brand text-white"
                  : current
                    ? "bg-brand-soft text-brand-dark"
                    : "bg-line text-muted"
              }`}
            >
              {done ? "✓" : index + 1}
            </span>

            <span
              className={current ? "font-bold text-ink" : done ? "text-ink" : "text-muted"}
            >
              {STATUS_LABEL[stage]}
            </span>

            {current && (
              <span className="size-2 animate-pulse rounded-full bg-brand" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
