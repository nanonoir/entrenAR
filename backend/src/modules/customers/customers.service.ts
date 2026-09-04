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
