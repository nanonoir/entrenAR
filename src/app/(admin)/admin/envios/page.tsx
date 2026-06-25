import { ShipmentTrackingList } from "@/components/admin/shipping/tracking/ShipmentTrackingList";
import { getShipmentTrackingRecords } from "@/lib/data/admin/shipping/tracking";

export default async function ShippingPage() {
  const records = await getShipmentTrackingRecords();

  return <ShipmentTrackingList records={records} />;
}
