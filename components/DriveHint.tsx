/**
 * The single biggest source of support requests in this flow is a teacher not
 * knowing where the link comes from or that sharing has to be opened. The hint
 * sits inline on the form for that reason.
 *
 * The illustration is a drawn stand-in for the Drive share dialog; swapping in
 * a real screenshot later means replacing only this <svg>.
 */
export function DriveHint() {
  return (
    <details className="rounded-2xl border border-line bg-card p-4 open:pb-5">
      <summary className="cursor-pointer list-none font-semibold text-brand-dark">
        منين أجيب الرابط؟
      </summary>

      <ol className="mt-4 space-y-2 ps-5 text-sm text-muted [list-style:decimal]">
        <li>افتح جوجل درايف واختار الملف.</li>
        <li>
          اضغط <strong className="text-ink">مشاركة</strong> بزرار الفأرة اليمين.
        </li>
        <li>
          تحت <strong className="text-ink">وصول عام</strong> اختار{" "}
          <strong className="text-ink">أي شخص لديه الرابط</strong>.
        </li>
        <li>
          اضغط <strong className="text-ink">نسخ الرابط</strong> والصقه هنا.
        </li>
      </ol>

      <svg
        viewBox="0 0 320 140"
        role="img"
        aria-label="رسم توضيحي لنافذة المشاركة في جوجل درايف مع اختيار أي شخص لديه الرابط"
        className="mt-4 w-full max-w-xs rounded-xl border border-line"
      >
        <rect width="320" height="140" fill="#ffffff" />
        <rect x="0" y="0" width="320" height="28" fill="#f3f1ec" />
        <text x="308" y="19" textAnchor="end" fontSize="12" fill="#6b6459">
          مشاركة الملف
        </text>

        <text x="308" y="56" textAnchor="end" fontSize="11" fill="#6b6459">
          وصول عام
        </text>

        <rect x="150" y="66" width="158" height="30" rx="15" fill="#e8f2ef" stroke="#1f6f5c" />
        <text x="296" y="86" textAnchor="end" fontSize="12" fill="#185446" fontWeight="bold">
          أي شخص لديه الرابط
        </text>

        <rect x="14" y="66" width="120" height="30" rx="15" fill="#ffffff" stroke="#e6e1d8" />
        <text x="74" y="86" textAnchor="middle" fontSize="12" fill="#6b6459">
          مقيّد
        </text>

        <rect x="196" y="106" width="112" height="26" rx="13" fill="#1f6f5c" />
        <text x="252" y="123" textAnchor="middle" fontSize="12" fill="#ffffff" fontWeight="bold">
          نسخ الرابط
        </text>
      </svg>
    </details>
  );
}
