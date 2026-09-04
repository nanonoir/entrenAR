"use client";

import { create } from "zustand";
import { salesRepository } from "@/lib/api/config";
import { MockSalesRepository } from "@/lib/api/admin/sales/mock-sales.repository";
import type {
  AdminSaleDetail,
  CancelSalePayload,
  CreateManualSalePayload,
  CreatePurchaseOrderPayload,
  PurchaseOrderDetail,
  PurchaseOrderFilterQuery,
  SalesFilterQuery,
  SalesRepository,
  ShipSalePayload,
} from "@/lib/api/admin/sales/sales.repository";
import { mockPurchaseOrders } from "@/lib/data/admin/sales-flow/purchaseOrders";
import { mockSales } from "@/lib/data/admin/sales-flow/sales";
import {
  generateNextSaleId,
  generatePurchaseOrderId,
} from "@/lib/data/admin/sales-flow/helpers";
import type {
  AdminPurchaseOrder,
  AdminSale,
  DiscountType,
  SaleAddress,
  SaleCustomer,
  SaleProduct,
} from "@/lib/data/admin/sales-flow/types";
import {
  addAdminToast,
  canUseFallback,
  clonePurchaseOrder,
  cloneSale,
  makeEvent,
  mergeSale,
  optimisticPurchaseOrder,
  optimisticSale,
  replacePurchaseOrder,
  replaceSale,
  reportFailure,
  toManualSalePayload,
  toPurchaseOrderPayload,
  toSalesStoreError,
  withStockEvent,
  withCancellationEvents,
} from "@/stores/admin-sales-store.helpers";

export const SALES_ASYNC_STATUS = {
  ERROR: "error",
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
} as const;

export type SalesAsyncStatus = (typeof SALES_ASYNC_STATUS)[keyof typeof SALES_ASYNC_STATUS];

export type SalesStoreError = {
  code: string;
  issues: readonly { code: string; field: string; message: string }[];
  message: string;
  status: number;
};

