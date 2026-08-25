import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <p className="text-lg font-bold">الصفحة دي مش موجودة</p>
        <p className="mt-2 text-muted">يمكن الرابط قديم، أو المحتوى ده مش من موادك.</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white"
        >
          ارجع لموادي
        </Link>
      </div>
    </div>
  );
}
