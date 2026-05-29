import Link from "next/link";
import { Container } from "@/components/ui/Container";
import type { ShopNavItem } from "@/types/navigation";

type MegaMenuProps = {
  item: ShopNavItem;
};

export function MegaMenu({ item }: MegaMenuProps) {
  const layout = item.megaMenuLayout ?? "grouped-5";
  const links = item.groups?.flatMap((group) => group.links) ?? [];

  return (
    <div className="absolute inset-x-0 top-12 z-30 animate-[mega-menu-enter_180ms_ease-out] border-b border-border bg-surface shadow-lg">
      <Container className="py-7" size="wide">
        {layout === "grouped-5" ? (
          <div className="grid grid-cols-5 gap-6">
            {item.groups?.map((group) => (
              <div className="min-w-0" key={group.title}>
                {group.href ? (
                  <Link className="font-subtitle text-sm font-bold uppercase hover:text-accent" href={group.href}>
                    {group.title}
                  </Link>
                ) : (
                  <h3 className="font-subtitle text-sm font-bold uppercase">{group.title}</h3>
                )}
                <div className="mt-3 grid gap-2">
                  {group.links.map((link) => (
                    <Link className="block text-sm text-text-muted hover:text-accent" href={link.href} key={link.label}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {layout === "flat-5" ? (
          <div className="grid grid-cols-5 gap-x-8 gap-y-2">
            {item.groups?.map((group) =>
              group.href ? (
                <Link
                  className="block font-subtitle text-sm font-bold uppercase hover:text-accent"
                  href={group.href}
                  key={group.title}
                >
                  {group.title}
                </Link>
              ) : null,
            )}
            {links.map((link) => (
              <Link className="block text-sm text-text-muted hover:text-accent" href={link.href} key={link.label}>
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
        {layout === "flat-1" ? (
          <div className="mx-auto grid max-w-xs gap-2 text-center">
            {item.groups?.map((group) =>
              group.href ? (
                <Link
                  className="block font-subtitle text-sm font-bold uppercase hover:text-accent"
                  href={group.href}
                  key={group.title}
                >
                  {group.title}
                </Link>
              ) : null,
            )}
            {links.map((link) => (
              <Link className="block text-sm text-text-muted hover:text-accent" href={link.href} key={link.label}>
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </Container>
    </div>
  );
}
