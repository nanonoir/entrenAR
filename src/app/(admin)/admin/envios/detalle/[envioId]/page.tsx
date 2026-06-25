import { notFound } from "next/navigation";
import { ShipmentDetailCard } from "@/components/admin/shipping/tracking/ShipmentDetailCard";
import { getShipmentTrackingRecordById } from "@/lib/data/admin/shipping/tracking";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ envioId: string }> }) {
  const { envioId } = await params;
  const record = await getShipmentTrackingRecordById(envioId);
  if (!record) notFound();
  return <ShipmentDetailCard record={record} />;
}
