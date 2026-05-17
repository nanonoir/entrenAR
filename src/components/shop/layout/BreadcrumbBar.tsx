import Link from "next/link";
import { Container } from "@/components/ui/Container";

type BreadcrumbBarItem = {
  label: string;
  href?: string;
  current?: boolean;
};

type BreadcrumbBarProps = {
  items: BreadcrumbBarItem[];
};

export function BreadcrumbBar({ items }: BreadcrumbBarProps) {
  return (
    <div className="bg-black px-4 py-1.5 text-xs text-white">
      <Container size="wide">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 overflow-hidden">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <span className="flex min-w-0 items-center gap-2" key={`${item.label}-${index}`}>
                {item.href && !item.current ? (
                  <Link className="shrink-0 hover:text-accent" href={item.href}>
                    {item.label}
                  </Link>
                ) : (
                  <span className={item.current ? "truncate font-semibold" : "truncate"}>
                    {item.label}
                  </span>
                )}
                {!isLast ? <span className="shrink-0 text-white/60">&gt;</span> : null}
              </span>
            );
          })}
        </nav>
      </Container>
    </div>
  );
}
