import { ShipmentDetailPageClient } from "@/components/admin/shipping/tracking/ShipmentDetailPageClient";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ envioId: string }> }) {
  const { envioId } = await params;
  return <ShipmentDetailPageClient envioId={envioId} />;
}
