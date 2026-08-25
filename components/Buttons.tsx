import Link from "next/link";

const PRIMARY =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 text-base font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60";

const SECONDARY =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-card px-5 text-base font-semibold text-ink transition hover:bg-sand disabled:opacity-60";

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={PRIMARY}>
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={SECONDARY}>
      {children}
    </Link>
  );
}

export const buttonStyles = { primary: PRIMARY, secondary: SECONDARY };
