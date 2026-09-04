import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { SupplierStatus } from "../../generated/prisma/enums";
import { SuppliersRepository, type SupplierRecord, type TransactionClient } from "./suppliers.repository";
import type { CreateSupplierDto, SupplierFilterQueryDto, SupplierListResponseDto, SupplierResponseDto, UpdateSupplierDto } from "./suppliers.schemas";

@Injectable()
export class SuppliersService {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}
  async list(query: SupplierFilterQueryDto): Promise<SupplierListResponseDto> { const page = await this.suppliersRepository.list(query); return { items: page.items.map(toSupplierResponse), limit: query.limit, page: query.page, total: page.total }; }
  async get(id: string): Promise<SupplierResponseDto> { const supplier = await this.suppliersRepository.findById(id); if (!supplier) throw this.notFound(); return toSupplierResponse(supplier); }
  async findById(id: string): Promise<SupplierResponseDto> { return this.get(id); }
  async create(input: CreateSupplierDto): Promise<SupplierResponseDto> {
    return this.suppliersRepository.transaction(async (transaction) => {
      await this.assertCodeAvailable(transaction, input.code);
      try { return toSupplierResponse(await this.suppliersRepository.create(transaction, { ...input, contactName: input.contactName ?? null, email: input.email ?? null, notes: input.notes ?? null, phone: input.phone ?? null })); }
      catch (error) { if (isUniqueConstraint(error)) throw this.codeConflict(); throw error; }
    });
  }
  async update(id: string, input: UpdateSupplierDto): Promise<SupplierResponseDto>;
  async update(input: UpdateSupplierDto & { id: string }): Promise<SupplierResponseDto>;
  async update(idOrInput: string | UpdateSupplierDto, input?: UpdateSupplierDto): Promise<SupplierResponseDto> {
    const id = typeof idOrInput === "string" ? idOrInput : idOrInput.id;
    const changes = typeof idOrInput === "string" ? input ?? {} : idOrInput;
    if (!id) throw this.notFound();
    return this.suppliersRepository.transaction(async (transaction) => {
      if (!await this.suppliersRepository.findByIdInTransaction(transaction, id)) throw this.notFound();
      if (changes.code !== undefined) await this.assertCodeAvailable(transaction, changes.code, id);
      const data = { ...changes };
      delete data.id;
      try { return toSupplierResponse(await this.suppliersRepository.update(transaction, id, data)); }
      catch (error) { if (isUniqueConstraint(error)) throw this.codeConflict(); throw error; }
    });
  }
  async setStatus(id: string, status: SupplierStatus): Promise<SupplierResponseDto> { return this.update(id, { status }); }
  async toggleStatus(id: string): Promise<SupplierResponseDto> {
    const current = await this.suppliersRepository.findById(id);
    if (!current) throw this.notFound();
    return this.setStatus(id, current.status === SupplierStatus.ACTIVE ? SupplierStatus.INACTIVE : SupplierStatus.ACTIVE);
  }
  async softDelete(id: string): Promise<void> { await this.remove(id, false); }
  async hardDelete(id: string): Promise<void> { await this.remove(id, true); }
  async remove(id: string, hard = false): Promise<void> {
    await this.suppliersRepository.transaction(async (transaction) => {
      if (!await this.suppliersRepository.findByIdInTransaction(transaction, id)) throw this.notFound();
      if (hard) await this.suppliersRepository.hardDelete(transaction, id); else await this.suppliersRepository.softDelete(transaction, id);
    });
  }
  async delete(id: string, hard = false): Promise<void> { return this.remove(id, hard); }
  private async assertCodeAvailable(transaction: TransactionClient, code: string, ignoredId?: string): Promise<void> { const existing = await this.suppliersRepository.findByCodeInTransaction(transaction, code); if (existing && existing.id !== ignoredId) throw this.codeConflict(); }
  private notFound(): NotFoundException { return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message: "The requested supplier was not found.", ok: false }); }
  private codeConflict(): ConflictException { return new ConflictException({ code: ERROR_CODE.CONFLICT, message: "Supplier code is already in use.", ok: false }); }
}

export function toSupplierResponse(supplier: SupplierRecord): SupplierResponseDto {
  return { code: supplier.code, contactName: supplier.contactName, createdAt: supplier.createdAt.toISOString(), email: supplier.email, id: supplier.id, name: supplier.name, notes: supplier.notes, phone: supplier.phone, status: supplier.status, updatedAt: supplier.updatedAt.toISOString() };
}

function isUniqueConstraint(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"; }
