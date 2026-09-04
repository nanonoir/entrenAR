import type { DataSource } from "@/lib/api/config";
import type {
  AdminPurchaseOrder,
  AdminSale,
  SaleAddress,
  SaleCustomer,
  SaleHistoryEvent,
  SalePaymentStatus,
  SaleProduct,
  SaleShippingStatus,
} from "@/lib/data/admin/sales-flow/types";

export const SALE_ORDER_STATUS = {
  CANCELLED: "cancelled",
  CONFIRMED: "confirmed",
  PENDING: "pending",
} as const;

export type SaleOrderStatus = (typeof SALE_ORDER_STATUS)[keyof typeof SALE_ORDER_STATUS];

export const BACKEND_SALE_STATUS = {
  CANCELLED: "CANCELLED",
  CONFIRMED: "CONFIRMED",
  PENDING: "PENDING",
} as const;

export type BackendSaleStatus = (typeof BACKEND_SALE_STATUS)[keyof typeof BACKEND_SALE_STATUS];

export const SALE_DELIVERY_TYPE = {
  PICKUP: "pickup",
  SHIPPING: "shipping",
} as const;

export type SaleDeliveryType = (typeof SALE_DELIVERY_TYPE)[keyof typeof SALE_DELIVERY_TYPE];

export const SALES_SORT_BY = {
  CREATED_AT: "createdAt",
  CUSTOMER_NAME: "customerName",
  NUMBER: "number",
  TOTAL: "total",
  UPDATED_AT: "updatedAt",
} as const;

export type SalesSortBy = (typeof SALES_SORT_BY)[keyof typeof SALES_SORT_BY];

export const SORT_ORDER = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER];

export interface SalesDateRange {
  from: Date | string;
  to: Date | string;
}

export interface SalesFilterQuery {
  dateFrom?: Date | string;
  dateRange?: SalesDateRange;
  dateTo?: Date | string;
  isArchived?: boolean;
  limit?: number;
  page?: number;
  paymentStatus?: SalePaymentStatus;
  search?: string;
  shippingStatus?: SaleShippingStatus;
  sortBy?: SalesSortBy;
  sortOrder?: SortOrder;
  status?: SaleOrderStatus;
}

export interface PaginatedSalesResult {
  items: AdminSale[];
  limit: number;
  page: number;
  total: number;
}

export interface SaleSnapshot {
  [key: string]: unknown;
}

export interface AdminSalePayment {
  amount: number;
  bankTransferSnapshot?: SaleSnapshot;
  currency: string;
  paymentMethodId: string;
  paymentMethodSnapshot: SaleSnapshot;
  paymentOptionId?: string;
  status: SalePaymentStatus;
}

export interface AdminSaleDetail extends AdminSale {
  backendStatus: BackendSaleStatus;
  confirmedAt?: string;
  currency: string;
  customerSnapshot: SaleSnapshot;
  deliveredAt?: string;
  deliverySnapshot: SaleSnapshot;
  deliveryType: SaleDeliveryType;
  discountAmount: number;
  discountSnapshot: SaleSnapshot;
  history: SaleHistoryEvent[];
  internalNotes?: string;
  items: SaleProduct[];
  packedAt?: string;
  payment: AdminSalePayment | null;
  shippedAt?: string;
  shippingCarrier?: string;
  shippingTrackingUrl?: string;
  status: SaleOrderStatus;
  subtotal: number;
  updatedAt: string;
}

export const SUPPLIER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type SupplierStatus = (typeof SUPPLIER_STATUS)[keyof typeof SUPPLIER_STATUS];

export interface Supplier {
  code: string;
  contactName?: string;
  createdAt: string;
  email?: string;
  id: string;
  name: string;
  notes?: string;
  phone?: string;
  status: SupplierStatus;
  updatedAt: string;
}

export interface SupplierFilterQuery {
  limit?: number;
  page?: number;
  search?: string;
  sortBy?: "name" | "code" | "status" | "createdAt" | "updatedAt";
  sortOrder?: SortOrder;
  status?: SupplierStatus;
}

export const PURCHASE_ORDER_BACKEND_STATUS = {
  CANCELLED: "CANCELLED",
  DRAFT: "DRAFT",
  ORDERED: "ORDERED",
  RECEIVED: "RECEIVED",
} as const;

export type PurchaseOrderBackendStatus =
  (typeof PURCHASE_ORDER_BACKEND_STATUS)[keyof typeof PURCHASE_ORDER_BACKEND_STATUS];

export const PURCHASE_ORDER_FILTER_STATUS = {
  CANCELLED: "cancelled",
  DRAFT: "draft",
  ORDERED: "ordered",
  RECEIVED: "received",
} as const;

export type PurchaseOrderFilterStatus =
  (typeof PURCHASE_ORDER_FILTER_STATUS)[keyof typeof PURCHASE_ORDER_FILTER_STATUS];

export interface PurchaseOrderFilterQuery {
  limit?: number;
  page?: number;
  search?: string;
  sortBy?: "createdAt" | "expectedDate" | "orderNumber" | "status" | "total" | "updatedAt";
  sortOrder?: SortOrder;
  status?: PurchaseOrderFilterStatus;
  supplierId?: string;
}

