import { buildCustomerDetailCsv, buildCustomersCsv } from "@/lib/data/admin/customers/csv";
import { z } from "zod";
import { mockCustomers } from "@/lib/data/admin/customers/mock-customers";
import type { Customer as LegacyCustomer } from "@/lib/data/admin/customers/types";
import { CustomersApiError } from "./client";
import { createCustomerInputSchema, customerEmailAvailabilitySchema, customerIdSchema, customerListQuerySchema, normalizeCustomerInput, updateCustomerInputSchema, updateCustomerNotesSchema } from "./contracts";
import type { CustomersRepository } from "./repository";
import type { CreateCustomerInput, Customer, CustomerDetail, CustomerListQuery, CustomerListResult, CustomerMutationResult, ParsedCustomerListQuery, UpdateCustomerInput } from "./types";

const ADDRESS_KEYS = ["street", "number", "floorOrApartment", "postalCode", "neighborhood", "city", "provinceOrState"] as const;

export class MockCustomersRepository implements CustomersRepository {
  readonly source = "mock" as const;
  private customers: Customer[];
  constructor(initialCustomers: readonly LegacyCustomer[] = mockCustomers) { this.customers = initialCustomers.map((customer) => cloneCustomer({ ...customer, tags: customer.tags ?? [] })); }

  async list(query: CustomerListQuery = {}): Promise<CustomerListResult> {
    const parsed = parse(customerListQuerySchema, query, "The customer list query is invalid.");
    const filtered = this.filtered(parsed);
    const start = (parsed.page - 1) * parsed.limit;
    return { items: filtered.slice(start, start + parsed.limit).map(cloneCustomer), limit: parsed.limit, page: parsed.page, total: filtered.length, totalPages: Math.ceil(filtered.length / parsed.limit) };
  }
  async getById(id: string): Promise<CustomerDetail> { const customer = this.find(id); return { ...cloneCustomer(customer), summary: cloneSummary(summary(customer)) }; }

  async create(input: CreateCustomerInput): Promise<CustomerMutationResult> {
    const parsed = parse(createCustomerInputSchema, normalizeCustomerInput(input), "The customer payload is invalid.");
    if (!(await this.isEmailAvailable(parsed.email))) return failure("EMAIL_EXISTS", "Ya existe un cliente activo con ese e-mail.");
    const customer = makeCustomer(parsed, this.nextId());
    this.customers = [...this.customers, customer];
    return success(customer);
  }

  async update(id: string, input: UpdateCustomerInput): Promise<CustomerMutationResult> {
    const current = this.findOrUndefined(id);
    if (!current) return failure("CUSTOMER_NOT_FOUND", "Cliente no encontrado.");
    if (current.isAnonymized) return failure("CUSTOMER_ANONYMIZED", "No se puede editar un cliente anonimizado.");
    const parsed = parse(updateCustomerInputSchema, normalizeCustomerInput(input), "The customer payload is invalid.");
    if (parsed.email !== undefined && !(await this.isEmailAvailable(parsed.email, id))) return failure("EMAIL_EXISTS", "Ya existe un cliente activo con ese e-mail.");
    const customer: Customer = { ...current, ...(parsed.email === undefined ? {} : { email: parsed.email }), ...(parsed.fullName === undefined ? {} : { fullName: parsed.fullName }), ...(parsed.phone === undefined ? {} : { phone: optional(parsed.phone) }), ...(parsed.dniOrCuil === undefined ? {} : { dniOrCuil: optional(parsed.dniOrCuil) }), ...(parsed.notes === undefined ? {} : { notes: optional(parsed.notes) }), ...(parsed.tags === undefined ? {} : { tags: parsed.tags }), updatedAt: now() };
    if (hasAddress(input)) { const address = addressFrom(parsed); if (address) customer.address = address; else delete customer.address; }
    this.customers = this.customers.map((entry) => entry.id === id ? customer : entry);
    return success(customer);
  }

  async updateNotes(id: string, notes: string): Promise<CustomerMutationResult> {
    const current = this.findOrUndefined(id);
    if (!current) return failure("CUSTOMER_NOT_FOUND", "Cliente no encontrado.");
    if (current.isAnonymized) return failure("CUSTOMER_ANONYMIZED", "No se puede editar un cliente anonimizado.");
    const parsed = parse(updateCustomerNotesSchema, { notes }, "The customer notes are invalid.");
    const customer = { ...current, notes: parsed.notes, updatedAt: now() };
    this.customers = this.customers.map((entry) => entry.id === id ? customer : entry);
    return success(customer);
  }

  async anonymize(id: string): Promise<CustomerMutationResult> {
    const current = this.findOrUndefined(id);
    if (!current) return failure("CUSTOMER_NOT_FOUND", "Cliente no encontrado.");
    if (current.isAnonymized) return success(current);
    const customer: Customer = { ...current, fullName: `Cliente eliminado (${id})`, email: "", phone: undefined, dniOrCuil: undefined, address: undefined, notes: undefined, isAnonymized: true, updatedAt: now() };
    this.customers = this.customers.map((entry) => entry.id === id ? customer : entry);
    return success(customer);
  }

  async exportCsv(query: CustomerListQuery = {}): Promise<string> { const parsed = parse(customerListQuerySchema, query, "The customer list query is invalid."); const customers = this.filtered(parsed); return buildCustomersCsv(customers, Object.fromEntries(customers.map((customer) => [customer.id, summary(customer)]))); }
  async exportCustomerDetailCsv(id: string): Promise<string> { const customer = this.find(id); if (customer.isAnonymized) throw repositoryError("CUSTOMER_ANONYMIZED", "No se puede exportar el detalle de un cliente anonimizado.", 400); return buildCustomerDetailCsv(customer, summary(customer), []); }

