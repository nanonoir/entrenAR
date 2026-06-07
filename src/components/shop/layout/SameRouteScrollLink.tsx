"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

type SameRouteScrollLinkProps = ComponentProps<typeof Link>;

function getPathname(href: SameRouteScrollLinkProps["href"]) {
  if (typeof href === "string") {
    return href.split("#")[0]?.split("?")[0] ?? href;
  }

  return href.pathname ?? "";
}

export function SameRouteScrollLink({ href, onClick, ...props }: SameRouteScrollLinkProps) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented || getPathname(href) !== pathname) {
          return;
        }

        event.preventDefault();
        window.scrollTo({ left: 0, top: 0, behavior: "auto" });
      }}
      {...props}
    />
  );
}
