import { BadgePercent, BarChart3, Boxes, CreditCard, Home, LogOut, Megaphone, Menu, Settings, ShoppingBag, TicketPercent, Truck, Users, ChartNoAxesCombined } from "lucide-react";
import type { ComponentType } from "react";

export type AdminNavItem = { label: string; href: string; icon: ComponentType<{ className?: string; size?: number }> };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const adminNavGroups: AdminNavGroup[] = [
  { label: "Inicio", items: [{ label: "Visión general", href: "/admin", icon: Home }] },
  {
    label: "Estadísticas",
    items: [
      { label: "Productos", href: "/admin/estadisticas/productos", icon: Boxes },
      { label: "Ventas y Clientes", href: "/admin/estadisticas/ventas-clientes", icon: BarChart3 },
      { label: "Visitas", href: "/admin/estadisticas/visitas", icon: ChartNoAxesCombined },
      { label: "Reporte de cupones", href: "/admin/estadisticas/reporte-cupones", icon: TicketPercent },
    ],
  },
  {
    label: "Gestión",
    items: [
      { label: "Ventas", href: "/admin/ventas", icon: ShoppingBag },
      { label: "Productos", href: "/admin/productos", icon: Boxes },
      { label: "Medios de Pago", href: "/admin/medios-de-pago", icon: CreditCard },
      { label: "Envíos", href: "/admin/envios", icon: Truck },
      { label: "Clientes", href: "/admin/clientes", icon: Users },
      { label: "Descuentos", href: "/admin/descuentos", icon: BadgePercent },
      { label: "Marketing", href: "/admin/marketing", icon: Megaphone },
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