  async isEmailAvailable(email: string, excludeCustomerId?: string): Promise<boolean> {
    const parsed = parse(customerEmailAvailabilitySchema, { email, ...(excludeCustomerId ? { excludeCustomerId } : {}) }, "The customer email is invalid.");
    return !this.customers.some((customer) => !customer.isAnonymized && customer.id !== parsed.excludeCustomerId && customer.email.toLowerCase() === parsed.email);
  }

  private filtered(query: ParsedCustomerListQuery): Customer[] { return this.customers.filter((customer) => matches(customer, query)).sort((left, right) => compare(left, right, query)); }
  private find(id: string): Customer { const customerId = parse(customerIdSchema, id, "The customer identifier is invalid."); const customer = this.findOrUndefined(customerId); if (!customer) throw repositoryError("CUSTOMER_NOT_FOUND", "Cliente no encontrado.", 404); return customer; }
  private findOrUndefined(id: string): Customer | undefined { return this.customers.find((customer) => customer.id === id); }
  private nextId(): string { const max = this.customers.reduce((value, customer) => Math.max(value, Number(customer.id.replace("cus_", "")) || 0), 0); return `cus_${String(max + 1).padStart(3, "0")}`; }
}

function makeCustomer(input: CreateCustomerInput, id: string): Customer { const timestamp = now(); const customer: Customer = { id, fullName: input.fullName.trim(), email: input.email.trim().toLowerCase(), firstInteractionDate: timestamp.slice(0, 10), isAnonymized: false, createdAt: timestamp, updatedAt: timestamp, notes: optional(input.notes) ?? "", tags: input.tags ?? [] }; const address = addressFrom(input); if (address) customer.address = address; for (const key of ["phone", "dniOrCuil"] as const) if (input[key] !== undefined) customer[key] = optional(input[key]); return customer; }
function addressFrom(input: Partial<CreateCustomerInput>): Customer["address"] { if (!ADDRESS_KEYS.some((key) => Boolean(input[key]?.toString().trim()))) return undefined; return { street: input.street?.trim() ?? "", number: input.number?.trim() ?? "", floorOrApartment: optional(input.floorOrApartment), postalCode: input.postalCode?.trim() ?? "", neighborhood: optional(input.neighborhood), city: input.city?.trim() ?? "", provinceOrState: input.provinceOrState?.trim() ?? "", country: input.country?.trim() || "Argentina" }; }
function hasAddress(input: Partial<CreateCustomerInput>): boolean { return ADDRESS_KEYS.some((key) => key in input); }
function matches(customer: Customer, query: ParsedCustomerListQuery): boolean { const search = query.search?.toLowerCase(); const haystack = [customer.fullName, customer.email, customer.dniOrCuil].join(" ").toLowerCase(); const orders = summary(customer).ordersCount; return (!search || haystack.includes(search)) && (!query.city || customer.address?.city.toLowerCase() === query.city.toLowerCase()) && (!query.country || customer.address?.country.toLowerCase() === query.country.toLowerCase()) && (!query.provinceOrState || customer.address?.provinceOrState.toLowerCase() === query.provinceOrState.toLowerCase()) && (query.isAnonymized === undefined || customer.isAnonymized === query.isAnonymized) && (query.hasOrders === undefined || orders > 0 === query.hasOrders); }
function compare(left: Customer, right: Customer, query: ParsedCustomerListQuery): number { const value = (customer: Customer) => query.sortBy === "fullName" ? customer.fullName : query.sortBy === "email" ? customer.email : query.sortBy === "firstInteractionDate" ? customer.firstInteractionDate : query.sortBy === "updatedAt" ? customer.updatedAt : query.sortBy === "createdAt" ? customer.createdAt : query.sortBy === "ordersCount" ? summary(customer).ordersCount : summary(customer).totalSpent; const difference = typeof value(left) === "number" ? (value(left) as number) - (value(right) as number) : String(value(left)).localeCompare(String(value(right))); return (query.sortOrder === "asc" ? difference : -difference) || (query.sortOrder === "asc" ? left.id.localeCompare(right.id) : right.id.localeCompare(left.id)); }
function summary(customer: Customer) { return customer.summary ?? { totalSpent: 0, ordersCount: 0 }; }
function cloneSummary(value: ReturnType<typeof summary>) { return { ...value, ...(value.lastOrder ? { lastOrder: { ...value.lastOrder } } : {}) }; }
function cloneCustomer(customer: Customer): Customer { return { ...customer, ...(customer.address ? { address: { ...customer.address } } : {}), tags: [...(customer.tags ?? [])], ...(customer.summary ? { summary: cloneSummary(customer.summary) } : {}) }; }
function optional(value: string | null | undefined): string | undefined { const result = value?.trim(); return result || undefined; }
function now(): string { return new Date().toISOString(); }
function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T { const result = schema.safeParse(value); if (result.success) return result.data; throw repositoryError("VALIDATION_ERROR", message, 400, result.error.issues.map((issue) => ({ code: issue.code, field: issue.path.map(String).join(".") || "request", message: issue.message }))); }
function success(customer: Customer): CustomerMutationResult { return { ok: true, customer: cloneCustomer(customer), customerId: customer.id }; }
function failure(code: "CUSTOMER_ANONYMIZED" | "CUSTOMER_NOT_FOUND" | "EMAIL_EXISTS", message: string): CustomerMutationResult { return { ok: false, code, message }; }
function repositoryError(code: string, message: string, status: number, issues: readonly { code: string; field: string; message: string }[] = []): CustomersApiError { return new CustomersApiError({ code, message, status, issues }); }
