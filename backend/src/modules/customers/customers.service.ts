import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { Prisma } from "../../generated/prisma/client";
import { OrderHistoryEventType, Role } from "../../generated/prisma/enums";
import {
  createCustomerSchema,
  customerIdSchema,
  customerListQuerySchema,
  updateCustomerNotesSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type CustomerAddressInput,
  type CustomerListQuery,
  type UpdateCustomerInput,
} from "./customers.schemas";
import {
  toCustomerDetailResponseDto,
  toCustomerResponseDto,
  type CustomerDetailResponseDto,
  type CustomerResponseDto,
} from "./customers.mapper";
import {
  CustomersRepository,
  customerDetailInclude,
  type CustomerAddressCreateData,
  type CustomerCreateData,
  type CustomerDetailRecord,
  type CustomerListRecord,
  type CustomerUpdateData,
} from "./customers.repository";

const CUSTOMER_EXPORT_PAGE_SIZE = 100;
const CUSTOMER_LIST_CSV_HEADER = [
  "ID",
  "Nombre y apellido",
  "E-mail",
  "Teléfono",
  "DNI/CUIL",
  "País",
  "Provincia/Estado",
  "Ciudad",
  "Dirección completa",
  "Total consumido",
  "Cantidad de ventas",
  "Última compra",
  "Primera interacción",
] as const;
const CUSTOMER_ANONYMIZATION_DESCRIPTION = "Customer personal data anonymized";

export interface CustomerActor {
  id?: string;
  role?: Role;
  userId?: string;
}

export interface CustomerPageDto {
  items: CustomerResponseDto[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class CustomersService {
  constructor(private readonly customersRepository: CustomersRepository) {}

  async listCustomers(query: unknown): Promise<CustomerPageDto> {
    const parsed = parse(customerListQuerySchema, query);
    const page = await this.customersRepository.findMany(parsed);

    return {
      items: page.items.map((customer) => toCustomerResponseDto(customer)),
      limit: parsed.limit,
      page: parsed.page,
      total: page.total,
      totalPages: Math.ceil(page.total / parsed.limit),
    };
  }

  async getCustomer(id: unknown): Promise<CustomerDetailResponseDto> {
    const customerId = parse(customerIdSchema, id);
    const customer = await this.customersRepository.findById(customerId);

    if (!customer) {
      throw this.customerNotFound();
    }

    return toCustomerDetailResponseDto(customer);
  }

  async createCustomer(input: unknown): Promise<CustomerResponseDto> {
    const parsed = parse(createCustomerSchema, input);

    if (!(await this.isEmailAvailable(parsed.email))) {
      throw this.emailExists();
    }

    const customer = await this.customersRepository.create(toCustomerCreateData(parsed));
    return toCustomerResponseDto(customer);
  }

  async updateCustomer(id: unknown, input: unknown): Promise<CustomerResponseDto> {
    const customerId = parse(customerIdSchema, id);
    const parsed = parse(updateCustomerSchema, input);
    const existing = await this.customersRepository.findById(customerId);

    this.assertCustomerEditable(existing);

    if (parsed.email !== undefined && !(await this.isEmailAvailable(parsed.email, customerId))) {
      throw this.emailExists();
    }

    const customer = await this.customersRepository.update(customerId, toCustomerUpdateData(parsed));
    return toCustomerResponseDto(customer);
  }

  async updateCustomerNotes(id: unknown, input: unknown): Promise<CustomerResponseDto> {
    const customerId = parse(customerIdSchema, id);
    const parsed = parse(updateCustomerNotesSchema, input);
    const existing = await this.customersRepository.findById(customerId);

    this.assertCustomerEditable(existing);

    const customer = await this.customersRepository.updateNotes(customerId, parsed.notes);
    return toCustomerResponseDto(customer);
  }

  async anonymizeCustomer(id: unknown, actor?: CustomerActor): Promise<CustomerResponseDto> {
    const customerId = parse(customerIdSchema, id);
    const existing = await this.customersRepository.findById(customerId);

    if (!existing) {
      throw this.customerNotFound();
    }

    if (existing.isAnonymized) {
      return toCustomerResponseDto(existing);
    }

    const anonymizedName = `Cliente eliminado (${customerId})`;
    return this.customersRepository.transaction(async (transaction) => {
      const current = await this.customersRepository.findById(transaction, customerId);
      if (!current) {
        throw this.customerNotFound();
      }

      if (current.isAnonymized) {
        return toCustomerResponseDto(current);
      }

      const updatedCustomer = await transaction.customer.update({
        data: {
          dniOrCuil: null,
          email: "",
          fullName: anonymizedName,
          isAnonymized: true,
          notes: null,
          phone: null,
          userId: null,
        },
        include: customerDetailInclude,
        where: { id: customerId },
      });

      await transaction.customerAddress.deleteMany({ where: { customerId } });
      const orders = await transaction.order.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
        where: { customerId },
      });

      for (const order of orders) {
        await transaction.order.update({
          data: {
            customerDni: null,
            customerEmail: "",
            customerFirstName: "Cliente",
            customerLastName: "eliminado",
            customerPhone: null,
            customerSnapshot: {
              email: "",
              fullName: anonymizedName,
              id: customerId,
              isAnonymized: true,
            },
            shippingAddressSnapshot: Prisma.JsonNull,
          },
          where: { id: order.id },
        });

        await transaction.orderHistory.create({
          data: {
            actorId: actor?.id ?? actor?.userId ?? null,
            actorRole: actor?.role ?? Role.ADMIN,
            description: CUSTOMER_ANONYMIZATION_DESCRIPTION,
            metadata: {
              description: CUSTOMER_ANONYMIZATION_DESCRIPTION,
              type: "SALE_UPDATED",
            },
            orderId: order.id,
            title: "Customer data anonymized",
            type: OrderHistoryEventType.NOTE_ADDED,
          },
        });
      }

      return toCustomerResponseDto({
        ...updatedCustomer,
        address: null,
        dniOrCuil: null,
        email: "",
        fullName: anonymizedName,
        isAnonymized: true,
        notes: null,
        phone: null,
        userId: null,
      });
    });
  }