export type CreateSaleInput = {
  customerId?: string;
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

export type CreatePurchaseOrderInput = Omit<CreatePurchaseOrderPayload, "supplierId"> & {
  supplierId?: string;
  customer?: SaleCustomer;
  source?: string;
  shippingAddress?: SaleAddress;
  discountType?: DiscountType;
  discountValue?: number;
};

export type UpdateSaleInput = Partial<
  Omit<AdminSale, "id" | "number" | "createdAt" | "history" | "archived" | "sourceOrderId">
>;

type CancelSaleInput = string | CancelSalePayload;
type CancelSaleOptions = { restoreStock: boolean; sendEmail?: boolean };

export type AdminSalesState = {
  sales: AdminSale[];
  purchaseOrders: AdminPurchaseOrder[];
  error: SalesStoreError | null;
  fallbackMessage: string | null;
  hasLoaded: boolean;
  isFallback: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  loadingOperations: string[];
  source: SalesRepository["source"];
  status: SalesAsyncStatus;

  fetchSales: (query?: SalesFilterQuery) => Promise<boolean>;
  fetchSale: (id: string) => Promise<boolean>;
  fetchPurchaseOrders: (query?: PurchaseOrderFilterQuery) => Promise<boolean>;
  fetchPurchaseOrder: (id: string) => Promise<boolean>;

  createManualSale: (input: CreateSaleInput | CreateManualSalePayload) => Promise<AdminSaleDetail | null>;
  convertOrderToSale: (orderId: string) => Promise<string | null>;
  confirmSale: (id: string) => Promise<AdminSaleDetail | null>;
  packSale: (id: string) => Promise<AdminSaleDetail | null>;
  unpackSale: (id: string) => Promise<AdminSaleDetail | null>;
  shipSale: (id: string, payload?: ShipSalePayload) => Promise<AdminSaleDetail | null>;
  deliverSale: (id: string) => Promise<AdminSaleDetail | null>;
  cancelSale: (id: string, input: CancelSaleInput, options?: CancelSaleOptions) => Promise<AdminSaleDetail | null>;
  reopenSale: (id: string) => Promise<AdminSaleDetail | null>;
  archiveSale: (id: string) => Promise<AdminSaleDetail | null>;
  unarchiveSale: (id: string) => Promise<AdminSaleDetail | null>;
  addNote: (id: string, note: string) => Promise<AdminSaleDetail | null>;

  createPurchaseOrder: (input: CreatePurchaseOrderInput) => Promise<string | null>;
  submitPurchaseOrder: (id: string) => Promise<PurchaseOrderDetail | null>;
  receivePurchaseOrder: (id: string) => Promise<PurchaseOrderDetail | null>;
  cancelPurchaseOrder: (id: string) => Promise<PurchaseOrderDetail | null>;

  // Compatibility actions retained for existing admin consumers.
  createSale: (input: CreateSaleInput, sourceOrderId?: string) => Promise<string | null>;
  updateSale: (id: string, input: UpdateSaleInput) => Promise<boolean>;
  markPaymentReceived: (id: string) => Promise<AdminSaleDetail | null>;
  markPacked: (id: string) => Promise<AdminSaleDetail | null>;
  markUnpacked: (id: string) => Promise<AdminSaleDetail | null>;
  markShipped: (id: string) => Promise<AdminSaleDetail | null>;
  updateShippingAddress: (id: string, address: SaleAddress) => Promise<boolean>;
  anonymizeCustomerSales: (customerId: string) => void;
  deletePurchaseOrder: (id: string) => Promise<boolean>;
  retryLoad: () => Promise<boolean>;
  clearError: () => void;
};

export type AdminSalesStoreOptions = {
  repository?: SalesRepository;
  fallbackRepository?: SalesRepository;
};

export function createAdminSalesStore(options: AdminSalesStoreOptions = {}) {
  const configuredRepository = options.repository ?? salesRepository;
  const fallbackRepository = options.fallbackRepository ?? new MockSalesRepository();
  let activeRepository = configuredRepository;
  let fallbackActive = false;
  const versions = new Map<string, number>();
  const loading = new Set<string>();
  const initializing = new Set<string>();

  const store = create<AdminSalesState>()((set, get) => {
    const begin = (token: string, initialize: boolean) => {
      loading.add(token);
      if (initialize) initializing.add(token);
      set({
        error: null,
        isLoading: true,
        isInitializing: initializing.size > 0,
        loadingOperations: [...loading],
        status: SALES_ASYNC_STATUS.LOADING,
      });
    };

    const finish = (token: string, failed: boolean) => {
      loading.delete(token);
      initializing.delete(token);
      set((state) => ({
        isInitializing: initializing.size > 0,
        isLoading: loading.size > 0,
        loadingOperations: [...loading],
        status: failed ? SALES_ASYNC_STATUS.ERROR : loading.size > 0 ? SALES_ASYNC_STATUS.LOADING : SALES_ASYNC_STATUS.SUCCESS,
        error: failed ? state.error : null,
      }));
    };

    const current = (key: string, version: number) => versions.get(key) === version;
    const nextVersion = (key: string) => {
      const version = (versions.get(key) ?? 0) + 1;
      versions.set(key, version);
      return version;
    };

    const run = async <T>(
      key: string,
      task: (repository: SalesRepository) => Promise<T>,
      options: {
        commit: (result: T) => void;
        initialize?: boolean;
        optimistic?: () => void;
        rollback?: () => void;
        successMessage?: string;
      },
    ): Promise<T | null> => {
      const version = nextVersion(key);
      const token = `${key}:${version}`;
      begin(token, options.initialize ?? false);
      options.optimistic?.();

      try {
        let result: T;
        try {
          result = await task(activeRepository);
        } catch (error) {
          if (!canUseFallback(activeRepository, error)) throw error;
          activeRepository = fallbackRepository;
          fallbackActive = true;
          set({
            fallbackMessage: "No pudimos conectar con el backend. Mostramos datos locales hasta que se recupere.",
            isFallback: true,
            source: fallbackRepository.source,
          });
          addAdminToast("No pudimos conectar con el backend. Usando datos locales.", "info");
          result = await task(activeRepository);
        }

        if (current(key, version)) {
          options.commit(result);
          set({
            error: null,
            fallbackMessage: fallbackActive ? "No pudimos conectar con el backend. Mostramos datos locales hasta que se recupere." : null,
            hasLoaded: true,
          });
          if (options.successMessage) addAdminToast(options.successMessage);
        }
        finish(token, false);
        return result;
      } catch (error) {
        if (current(key, version)) {
          options.rollback?.();
          set({ error: toSalesStoreError(error, `${key.toUpperCase().replaceAll("-", "_")}_FAILED`) });
          addAdminToast(toSalesStoreError(error).message, "error");
        }
        finish(token, true);
        return null;
      }
    };

    const mutateSale = (
      key: string,
      id: string,
      task: (repository: SalesRepository) => Promise<AdminSaleDetail>,
      optimistic: (sale: AdminSale) => AdminSale,
      successMessage: string,
      transform: (result: AdminSaleDetail) => AdminSaleDetail = (result) => result,
    ) => {
      const previous = get().sales;
      return run(`sale-${key}-${id}`, task, {
        commit: (result) => replaceSale(set, transform(result)),
        optimistic: () => set((state) => ({ sales: state.sales.map((sale) => sale.id === id ? optimistic(sale) : sale) })),
        rollback: () => set({ sales: previous }),
        successMessage,
      });
    };

    const mutatePurchaseOrder = (
      key: string,
      id: string,
      task: (repository: SalesRepository) => Promise<PurchaseOrderDetail>,
      optimistic: (order: AdminPurchaseOrder) => AdminPurchaseOrder,
      successMessage: string,
    ) => {
      const previous = get().purchaseOrders;
      return run(`purchase-order-${key}-${id}`, task, {
        commit: (result) => replacePurchaseOrder(set, result),
        optimistic: () => set((state) => ({ purchaseOrders: state.purchaseOrders.map((order) => order.id === id ? optimistic(order) : order) })),
        rollback: () => set({ purchaseOrders: previous }),
        successMessage,
      });
    };

    return {
      sales: configuredRepository.source === "mock" ? mockSales.map(cloneSale) : [],
      purchaseOrders: configuredRepository.source === "mock" ? mockPurchaseOrders.map(clonePurchaseOrder) : [],
      error: null,
      fallbackMessage: null,
      hasLoaded: configuredRepository.source === "mock",
      isFallback: false,
      isInitializing: configuredRepository.source === "api",
      isLoading: false,
      loadingOperations: [],
      source: configuredRepository.source,
      status: configuredRepository.source === "mock" ? SALES_ASYNC_STATUS.SUCCESS : SALES_ASYNC_STATUS.IDLE,

      fetchSales: (query: SalesFilterQuery = {}) => run("sales", (repository) => repository.getSales(query), {
        commit: (result) => set((state) => ({ sales: result.items.map((sale) => mergeSale(state.sales.find((currentSale) => currentSale.id === sale.id), sale)) })),
        initialize: true,
      }).then((result) => result !== null).catch(() => false),

      fetchSale: (id: string) => run("sale-detail", (repository) => repository.getSaleById(id), {
        commit: (result) => replaceSale(set, result),
        initialize: true,
      }).then((result) => result !== null).catch(() => false),

      fetchPurchaseOrders: (query = { limit: 100 }) => run("purchase-orders", (repository) => repository.getPurchaseOrders(query), {
        commit: (result) => set({ purchaseOrders: result.map(clonePurchaseOrder) }),
        initialize: true,
      }).then((result) => result !== null).catch(() => false),

      fetchPurchaseOrder: (id: string) => run("purchase-order-detail", (repository) => repository.getPurchaseOrderById(id), {
        commit: (result) => replacePurchaseOrder(set, result),
        initialize: true,
      }).then((result) => result !== null).catch(() => false),

      createManualSale: (input) => {
        const payload = toManualSalePayload(input);
        const provisionalId = `pending-${Date.now()}`;
        const provisional = optimisticSale(payload, provisionalId);
        const previous = get().sales;
        return run("create-sale", (repository) => repository.createManualSale(payload), {
          commit: (result) => set((state) => ({ sales: [...state.sales.filter((sale) => sale.id !== provisionalId), cloneSale(withStockEvent(result, input.paymentStatus === "received" || input.paymentStatus === "PAID" ? "stock_deducted" : "stock_reserved"))] })),
          optimistic: () => set({ sales: [...previous, provisional] }),
          rollback: () => set({ sales: previous }),
          successMessage: "Venta registrada",
        });
      },

      confirmSale: (id) => mutateSale("confirm", id, (repository) => repository.confirmSale(id), (sale) => ({
        ...sale,
        paymentStatus: "received",
        history: [...sale.history, makeEvent("payment_received")],
      }), "Pago marcado como recibido", (result) => ({
        ...result,
        paymentStatus: "received",
        payment: result.payment ? { ...result.payment, status: "received" } : result.payment,
        history: result.history.some((event) => event.type === "payment_received")
          ? result.history
          : [...result.history, makeEvent("payment_received")],
      })),

      packSale: (id) => mutateSale("pack", id, (repository) => repository.packSale(id), (sale) => ({
        ...sale,
        shippingStatus: "to_ship",
        history: [...sale.history, makeEvent("package_packed")],
      }), "Pedido empaquetado"),

      unpackSale: (id) => mutateSale("unpack", id, (repository) => repository.unpackSale(id), (sale) => ({
        ...sale,
        shippingStatus: "to_pack",
        history: [...sale.history, makeEvent("package_unpacked")],
      }), "Pedido desempaquetado"),

      shipSale: (id, payload) => {
        const sale = get().sales.find((item) => item.id === id);
        const shipping = payload ?? { carrier: "EntrenAR", trackingCode: sale?.trackingCode ?? `TRK-${id}` };
        return mutateSale("ship", id, (repository) => repository.shipSale(id, shipping), (currentSale) => ({
          ...currentSale,
          shippingStatus: "shipped",
          trackingCode: shipping.trackingCode,
          history: [...currentSale.history, makeEvent("package_shipped")],
        }), "Envío notificado");
      },

      deliverSale: (id) => mutateSale("deliver", id, (repository) => repository.deliverSale(id), (sale) => ({
        ...sale,
        shippingStatus: "delivered",
        history: [...sale.history, makeEvent("sale_updated", "Venta entregada.")],
      }), "Venta entregada"),

      cancelSale: (id, input, options) => {
        const payload: CancelSalePayload = typeof input === "string"
          ? { cancellationReason: input, restoreStock: options?.restoreStock ?? true }
          : input;
        const sendEmail = typeof input === "string" ? options?.sendEmail ?? true : undefined;
        return mutateSale("cancel", id, (repository) => repository.cancelSale(id, payload), (sale) => ({
          ...sale,
          paymentStatus: "cancelled",
          shippingStatus: "cancelled",
          previousPaymentStatus: sale.paymentStatus,
          previousShippingStatus: sale.shippingStatus,
          cancellationReason: payload.cancellationReason,
          history: [...sale.history, makeEvent("sale_cancelled", `Motivo: ${payload.cancellationReason}`)],
        }), "Venta cancelada", (result) => withCancellationEvents(result, payload, sendEmail));
      },

      reopenSale: (id) => mutateSale("reopen", id, (repository) => repository.reopenSale(id), (sale) => ({
        ...sale,
        paymentStatus: sale.previousPaymentStatus ?? "pending",
        shippingStatus: sale.previousShippingStatus ?? "to_pack",
        cancellationReason: undefined,
        history: [...sale.history, makeEvent("sale_reopened")],
      }), "Venta re-abierta"),

      archiveSale: (id) => mutateSale("archive", id, (repository) => repository.archiveSale(id), (sale) => ({
        ...sale,
        archived: true,
        history: [...sale.history, makeEvent("sale_archived")],
      }), "Venta archivada"),

      unarchiveSale: (id) => mutateSale("unarchive", id, (repository) => repository.unarchiveSale(id), (sale) => ({
        ...sale,
        archived: false,
        history: [...sale.history, makeEvent("sale_updated", "Venta desarchivada.")],
      }), "Venta desarchivada"),

      addNote: (id, note) => mutateSale("note", id, (repository) => repository.addNote(id, note), (sale) => ({
        ...sale,
        notes: sale.notes ? `${sale.notes}\n${note}` : note,
        history: [...sale.history, makeEvent("sale_updated", note)],
      }), "Nota agregada"),

      createPurchaseOrder: (input) => {
        const provisionalId = generatePurchaseOrderId();
        const provisional = optimisticPurchaseOrder(input, provisionalId);
        const previous = get().purchaseOrders;
        return run("create-purchase-order", (repository) => repository.createPurchaseOrder(toPurchaseOrderPayload(input, repository.source)), {
          commit: (result) => set((state) => ({ purchaseOrders: [...state.purchaseOrders.filter((order) => order.id !== provisionalId), clonePurchaseOrder(result)] })),
          optimistic: () => set({ purchaseOrders: [...previous, provisional] }),
          rollback: () => set({ purchaseOrders: previous }),
          successMessage: "Orden de compra creada",
        }).then((result) => result?.id ?? null);
      },

      convertOrderToSale: (orderId) => {
        const previousSales = get().sales;
        const previousOrders = get().purchaseOrders;
        const order = previousOrders.find((item) => item.id === orderId);
        const provisionalId = generateNextSaleId(previousSales);
        const provisional = order ? optimisticSale({
          customer: { ...order.customer, email: order.customer.email ?? `${order.id}@offline.invalid` },
          products: order.products,
          paymentStatus: "received",
          shippingAddress: order.shippingAddress,
          shippingCost: order.shippingCost,
          source: order.source,
          subtotal: order.subtotal,
          total: order.total,
        }, provisionalId, order.id) : undefined;
        return run("convert-order", (repository) => repository.convertOrderToSale({ sourceOrderId: orderId }), {
          commit: (result) => set((state) => ({
            sales: [...state.sales.filter((sale) => sale.id !== provisionalId), cloneSale(withStockEvent(result, "stock_deducted"))],
            purchaseOrders: state.purchaseOrders.map((currentOrder) => currentOrder.id !== orderId ? currentOrder : { ...currentOrder, status: "converted", convertedSaleId: result.id }),
          })),
          optimistic: () => set((state) => ({
            sales: provisional ? [...state.sales, provisional] : state.sales,
            purchaseOrders: state.purchaseOrders.map((currentOrder) => currentOrder.id !== orderId ? currentOrder : { ...currentOrder, status: "converted", convertedSaleId: provisionalId }),
          })),
          rollback: () => set({ sales: previousSales, purchaseOrders: previousOrders }),
          successMessage: "Venta registrada",
        }).then((result) => result?.id ?? null);
      },

      submitPurchaseOrder: (id) => mutatePurchaseOrder("submit", id, (repository) => repository.submitPurchaseOrder(id), (order) => ({ ...order, status: "pending" }), "Orden de compra enviada"),
      receivePurchaseOrder: (id) => mutatePurchaseOrder("receive", id, (repository) => repository.receivePurchaseOrder(id), (order) => ({ ...order, status: "converted" }), "Orden de compra recibida"),
      cancelPurchaseOrder: (id) => mutatePurchaseOrder("cancel", id, (repository) => repository.cancelPurchaseOrder(id), (order) => ({ ...order, status: "cancelled" }), "Orden de compra cancelada"),

      createSale: async (input) => (await get().createManualSale(input))?.id ?? null,
      updateSale: async (id, input) => {
        const existing = get().sales.find((sale) => sale.id === id);
        if (!existing) return reportFailure(set, "SALE_NOT_FOUND", "La venta solicitada no está cargada.");
        set((state) => ({ sales: state.sales.map((sale) => sale.id !== id ? sale : { ...sale, ...input, history: [...sale.history, makeEvent("sale_updated")] }) }));
        addAdminToast("Venta actualizada");
        return true;
      },
      markPaymentReceived: (id) => get().confirmSale(id),
      markPacked: (id) => get().packSale(id),
      markUnpacked: (id) => get().unpackSale(id),
      markShipped: (id) => get().shipSale(id),
      updateShippingAddress: async (id, address) => {
        if (!get().sales.some((sale) => sale.id === id)) return reportFailure(set, "SALE_NOT_FOUND", "La venta solicitada no está cargada.");
        set((state) => ({ sales: state.sales.map((sale) => sale.id !== id ? sale : { ...sale, shippingAddress: { ...address }, history: [...sale.history, makeEvent("shipping_address_updated")] }) }));
        addAdminToast("Dirección actualizada");
        return true;
      },
      anonymizeCustomerSales: (customerId) => set((state) => ({
        sales: state.sales.map((sale) => sale.customerId !== customerId ? sale : {
          ...sale,
          customer: { firstName: `Cliente eliminado (${customerId})`, lastName: "" },
          shippingAddress: undefined,
          history: [...sale.history, makeEvent("sale_updated", "Datos personales del cliente eliminados.")],
        }),
      })),
      deletePurchaseOrder: async (id) => {
        const previous = get().purchaseOrders;
        set({ purchaseOrders: previous.filter((order) => order.id !== id) });
        addAdminToast("Orden eliminada", "info");
        return previous.length !== get().purchaseOrders.length;
      },
      retryLoad: async () => {
        activeRepository = configuredRepository;
        fallbackActive = false;
        set({ error: null, fallbackMessage: null, isFallback: false, source: configuredRepository.source });
        const [sales, orders] = await Promise.all([get().fetchSales({ limit: 100 }), get().fetchPurchaseOrders()]);
        if (sales && orders) addAdminToast("Ventas actualizadas");
        return sales && orders;
      },
      clearError: () => set((state) => ({ error: null, status: state.hasLoaded ? SALES_ASYNC_STATUS.SUCCESS : SALES_ASYNC_STATUS.IDLE })),
    } satisfies AdminSalesState;
  });

  return store;
}

export const useAdminSalesStore = createAdminSalesStore();
