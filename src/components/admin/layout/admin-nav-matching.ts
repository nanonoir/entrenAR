export function isAdminPathActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  if (href === "/admin/ventas") return pathname === href;

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isAdminAccordionActive(pathname: string, href: string, children: { href: string }[]) {
  if (href === "/admin/ventas") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return children.some((child) => isAdminPathActive(pathname, child.href));
}
