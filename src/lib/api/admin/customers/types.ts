import type { Customer as LegacyCustomer, CustomerAddress, CustomerLastOrder, CustomerSalesSummary } from "@/lib/data/admin/customers/types";
export type { CustomerAddress, CustomerLastOrder, CustomerSalesSummary };
export const CUSTOMER_SORT_BY = { CREATED_AT: "createdAt", EMAIL: "email", FIRST_INTERACTION_DATE: "firstInteractionDate", FULL_NAME: "fullName", ORDERS_COUNT: "ordersCount", TOTAL_SPENT: "totalSpent", UPDATED_AT: "updatedAt" } as const;
export type CustomerSortBy = (typeof CUSTOMER_SORT_BY)[keyof typeof CUSTOMER_SORT_BY];
export type SortOrder = "asc" | "desc";
export type CustomerDataSource = "api" | "mock";
export type Customer = LegacyCustomer & { tags: string[]; summary?: CustomerSalesSummary };
export type CustomerDetail = Customer & { summary: CustomerSalesSummary };
export type CustomerDetailResult = CustomerDetail;
export type CustomerListQuery = { city?: string; country?: string; hasOrders?: boolean; isAnonymized?: boolean; limit?: number; page?: number; provinceOrState?: string; search?: string; sortBy?: CustomerSortBy; sortOrder?: SortOrder };
export type ParsedCustomerListQuery = Required<Pick<CustomerListQuery, "limit" | "page" | "sortBy" | "sortOrder">> & CustomerListQuery;
export type CustomerProfileInput = { city?: string | null; country?: string | null; dniOrCuil?: string | null; email?: string; floorOrApartment?: string | null; fullName?: string; neighborhood?: string | null; notes?: string | null; number?: string | null; phone?: string | null; postalCode?: string | null; provinceOrState?: string | null; street?: string | null; tags?: string[] };
export type CustomerAddressInput = Pick<CustomerProfileInput, "city" | "country" | "floorOrApartment" | "neighborhood" | "number" | "postalCode" | "provinceOrState" | "street">;
export type CreateCustomerInput = Required<Pick<CustomerProfileInput, "email" | "fullName">>
  & Omit<CustomerProfileInput, "email" | "fullName">;
export type UpdateCustomerInput = CustomerProfileInput;
export type CustomerApiIssue = { code: string; field: string; message: string };
export type CustomerMutationResult =
  | { ok: true; customer: Customer; customerId: string }
  | { ok: false; code: "CUSTOMER_ANONYMIZED" | "CUSTOMER_NOT_FOUND" | "EMAIL_EXISTS"; message: string };
export type CustomerListResult = { items: Customer[]; limit: number; page: number; total: number; totalPages: number };