export type PurchaseOrder = AdminPurchaseOrder & {
  backendStatus?: PurchaseOrderBackendStatus;
  expectedDate?: string;
  orderNumber?: string;
  receivedAt?: string;
  supplier?: Supplier;
  supplierId?: string;
  tax?: number;
  updatedAt?: string;
};

export type PurchaseOrderDetail = PurchaseOrder;

export interface SaleItemPayload {
  attributes?: SaleSnapshot;
  compareAtPrice?: number;
  lineSubtotal?: number;
  name?: string;
  productId: string;
  productName?: string;
  quantity: number;
  sku?: string;
  snapshot?: SaleSnapshot;
  unitPrice: number;
  variantId?: string;
  variantName?: string;
  weightGrams?: number;
}

export interface CustomerPayload extends Omit<SaleCustomer, "email"> {
  email: string;
  dni?: string;
}

export interface CreateManualSalePayload {
  currency?: string;
  customer: CustomerPayload;
  deliverySnapshot?: SaleSnapshot;
  deliveryType?: SaleDeliveryType | Uppercase<SaleDeliveryType>;
  discountAmount?: number;
  discountSnapshot?: SaleSnapshot;
  discountType?: "fixed" | "percentage";
  discountValue?: number;
  internalNotes?: string;
  items?: readonly SaleItemPayload[];
  paymentMethodId?: string;
  paymentMethodSnapshot?: SaleSnapshot;
  paymentOptionId?: string;
  paymentStatus?: SalePaymentStatus | "PAID" | "PENDING" | "REFUNDED";
  products?: readonly SaleProduct[];
  shippingAddress?: SaleAddress;
  shippingCost?: number;
  source?: string;
  subtotal?: number;
  total?: number;
}

export interface ConvertOrderToSalePayload {
  orderId?: string;
  sourceOrderId?: string;
}

export interface ShipSalePayload {
  carrier: string;
  trackingCode: string;
  trackingUrl?: string;
}

export interface CancelSalePayload {
  cancellationReason: string;
  restoreStock: boolean;
}

export interface CreateSupplierPayload {
  code: string;
  contactName?: string | null;
  email?: string | null;
  name: string;
  notes?: string | null;
  phone?: string | null;
  status?: SupplierStatus;
}

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>;

export interface PurchaseOrderItemPayload {
  name?: string;
  productId: string;
  quantity: number;
  sku?: string;
  title?: string;
  totalCost?: number;
  unitCost?: number;
  unitPrice?: number;
  variantId?: string | null;
}

export interface CreatePurchaseOrderPayload {
  expectedDate?: Date | string | null;
  items?: readonly PurchaseOrderItemPayload[];
  notes?: string | null;
  orderNumber?: string;
  products?: readonly SaleProduct[];
  shippingCost?: number;
  subtotal?: number;
  supplierId: string;
  tax?: number;
  total?: number;
}

export interface SalesRepository {
  readonly source: DataSource;

  getSales(query?: SalesFilterQuery): Promise<PaginatedSalesResult>;
  getSaleById(id: string): Promise<AdminSaleDetail>;
  createManualSale(payload: CreateManualSalePayload): Promise<AdminSaleDetail>;
  convertOrderToSale(payload: ConvertOrderToSalePayload): Promise<AdminSaleDetail>;
  confirmSale(id: string): Promise<AdminSaleDetail>;
  packSale(id: string): Promise<AdminSaleDetail>;
  unpackSale(id: string): Promise<AdminSaleDetail>;
  shipSale(id: string, payload: ShipSalePayload): Promise<AdminSaleDetail>;
  deliverSale(id: string): Promise<AdminSaleDetail>;
  cancelSale(id: string, payload: CancelSalePayload): Promise<AdminSaleDetail>;
  reopenSale(id: string): Promise<AdminSaleDetail>;
  archiveSale(id: string): Promise<AdminSaleDetail>;
  unarchiveSale(id: string): Promise<AdminSaleDetail>;
  addNote(id: string, note: string): Promise<AdminSaleDetail>;

  getSuppliers(query?: SupplierFilterQuery): Promise<Supplier[]>;
  createSupplier(payload: CreateSupplierPayload): Promise<Supplier>;
  updateSupplier(id: string, payload: UpdateSupplierPayload): Promise<Supplier>;
  toggleSupplierStatus(id: string): Promise<Supplier>;

  getPurchaseOrders(query?: PurchaseOrderFilterQuery): Promise<PurchaseOrder[]>;
  getPurchaseOrderById(id: string): Promise<PurchaseOrderDetail>;
  createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrderDetail>;
  submitPurchaseOrder(id: string): Promise<PurchaseOrderDetail>;
  receivePurchaseOrder(id: string): Promise<PurchaseOrderDetail>;
  cancelPurchaseOrder(id: string): Promise<PurchaseOrderDetail>;
}

export type { AdminPurchaseOrder, AdminSale, SaleAddress, SaleCustomer, SaleHistoryEvent, SaleProduct };
