import { mockSales } from "@/lib/data/admin/sales-flow/sales";
import type { AdminSale, SaleAddress, SaleShippingStatus } from "@/lib/data/admin/sales-flow/types";

export type ShipmentDeliveryType = "home_delivery" | "branch_delivery" | "pickup" | "manual";

export type ShipmentTrackingRecord = {
  id: string;
  saleId: string;
  saleNumber: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  address?: SaleAddress;
  deliveryType: ShipmentDeliveryType;
  status: SaleShippingStatus;
  paymentStatus: AdminSale["paymentStatus"];
  trackingCode?: string;
  providerName: string;
  source?: string;
  shippingCost: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  products: AdminSale["products"];
  logisticsSummary: string;
};

function getDeliveryType(sale: AdminSale): ShipmentDeliveryType {
  if (sale.shippingStatus === "pickup") return "pickup";
  if (!sale.shippingAddress) return "manual";
  if (sale.shippingAddress.city.toLowerCase().includes("buenos aires")) return "home_delivery";
  return "branch_delivery";
}

function getProviderName(type: ShipmentDeliveryType) {
  if (type === "pickup") return "Retiro en tienda";
  if (type === "manual") return "A definir";
  return type === "home_delivery" ? "Andreani" : "Correo Argentino";
}

export function deriveShipmentTrackingRecords(sales: AdminSale[] = mockSales): ShipmentTrackingRecord[] {
  return sales.map((sale) => {
    const deliveryType = getDeliveryType(sale);
    const latestEvent = sale.history.at(-1);
    return {
      id: sale.id,
      saleId: sale.id,
      saleNumber: sale.number,
      recipientName: `${sale.customer.firstName} ${sale.customer.lastName}`,
      recipientEmail: sale.customer.email,
      recipientPhone: sale.customer.phone,
      address: sale.shippingAddress,
      deliveryType,
      status: sale.shippingStatus,
      paymentStatus: sale.paymentStatus,
      trackingCode: sale.trackingCode,
      providerName: getProviderName(deliveryType),
      source: sale.source,
      shippingCost: sale.shippingCost,
      total: sale.total,
      createdAt: sale.createdAt,
      updatedAt: latestEvent?.date ?? sale.createdAt,
      products: sale.products,
      logisticsSummary: sale.shippingAddress
        ? `${sale.shippingAddress.city}, ${sale.shippingAddress.province}`
        : deliveryType === "pickup"
          ? "Retiro en punto configurado"
          : "Datos de entrega pendientes",
    };
  });
}

export async function getShipmentTrackingRecords(): Promise<ShipmentTrackingRecord[]> {
  return deriveShipmentTrackingRecords();
}

export async function getShipmentTrackingRecordById(id: string): Promise<ShipmentTrackingRecord | undefined> {
  return deriveShipmentTrackingRecords().find((record) => record.id === id);
}
