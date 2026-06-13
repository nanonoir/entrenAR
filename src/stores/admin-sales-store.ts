"use client";

import { create } from "zustand";
import { mockSales } from "@/lib/data/admin/sales-flow/sales";
import { mockPurchaseOrders } from "@/lib/data/admin/sales-flow/purchaseOrders";
import {
  generateEventId,
  generateNextSaleId,
  generatePurchaseOrderId,
} from "@/lib/data/admin/sales-flow/helpers";
import { isSaleArchivable } from "@/lib/data/admin/sales-flow/archive";
import type {
  AdminPurchaseOrder,
  AdminSale,
  SaleHistoryEvent,
  SaleProduct,
  SaleCustomer,
  SaleAddress,
  DiscountType,
  SalePaymentStatus,
} from "@/lib/data/admin/sales-flow/types";

export type Toast = {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
};

type CreateSaleInput = {
  customer: SaleCustomer;
  shippingAddress?: SaleAddress;
  products: SaleProduct[];
  paymentStatus: "pending" | "received";
  source?: string;
  discountType?: DiscountType;
  discountValue?: number;
  shippingCost: number;
  subtotal: number;
  total: number;
  notes?: string;
};

type CreatePurchaseOrderInput = {
  customer: SaleCustomer;
  source?: string;
  shippingAddress?: SaleAddress;
  products: SaleProduct[];
  discountType?: DiscountType;
  discountValue?: number;
  shippingCost: number;
  subtotal: number;
  total: number;
  notes?: string;
};

type UpdateSaleInput = Partial<
  Omit<AdminSale, "id" | "number" | "createdAt" | "history" | "archived" | "sourceOrderId">
>;

type AdminSalesState = {
  sales: AdminSale[];
  purchaseOrders: AdminPurchaseOrder[];
  toasts: Toast[];
  isInitializing: boolean;
  error: string | null;

  // Sale mutations
  createSale: (input: CreateSaleInput, sourceOrderId?: string) => string;
  updateSale: (id: string, input: UpdateSaleInput) => void;
  cancelSale: (
    id: string,
    reason: string,
    opts: { restoreStock: boolean; sendEmail: boolean },
  ) => void;
  reopenSale: (id: string) => void;
  archiveSale: (id: string) => void;

  // Payment transitions
  markPaymentReceived: (id: string) => void;

  // Logistics transitions
  markPacked: (id: string) => void;
  markUnpacked: (id: string) => void;
  markShipped: (id: string) => void;

  // Shipping address update
  updateShippingAddress: (id: string, address: SaleAddress) => void;

  // Purchase order mutations
  createPurchaseOrder: (input: CreatePurchaseOrderInput) => string;
  convertOrderToSale: (orderId: string) => string;
  deletePurchaseOrder: (orderId: string) => void;

  // Toast
  retryLoad: () => void;
  addToast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;
};

function now(): string {
  return new Date().toISOString();
}

function makeEvent(type: SaleHistoryEvent["type"], note?: string): SaleHistoryEvent {
  return { id: generateEventId(), type, date: now(), actor: "Admin", note };
}

