import { ShipmentTrackingList } from "@/components/admin/shipping/tracking/ShipmentTrackingList";
import { salesRepository } from "@/lib/api/config";
import { deriveShipmentTrackingRecords } from "@/lib/data/admin/shipping/tracking";

export default async function ShippingPage() {
  const sales = await salesRepository.getSales({ isArchived: false, limit: 100 });
  const records = deriveShipmentTrackingRecords(sales.items);

  return <ShipmentTrackingList records={records} />;
}
