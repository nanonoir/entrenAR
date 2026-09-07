import type { AdminSale } from "@/types/sales";
import type { ShipmentDeliveryType, ShipmentTrackingRecord } from "@/types/shipping";

export type { ShipmentDeliveryType, ShipmentTrackingRecord } from "@/types/shipping";

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

export function deriveShipmentTrackingRecord(sale: AdminSale): ShipmentTrackingRecord {
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
}

export function deriveShipmentTrackingRecords(sales: readonly AdminSale[]): ShipmentTrackingRecord[] {
  return sales.map(deriveShipmentTrackingRecord);
}

export async function getShipmentTrackingRecords(sales: readonly AdminSale[]): Promise<ShipmentTrackingRecord[]> {
  return deriveShipmentTrackingRecords(sales);
}

export async function getShipmentTrackingRecordById(id: string, sales: readonly AdminSale[]): Promise<ShipmentTrackingRecord | undefined> {
  return deriveShipmentTrackingRecords(sales).find((record) => record.id === id);
}