export const useAdminSalesStore = create<AdminSalesState>()((set, get) => ({
  sales: mockSales,
  purchaseOrders: mockPurchaseOrders,
  toasts: [],
  isInitializing: false,
  error: null,

  createSale: (input, sourceOrderId) => {
    const newId = generateNextSaleId(get().sales);
    const stockEvent = input.paymentStatus === "received" ? "stock_deducted" : "stock_reserved";
    const sale: AdminSale = {
      id: newId,
      number: `#${newId}`,
      createdAt: now(),
      source: input.source,
      customer: input.customer,
      shippingAddress: input.shippingAddress,
      products: input.products,
      paymentStatus: input.paymentStatus,
      shippingStatus: "to_pack",
      subtotal: input.subtotal,
      discountType: input.discountType,
      discountValue: input.discountValue,
      shippingCost: input.shippingCost,
      total: input.total,
      archived: false,
      notes: input.notes,
      sourceOrderId,
      history: [
        makeEvent("sale_created", sourceOrderId ? `Convertida desde orden ${sourceOrderId}.` : "Venta creada manualmente."),
        makeEvent(stockEvent),
      ],
    };
    set((state) => ({ sales: [...state.sales, sale] }));
    get().addToast("Venta registrada", "success");
    return newId;
  },

  updateSale: (id, input) => {
    set((state) => ({
      sales: state.sales.map((sale) =>
        sale.id !== id
          ? sale
          : {
              ...sale,
              ...input,
              history: [
                ...sale.history,
                makeEvent("sale_updated"),
              ],
            },
      ),
    }));
    get().addToast("Venta actualizada", "success");
  },

  cancelSale: (id, reason, opts) => {
    set((state) => ({
      sales: state.sales.map((sale) => {
        if (sale.id !== id) return sale;
        const events: SaleHistoryEvent[] = [
          makeEvent("sale_cancelled", `Motivo: ${reason}`),
        ];
        if (opts.restoreStock) events.push(makeEvent("stock_restored"));
        if (opts.sendEmail) {
          events.push(makeEvent("email_sent", "E-mail enviado al cliente."));
        } else {
          events.push(makeEvent("email_failed", "E-mail no enviado (simulación)."));
        }
        return {
          ...sale,
          paymentStatus: "cancelled" as SalePaymentStatus,
          previousPaymentStatus: sale.paymentStatus,
          previousShippingStatus: sale.shippingStatus,
          cancellationReason: reason,
          history: [...sale.history, ...events],
        };
      }),
    }));
    get().addToast("Venta cancelada", "info");
  },

  reopenSale: (id) => {
    set((state) => ({
      sales: state.sales.map((sale) => {
        if (sale.id !== id) return sale;
        return {
          ...sale,
          paymentStatus: sale.previousPaymentStatus ?? "pending",
          shippingStatus: sale.previousShippingStatus ?? "to_pack",
          previousPaymentStatus: undefined,
          previousShippingStatus: undefined,
          cancellationReason: undefined,
          history: [...sale.history, makeEvent("sale_reopened")],
        };
      }),
    }));
    get().addToast("Venta re-abierta", "success");
  },

  archiveSale: (id) => {
    const sale = get().sales.find((item) => item.id === id);
    if (!sale || sale.archived) return;
    if (!isSaleArchivable(sale)) {
      get().addToast("Sólo podés archivar ventas canceladas, reintegradas o entregadas con pago recibido.", "error");
      return;
    }

    set((state) => ({
      sales: state.sales.map((sale) =>
        sale.id !== id
          ? sale
          : {
              ...sale,
              archived: true,
              history: [...sale.history, makeEvent("sale_archived")],
            },
      ),
    }));
    get().addToast("Venta archivada", "info");
  },

  markPaymentReceived: (id) => {
    set((state) => ({
      sales: state.sales.map((sale) =>
        sale.id !== id
          ? sale
          : {
              ...sale,
              paymentStatus: "received" as SalePaymentStatus,
              history: [...sale.history, makeEvent("payment_received")],
            },
      ),
    }));
    get().addToast("Pago marcado como recibido", "success");
  },

  markPacked: (id) => {
    set((state) => ({
      sales: state.sales.map((sale) =>
        sale.id !== id
          ? sale
          : {
              ...sale,
              shippingStatus: "to_ship",
              history: [...sale.history, makeEvent("package_packed")],
            },
      ),
    }));
    get().addToast("Pedido empaquetado", "success");
  },

  markUnpacked: (id) => {
    set((state) => ({
      sales: state.sales.map((sale) =>
        sale.id !== id
          ? sale
          : {
              ...sale,
              shippingStatus: "to_pack",
              history: [...sale.history, makeEvent("package_unpacked")],
            },
      ),
    }));
    get().addToast("Pedido desempaquetado", "info");
  },

  markShipped: (id) => {
    set((state) => ({
      sales: state.sales.map((sale) =>
        sale.id !== id
          ? sale
          : {
              ...sale,
              shippingStatus: "shipped",
              history: [
                ...sale.history,
                makeEvent("package_shipped"),
                makeEvent("email_failed", "Notificación de envío no entregada (simulación)."),
              ],
            },
      ),
    }));
    get().addToast("Envío notificado", "success");
  },

  updateShippingAddress: (id, address) => {
    set((state) => ({
      sales: state.sales.map((sale) =>
        sale.id !== id
          ? sale
          : {
              ...sale,
              shippingAddress: address,
              history: [...sale.history, makeEvent("shipping_address_updated")],
            },
      ),
    }));
    get().addToast("Dirección actualizada", "success");
  },

  createPurchaseOrder: (input) => {
    const newId = generatePurchaseOrderId();
    const order: AdminPurchaseOrder = {
      id: newId,
      createdAt: now(),
      source: input.source,
      customer: input.customer,
      shippingAddress: input.shippingAddress,
      products: input.products,
      status: "pending",
      subtotal: input.subtotal,
      discountType: input.discountType,
      discountValue: input.discountValue,
      shippingCost: input.shippingCost,
      total: input.total,
      notes: input.notes,
      history: [makeEvent("sale_created", "Orden de compra creada.")],
    };
    set((state) => ({ purchaseOrders: [...state.purchaseOrders, order] }));
    get().addToast("Orden de compra creada", "success");
    return newId;
  },

  convertOrderToSale: (orderId) => {
    const order = get().purchaseOrders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const newSaleId = get().createSale(
      {
        customer: order.customer,
        shippingAddress: order.shippingAddress,
        products: order.products,
        paymentStatus: "received",
        source: order.source,
        discountType: order.discountType,
        discountValue: order.discountValue,
        shippingCost: order.shippingCost,
        subtotal: order.subtotal,
        total: order.total,
        notes: order.notes,
      },
      orderId,
    );

    set((state) => ({
      purchaseOrders: state.purchaseOrders.map((o) =>
        o.id !== orderId
          ? o
          : {
              ...o,
              status: "converted",
              convertedSaleId: newSaleId,
              history: [...o.history, makeEvent("order_converted", `Convertida a venta #${newSaleId}.`)],
            },
      ),
    }));

    return newSaleId;
  },

  deletePurchaseOrder: (orderId) => {
    set((state) => ({ purchaseOrders: state.purchaseOrders.filter((order) => order.id !== orderId) }));
    get().addToast("Orden eliminada", "info");
  },

  retryLoad: () => {
    set({ error: null, isInitializing: false });
    get().addToast("Ventas actualizadas", "success");
  },

  addToast: (message, tone = "success") => {
    const id = generateEventId();
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismissToast(id), 4000);
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
