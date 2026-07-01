import { Archive, BadgePercent, BarChart3, Boxes, CreditCard, FolderTree, Home, LogOut, Megaphone, Menu, PackageSearch, Settings, ShoppingBag, TicketPercent, Truck, Users } from "lucide-react";
import type { ComponentType } from "react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; size?: number }>;
};

export type AdminNavChild = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string; size?: number }>;
};

// A nav entry is either a direct link or an accordion group with children.
export type AdminNavEntry =
  | { type: "link"; label: string; href: string; icon: ComponentType<{ className?: string; size?: number }> }
  | {
      type: "accordion";
      label: string;
      href: string; // Primary route — navigated when parent label is clicked
      icon: ComponentType<{ className?: string; size?: number }>;
      children: AdminNavChild[];
    };

export type AdminNavGroup = {
  label: string;
  entries: AdminNavEntry[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Inicio",
    entries: [{ type: "link", label: "Inicio: Visión General", href: "/admin", icon: Home }],
  },
  {
    label: "Estadísticas",
    entries: [
      {
        type: "accordion",
        label: "Estadísticas",
        href: "/admin/estadisticas/productos",
        icon: BarChart3,
        children: [
          { label: "Productos", href: "/admin/estadisticas/productos", icon: Boxes },
          { label: "Ventas y Clientes", href: "/admin/estadisticas/ventas-clientes", icon: BarChart3 },
          { label: "Visitas", href: "/admin/estadisticas/visitas", icon: BarChart3 },
          { label: "Reporte de cupones", href: "/admin/estadisticas/reporte-cupones", icon: TicketPercent },
        ],
      },
    ],
  },
  {
    label: "Gestión",
    entries: [
      {
        type: "accordion",
        label: "Ventas",
        href: "/admin/ventas",
        icon: ShoppingBag,
        children: [
          { label: "Listado de Ventas", href: "/admin/ventas" },
          { label: "Órdenes de Compra", href: "/admin/ventas/ordenes" },
          { label: "Carritos Abandonados", href: "/admin/ventas/carritos" },
          { label: "Archivados", href: "/admin/ventas/archivados" },
        ],
      },
      {
        type: "accordion",
        label: "Productos",
        href: "/admin/productos",
        icon: Boxes,
        children: [
          { label: "Listado", href: "/admin/productos", icon: Boxes },
          { label: "Inventario", href: "/admin/productos/inventario", icon: PackageSearch },
          { label: "Categorías", href: "/admin/productos/categorias", icon: FolderTree },
        ],
      },
      { type: "link", label: "Medios de Pago", href: "/admin/medios-de-pago", icon: CreditCard },
      {
        type: "accordion",
        label: "Envíos",
        href: "/admin/envios",
        icon: Truck,
        children: [
          { label: "Seguimiento de Envíos", href: "/admin/envios", icon: Truck },
          { label: "Medios de Envío", href: "/admin/envios/medios-de-envio", icon: Settings },
        ],
      },
      { type: "link", label: "Clientes", href: "/admin/clientes", icon: Users },
      {
        type: "accordion",
        label: "Descuentos",
        href: "/admin/descuentos",
        icon: BadgePercent,
        children: [
          { label: "Cupones", href: "/admin/descuentos/cupones", icon: TicketPercent },
          { label: "Envío gratis", href: "/admin/descuentos/envio-gratis", icon: Truck },
        ],
      },
      { type: "link", label: "Marketing", href: "/admin/marketing", icon: Megaphone },
    ],
  },
];

export const mobilePrimaryNav: AdminNavItem[] = [
  { label: "Inicio", href: "/admin", icon: Home },
  { label: "Ventas", href: "/admin/ventas", icon: ShoppingBag },
  { label: "Productos", href: "/admin/productos", icon: Boxes },
  { label: "Menú", href: "#menu", icon: Menu },
];

export const adminFooterActions: AdminNavItem[] = [
  { label: "Configuración", href: "#configuracion", icon: Settings },
  { label: "Cerrar sesión", href: "#cerrar-sesion", icon: LogOut },
];

// Keep the old AdminNavGroup shape for anything that used it before (unused outside sidebar/drawer now).
// Re-export a flattened version for backward compatibility if needed.
export { Archive };
