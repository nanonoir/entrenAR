"use client";

import { useEffect, useMemo } from "react";
import { ShipmentTrackingList } from "@/components/admin/shipping/tracking/ShipmentTrackingList";
import { deriveShipmentTrackingRecords } from "@/lib/data/admin/shipping/tracking";
import { useAdminSalesStore } from "@/stores/admin-sales-store";

/**
 * Admin reads run after client bootstrap: the admin access token lives in memory only,
 * so the sales store (not a server component) loads the data.
 */
export function ShipmentTrackingPageClient() {
  const sales = useAdminSalesStore((state) => state.sales);
  const source = useAdminSalesStore((state) => state.source);
  const hasLoaded = useAdminSalesStore((state) => state.hasLoaded);
  const isInitializing = useAdminSalesStore((state) => state.isInitializing);
  const error = useAdminSalesStore((state) => state.error);
  const fetchSales = useAdminSalesStore((state) => state.fetchSales);
  const records = useMemo(() => deriveShipmentTrackingRecords(sales.filter((sale) => !sale.archived)), [sales]);

  useEffect(() => {
    if (source === "api" || !hasLoaded) void fetchSales({ isArchived: false, limit: 100 });
  }, [fetchSales, hasLoaded, source]);

  if (error && records.length === 0) return <ShipmentTrackingList records={[]} state="error" />;
  if (isInitializing && records.length === 0) return <ShipmentTrackingList records={[]} state="loading" />;
  return <ShipmentTrackingList records={records} />;
}
