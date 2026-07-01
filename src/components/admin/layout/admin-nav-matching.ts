export function isAdminPathActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  if (href === "/admin/ventas") return pathname === href;
  if (href === "/admin/envios") return pathname === href || pathname.startsWith("/admin/envios/detalle/");

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isAdminAccordionChildActive(pathname: string, parentHref: string, childHref: string) {
  if (parentHref === "/admin/descuentos" && childHref === "/admin/descuentos/cupones") {
    return pathname === parentHref || isAdminPathActive(pathname, childHref);
  }
  if (childHref === parentHref) return pathname === childHref;
  return isAdminPathActive(pathname, childHref);
}

export function isAdminAccordionActive(pathname: string, href: string, children: { href: string }[]) {
  if (href === "/admin/ventas") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (href === "/admin/envios") {
    return pathname === href || pathname.startsWith("/admin/envios/");
  }
  if (href === "/admin/descuentos") {
    return pathname === "/admin/descuentos" || pathname.startsWith("/admin/descuentos/");
  }

  return children.some((child) => isAdminPathActive(pathname, child.href));
}
