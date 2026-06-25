import type { AdminSale } from "@/lib/data/admin/sales-flow/types";
import type { Customer, CustomerAddress, CustomerSalesSummary } from "@/lib/data/admin/customers/types";

export function getCustomerDisplayName(customer: Pick<Customer, "id" | "fullName" | "isAnonymized">) {
  return customer.isAnonymized ? `Cliente eliminado (${customer.id})` : customer.fullName;
}

export function normalizePhoneForWhatsApp(phone?: string) {
  return phone?.replace(/[\s()+-]/g, "") ?? "";
}

export function buildWhatsAppUrl(customer: Pick<Customer, "fullName" | "phone" | "isAnonymized">) {
  const phone = normalizePhoneForWhatsApp(customer.phone);
  if (!phone || customer.isAnonymized) return "";
  const text = encodeURIComponent(`Hola ${customer.fullName}`).replaceAll("%20", "+");
  return `https://api.whatsapp.com/send/?phone=${phone}&text=${text}&type=phone_number&app_absent=0`;
}

export function formatCustomerAddress(address?: CustomerAddress) {
  if (!address) return "Sin dirección cargada";
  const firstLine = `${address.street} ${address.number}${address.floorOrApartment ? `, ${address.floorOrApartment}` : ""}`.trim();
  const secondLine = [address.neighborhood, address.city, address.provinceOrState, address.country].filter(Boolean).join(", ");
  return [firstLine, address.postalCode ? `CP ${address.postalCode}` : undefined, secondLine].filter(Boolean).join(" · ");
}

export function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function formatLongAdminDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export function formatSalesCardDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(value));
}

export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export function buildCustomerSalesSummary(customerId: string, sales: AdminSale[]): CustomerSalesSummary {
  const customerSales = sales.filter((sale) => sale.customerId === customerId);
  const completedSales = customerSales.filter((sale) => sale.paymentStatus === "received");
  const sorted = [...customerSales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastSale = sorted[0];
  return {
    totalSpent: completedSales.reduce((sum, sale) => sum + sale.total, 0),
    ordersCount: completedSales.length,
    lastOrder: lastSale
      ? {
          id: lastSale.id,
          number: lastSale.number,
          date: lastSale.createdAt,
          total: lastSale.total,
        }
      : undefined,
  };
}
