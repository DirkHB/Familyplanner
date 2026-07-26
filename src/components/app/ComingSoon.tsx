import Link from "next/link";
import { TabBar } from "@/components/app/TabBar";

export function ComingSoon({
  title,
  text,
  cta,
}: {
  title: string;
  text: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pb-28">
        <h1 className="font-display text-4xl">{title}</h1>
        <p className="mt-3 text-ink-muted">{text}</p>
        {cta && (
          <Link href={cta.href} className="mt-6 inline-flex w-fit rounded-pill bg-ink px-5 py-3 font-medium text-surface">
            {cta.label}
          </Link>
        )}
      </div>
      <TabBar />
    </div>
  );
}
