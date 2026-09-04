import {
  FetchSalesApiClient,
  type SalesApiClient,
} from "./client";
import {
  mapAdminSaleDetail,
  mapPurchaseOrderResponse,
  mapPurchaseOrdersListResponse,
  mapSalesListResponse,
  mapSupplierResponse,
  mapSuppliersListResponse,
} from "./sales-api.mappers";
import {
  toAddSaleNotePayload,
  toCancelSalePayload,
  toConvertOrderToSalePayload,
  toCreateManualSalePayload,
  toCreatePurchaseOrderPayload,
  toCreateSupplierPayload,
  toPurchaseOrderQueryParams,
  toSalesQueryParams,
  toShipSalePayload,
  toSupplierQueryParams,
  toSupplierStatusPayload,
  toUpdateSupplierPayload,
} from "./sales-api.payloads";
import type {
  AdminSaleDetail,
  CancelSalePayload,
  ConvertOrderToSalePayload,
  CreateManualSalePayload,
  CreatePurchaseOrderPayload,
  CreateSupplierPayload,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderFilterQuery,
  PaginatedSalesResult,
  SalesFilterQuery,
  SalesRepository,
  ShipSalePayload,
  Supplier,
  SupplierFilterQuery,
  UpdateSupplierPayload,
} from "./sales.repository";

export class ApiSalesRepository implements SalesRepository {
  readonly source = "api" as const;

  constructor(private readonly client: SalesApiClient = new FetchSalesApiClient()) {}

  async getSales(query: SalesFilterQuery = {}): Promise<PaginatedSalesResult> {
    const response = await this.client.get<unknown>(withQuery("/admin/sales", toSalesQueryParams(query)));
    return mapSalesListResponse(response);
  }

  async getSaleById(id: string): Promise<AdminSaleDetail> {
    const response = await this.client.get<unknown>(`/admin/sales/${encodeURIComponent(id)}`);
    return mapAdminSaleDetail(response);
  }

  async createManualSale(payload: CreateManualSalePayload): Promise<AdminSaleDetail> {
    const response = await this.client.post<unknown>("/admin/sales", toCreateManualSalePayload(payload));
    return mapAdminSaleDetail(response);
  }

  async convertOrderToSale(payload: ConvertOrderToSalePayload): Promise<AdminSaleDetail> {
    const response = await this.client.post<unknown>("/admin/sales/convert-order", toConvertOrderToSalePayload(payload));
    return mapAdminSaleDetail(response);
  }

  async confirmSale(id: string): Promise<AdminSaleDetail> {
    return this.executeSaleCommand(id, "confirm");
  }

  async packSale(id: string): Promise<AdminSaleDetail> {
    return this.executeSaleCommand(id, "pack");
  }

  async unpackSale(id: string): Promise<AdminSaleDetail> {
    return this.executeSaleCommand(id, "unpack");
  }

  async shipSale(id: string, payload: ShipSalePayload): Promise<AdminSaleDetail> {
    const response = await this.client.post<unknown>(
      saleCommandPath(id, "ship"),
      toShipSalePayload(payload),
    );
    return mapAdminSaleDetail(response);
  }

  async deliverSale(id: string): Promise<AdminSaleDetail> {
    return this.executeSaleCommand(id, "deliver");
  }

  async cancelSale(id: string, payload: CancelSalePayload): Promise<AdminSaleDetail> {
    const response = await this.client.post<unknown>(
      saleCommandPath(id, "cancel"),
      toCancelSalePayload(payload),
    );
    return mapAdminSaleDetail(response);
  }

  async reopenSale(id: string): Promise<AdminSaleDetail> {
    return this.executeSaleCommand(id, "reopen");
  }

  async archiveSale(id: string): Promise<AdminSaleDetail> {
    return this.executeSaleCommand(id, "archive");
  }

  async unarchiveSale(id: string): Promise<AdminSaleDetail> {
    return this.executeSaleCommand(id, "unarchive");
  }

  async addNote(id: string, note: string): Promise<AdminSaleDetail> {
    const response = await this.client.post<unknown>(
      saleCommandPath(id, "notes"),
      toAddSaleNotePayload(note),
    );
    return mapAdminSaleDetail(response);
  }

  async getSuppliers(query: SupplierFilterQuery = {}): Promise<Supplier[]> {
    const response = await this.client.get<unknown>(withQuery("/admin/suppliers", toSupplierQueryParams(query)));
    return mapSuppliersListResponse(response);
  }

  async createSupplier(payload: CreateSupplierPayload): Promise<Supplier> {
    const response = await this.client.post<unknown>("/admin/suppliers", toCreateSupplierPayload(payload));
    return mapSupplierResponse(response);
  }

  async updateSupplier(id: string, payload: UpdateSupplierPayload): Promise<Supplier> {
    const response = await this.client.put<unknown>(
      `/admin/suppliers/${encodeURIComponent(id)}`,
      toUpdateSupplierPayload(payload),
    );
    return mapSupplierResponse(response);
  }

  async toggleSupplierStatus(id: string): Promise<Supplier> {
    const current = mapSupplierResponse(await this.client.get<unknown>(`/admin/suppliers/${encodeURIComponent(id)}`));
    const response = await this.client.patch<unknown>(
      `/admin/suppliers/${encodeURIComponent(id)}/status`,
      toSupplierStatusPayload(current.status === "active" ? "inactive" : "active"),
    );
    return mapSupplierResponse(response);
  }

  async getPurchaseOrders(query: PurchaseOrderFilterQuery = {}): Promise<PurchaseOrder[]> {
    const response = await this.client.get<unknown>(withQuery("/admin/purchase-orders", toPurchaseOrderQueryParams(query)));
    return mapPurchaseOrdersListResponse(response);
  }

  async getPurchaseOrderById(id: string): Promise<PurchaseOrderDetail> {
    const response = await this.client.get<unknown>(`/admin/purchase-orders/${encodeURIComponent(id)}`);
    return mapPurchaseOrderResponse(response);
  }

  async createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrderDetail> {
    const response = await this.client.post<unknown>("/admin/purchase-orders", toCreatePurchaseOrderPayload(payload));
    return mapPurchaseOrderResponse(response);
  }

  async submitPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
    return this.executePurchaseOrderCommand(id, "submit");
  }

  async receivePurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
    return this.executePurchaseOrderCommand(id, "receive");
  }

  async cancelPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
    return this.executePurchaseOrderCommand(id, "cancel");
  }

  private async executeSaleCommand(id: string, command: SaleCommand): Promise<AdminSaleDetail> {
    const response = await this.client.post<unknown>(saleCommandPath(id, command), {});
    return mapAdminSaleDetail(response);
  }

  private async executePurchaseOrderCommand(id: string, command: PurchaseOrderCommand): Promise<PurchaseOrderDetail> {
    const response = await this.client.post<unknown>(purchaseOrderCommandPath(id, command), {});
    return mapPurchaseOrderResponse(response);
  }
}

export const getAdminSalesRepository = (client?: SalesApiClient): ApiSalesRepository => new ApiSalesRepository(client);

type SaleCommand = "archive" | "confirm" | "deliver" | "reopen" | "unarchive" | "unpack" | "pack";
type PurchaseOrderCommand = "cancel" | "receive" | "submit";

function saleCommandPath(id: string, command: SaleCommand | "cancel" | "notes" | "ship"): string {
  return `/admin/sales/${encodeURIComponent(id)}/${command}`;
}

function purchaseOrderCommandPath(id: string, command: PurchaseOrderCommand): string {
  return `/admin/purchase-orders/${encodeURIComponent(id)}/${command}`;
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
