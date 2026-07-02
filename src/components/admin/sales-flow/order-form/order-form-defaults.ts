import type { OrderFormInput } from "@/schemas/admin/order-schema";
import type { AdminSale } from "@/lib/data/admin/sales-flow/types";

export function buildDefaultValues(sale?: AdminSale): Partial<OrderFormInput> {
  if (!sale) {
    return {
      shippingAddressEnabled: false,
      shippingCost: 0,
      products: [],
    };
  }

  return {
    firstName: sale.customer.firstName,
    lastName: sale.customer.lastName,
    email: sale.customer.email ?? "",
    phone: sale.customer.phone ?? "",
    dniOrCuil: sale.customer.dniOrCuil ?? "",
    shippingStreet: sale.shippingAddress?.street ?? "",
    shippingNumber: sale.shippingAddress?.number ?? "",
    shippingFloor: sale.shippingAddress?.floor ?? "",
    shippingUnit: sale.shippingAddress?.unit ?? "",
    shippingCity: sale.shippingAddress?.city ?? "",
    shippingProvince: sale.shippingAddress?.province ?? "",
    shippingPostalCode: sale.shippingAddress?.postalCode ?? "",
    shippingNotes: sale.shippingAddress?.notes ?? "",
    shippingAddressEnabled: Boolean(sale.shippingAddress),
    products: sale.products.map((p) => ({ ...p })),
    paymentOption: sale.paymentStatus === "received" ? "received" : "pending",
    source: sale.source ?? "",
    discountType: sale.discountType,
    discountValue: sale.discountValue,
    shippingCost: sale.shippingCost,
    notes: sale.notes ?? "",
  };
}
