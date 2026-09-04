import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { SupplierStatus } from "../../generated/prisma/enums";
import type { SupplierFilterQueryDto } from "./suppliers.schemas";

export const supplierSelect = {
  code: true, contactName: true, createdAt: true, email: true, id: true, name: true, notes: true, phone: true, status: true, updatedAt: true,
} satisfies Prisma.SupplierSelect;
export type SupplierRecord = Prisma.SupplierGetPayload<{ select: typeof supplierSelect }>;
export interface SupplierPageResult { items: SupplierRecord[]; total: number; }
export type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T> { return this.prisma.$transaction(callback); }
  async list(query: SupplierFilterQueryDto): Promise<SupplierPageResult> {
    const where = supplierWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({ orderBy: supplierOrderBy(query), select: supplierSelect, skip: (query.page - 1) * query.limit, take: query.limit, where }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items, total };
  }
  async findById(id: string): Promise<SupplierRecord | null> { return this.findByIdIn(this.prisma, id); }
  async findByIdInTransaction(transaction: TransactionClient, id: string): Promise<SupplierRecord | null> { return this.findByIdIn(transaction, id); }
  async findByCode(code: string): Promise<SupplierRecord | null> { return this.prisma.supplier.findUnique({ select: supplierSelect, where: { code } }); }
  async findByCodeInTransaction(transaction: TransactionClient, code: string): Promise<SupplierRecord | null> { return transaction.supplier.findUnique({ select: supplierSelect, where: { code } }); }
  async create(transaction: TransactionClient, data: Prisma.SupplierUncheckedCreateInput): Promise<SupplierRecord> { return transaction.supplier.create({ data, select: supplierSelect }); }
  async update(transaction: TransactionClient, id: string, data: Prisma.SupplierUncheckedUpdateInput): Promise<SupplierRecord> { return transaction.supplier.update({ data, select: supplierSelect, where: { id } }); }
  async softDelete(transaction: TransactionClient, id: string): Promise<SupplierRecord> { return this.update(transaction, id, { status: SupplierStatus.INACTIVE }); }
  async hardDelete(transaction: TransactionClient, id: string): Promise<void> { await transaction.supplier.delete({ where: { id } }); }
  private async findByIdIn(client: TransactionClient | PrismaService, id: string): Promise<SupplierRecord | null> { return client.supplier.findUnique({ select: supplierSelect, where: { id } }); }
}

export function supplierWhere(query: SupplierFilterQueryDto): Prisma.SupplierWhereInput {
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { OR: ["name", "code", "contactName", "email", "phone"].map((field) => ({ [field]: { contains: query.search, mode: "insensitive" } })) } : {}),
  };
}

export function supplierOrderBy(query: SupplierFilterQueryDto): Prisma.SupplierOrderByWithRelationInput[] {
  return [{ [query.sortBy]: query.sortOrder } as Prisma.SupplierOrderByWithRelationInput, { id: query.sortOrder }];
}
