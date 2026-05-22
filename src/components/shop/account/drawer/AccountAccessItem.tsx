import Link from "next/link";
import type { ReactNode } from "react";

type AccountAccessItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
};

export function AccountAccessItem({ href, icon, label, onClick }: AccountAccessItemProps) {
  return (
    <Link
      className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition hover:border-accent hover:bg-accent-soft"
      href={href}
      onClick={onClick}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">{icon}</span>
      <span className="font-subtitle text-sm font-semibold uppercase">{label}</span>
    </Link>
  );
}