  async exportCustomersListCsv(query: unknown): Promise<string> {
    const parsed = parse(customerListQuerySchema, query);
    const customers = await this.findAllCustomers(parsed);
    const rows = customers.map((customer) => {
      const summary = toCustomerDetailResponseDto(customer).summary;
      const anonymized = customer.isAnonymized;

      return csvRow([
        customer.id,
        anonymized ? `Cliente eliminado (${customer.id})` : customer.fullName,
        anonymized ? "" : customer.email,
        anonymized ? "" : customer.phone,
        anonymized ? "" : customer.dniOrCuil,
        anonymized ? "" : customer.address?.country,
        anonymized ? "" : customer.address?.provinceOrState,
        anonymized ? "" : customer.address?.city,
        anonymized ? "" : formatCustomerAddress(customer.address),
        summary.totalSpent,
        summary.ordersCount,
        summary.lastOrder ? `${summary.lastOrder.number} ${summary.lastOrder.date}` : "",
        toIsoDate(customer.firstInteractionDate),
      ]);
    });

    return `\uFEFF${[csvRow(CUSTOMER_LIST_CSV_HEADER), ...rows].join("\n")}`;
  }

  async exportCustomerDetailCsv(id: unknown): Promise<string> {
    const customerId = parse(customerIdSchema, id);
    const customer = await this.customersRepository.findById(customerId);

    if (!customer) {
      throw this.customerNotFound();
    }

    if (customer.isAnonymized) {
      throw new BadRequestException({
        code: ERROR_CODE.CUSTOMER_ANONYMIZED,
        message: "No se puede exportar el detalle de un cliente anonimizado.",
        ok: false,
      });
    }

    const summary = toCustomerDetailResponseDto(customer).summary;
    const lines = [
      csvRow(["Campo", "Valor"]),
      csvRow(["ID", customer.id]),
      csvRow(["Nombre y apellido", customer.fullName]),
      csvRow(["E-mail", customer.email]),
      csvRow(["Teléfono", customer.phone]),
      csvRow(["DNI/CUIL", customer.dniOrCuil]),
      csvRow(["Primera interacción", toIsoDate(customer.firstInteractionDate)]),
      csvRow(["Dirección de envío", formatCustomerAddress(customer.address)]),
      csvRow(["Total consumido", summary.totalSpent]),
      csvRow(["Cantidad de ventas", summary.ordersCount]),
      csvRow(["Última compra", summary.lastOrder ? `${summary.lastOrder.number} ${summary.lastOrder.date}` : ""]),
      csvRow(["Notas internas", customer.notes]),
      csvRow([
        "Historial de ventas",
        customer.orders.map((order) => `${order.number} ${toIsoDate(order.createdAt)} ${Number(order.total)}`).join(" | "),
      ]),
    ];

    return `\uFEFF${lines.join("\n")}`;
  }

