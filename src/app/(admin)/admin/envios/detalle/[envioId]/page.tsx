import { notFound } from "next/navigation";
import { ShipmentDetailCard } from "@/components/admin/shipping/tracking/ShipmentDetailCard";
import { SalesApiError } from "@/lib/api/admin/sales/client";
import { salesRepository } from "@/lib/api/config";
import { deriveShipmentTrackingRecord } from "@/lib/data/admin/shipping/tracking";
import type { AdminSale } from "@/types/sales";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ envioId: string }> }) {
  const { envioId } = await params;
  let sale: AdminSale;

  try {
    sale = await salesRepository.getSaleById(envioId);
  } catch (error) {
    if (error instanceof SalesApiError && error.status === 404) notFound();
    throw error;
  }

  const record = deriveShipmentTrackingRecord(sale);
  return <ShipmentDetailCard record={record} />;
}