  async isEmailAvailable(email: string, excludeCustomerId?: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.customersRepository.findByActiveEmail(normalizedEmail, excludeCustomerId);
    return existing === null;
  }

  private assertCustomerEditable(customer: Awaited<ReturnType<CustomersRepository["findById"]>>): void {
    if (!customer) {
      throw this.customerNotFound();
    }

    if (customer.isAnonymized) {
      throw new BadRequestException({
        code: ERROR_CODE.CUSTOMER_ANONYMIZED,
        message: "No se puede editar un cliente anonimizado.",
        ok: false,
      });
    }
  }

  private customerNotFound(): NotFoundException {
    return new NotFoundException({
      code: ERROR_CODE.CUSTOMER_NOT_FOUND,
      message: "Cliente no encontrado.",
      ok: false,
    });
  }

  private emailExists(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.EMAIL_EXISTS,
      message: "Ya existe un cliente activo con ese e-mail.",
      ok: false,
    });
  }

  private async findAllCustomers(query: CustomerListQuery): Promise<CustomerListRecord[]> {
    const customers: CustomerListRecord[] = [];
    let page = 1;

    while (true) {
      const result = await this.customersRepository.findMany({
        ...query,
        limit: CUSTOMER_EXPORT_PAGE_SIZE,
        page,
      });
      customers.push(...result.items);

      if (customers.length >= result.total || result.items.length === 0) {
        return customers;
      }

      page += 1;
    }
  }
}

type CustomerAddressFields = Pick<
  CustomerAddressInput,
  "city" | "country" | "floorOrApartment" | "neighborhood" | "number" | "postalCode" | "provinceOrState" | "street"
>;

function toCustomerCreateData(input: CreateCustomerInput): CustomerCreateData {
  const { city, country, floorOrApartment, neighborhood, number, postalCode, provinceOrState, street, ...customer } = input;
  const address = toAddress({ city, country, floorOrApartment, neighborhood, number, postalCode, provinceOrState, street });
  return { ...customer, ...(address ? { address } : {}) } as CustomerCreateData;
}

function toCustomerUpdateData(input: UpdateCustomerInput): CustomerUpdateData {
  const { city, country, floorOrApartment, neighborhood, number, postalCode, provinceOrState, street, ...customer } = input;
  const address = toAddress({ city, country, floorOrApartment, neighborhood, number, postalCode, provinceOrState, street });
  return { ...customer, ...(address ? { address } : {}) } as CustomerUpdateData;
}

function toAddress(input: CustomerAddressFields): CustomerAddressCreateData | undefined {
  const hasAddress = Object.values(input).some((value) => typeof value === "string" && value.trim().length > 0);
  if (!hasAddress) return undefined;

  return {
    city: input.city as string,
    country: input.country as string,
    ...(input.floorOrApartment === undefined ? {} : { floorOrApartment: input.floorOrApartment }),
    ...(input.neighborhood === undefined ? {} : { neighborhood: input.neighborhood }),
    number: input.number as string,
    postalCode: input.postalCode as string,
    provinceOrState: input.provinceOrState as string,
    street: input.street as string,
  };
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  throw new BadRequestException({
    code: ERROR_CODE.VALIDATION_ERROR,
    issues: result.error.issues.map((issue) => ({
      code: issue.code,
      field: issue.path.join(".") || "request",
      message: issue.message,
    })),
    message: "Request validation failed.",
    ok: false,
  });
}

type CsvValue = string | number | null | undefined;

function csvRow(values: readonly CsvValue[]): string {
  return values.map(escapeCsvCell).join(";");
}

function escapeCsvCell(value: CsvValue): string {
  const rawText = String(value ?? "");
  const text = /^[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatCustomerAddress(address: CustomerDetailRecord["address"]): string {
  if (!address) return "Sin dirección cargada";

  const firstLine = `${address.street} ${address.number}${address.floorOrApartment ? `, ${address.floorOrApartment}` : ""}`.trim();
  const secondLine = [address.neighborhood, address.city, address.provinceOrState, address.country].filter(Boolean).join(", ");
  return [firstLine, address.postalCode ? `CP ${address.postalCode}` : undefined, secondLine].filter(Boolean).join(" · ");
}

function toIsoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
